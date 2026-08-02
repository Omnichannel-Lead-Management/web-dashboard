import { defineStore } from 'pinia'
import { ref } from 'vue'
import { gatewayApi } from '../services/gatewayApi'
import { appointmentService } from '../services/appointmentService'
import { leadService } from '../services/leadService'
import { createAgentSocket } from '../services/agentSocket'
import {
  mapConversation,
  mapHistoryMessage,
  mapLead,
  mapAppointment,
  mapFaq,
  toFaqPayload,
  mapChatbotConfig,
  toChatbotConfigPatch,
  toAppointmentPayload,
  conversationId,
  parseConversationId,
} from '../services/mappers'

const STORAGE = {
  auth: 'loop-auth',
  businessId: 'loop-business-id',
  businessName: 'loop-business-name',
  agentId: 'loop-agent-id',
  agentName: 'loop-agent-name',
  inboxView: 'loop-inbox-view',
  chatbot: 'loop-chatbot',
}

/**
 * Workspace a sign-in registers/attaches to when the form does not say
 * otherwise. Set VITE_BUSINESS_* at build time to point the dashboard at a
 * real company instead of editing this file.
 */
const DEFAULT_WORKSPACE = {
  /**
   * Existing business this dashboard belongs to. Set it and sign-in attaches to
   * that tenant instead of registering a fresh one — the gateway's
   * createBusiness does not deduplicate, so without this every browser that has
   * never signed in would spawn another empty business.
   */
  id: import.meta.env.VITE_BUSINESS_ID || '',
  name: import.meta.env.VITE_BUSINESS_NAME || 'My Business',
  sector: import.meta.env.VITE_BUSINESS_SECTOR || 'salon',
  owner_email: import.meta.env.VITE_BUSINESS_EMAIL || '',
}

export const useAppStore = defineStore('app', () => {
  const authenticated = ref(localStorage.getItem(STORAGE.auth) === 'true')
  const inboxView = ref(
    localStorage.getItem(STORAGE.inboxView) || 'conversation',
  )
  const cachedChatbotEnabled = localStorage.getItem(STORAGE.chatbot) !== 'false'
  const chatbotConfig = ref({
    businessId: '',
    chatbotEnabled: cachedChatbotEnabled,
    welcomeMessage: '',
    escalationMessage: '',
    updatedAt: null,
  })
  const loadingChatbotConfig = ref(false)
  const chatbotConfigError = ref('')
  const savingChatbotConfig = ref(false)
  const conversations = ref([])
  const messages = ref({})
  const leads = ref([])
  const leadDetail = ref(null)
  const leadActivities = ref([])
  const appointments = ref([])
  const faqs = ref([])
  const loadingFaqs = ref(false)
  const faqError = ref('')
  const loadingLeads = ref(false)
  const loadingLeadDetail = ref(false)
  const leadListError = ref('')
  const leadDetailError = ref('')
  const loadingAppointments = ref(false)
  /** EventSource for the live lead feed; closed on sign-out. */
  let leadStream = null
  let leadListRequestId = 0
  let leadDetailRequestId = 0
  const leadSessionVersion = ref(0)
  const activeLeadMutations = new Set()
  let faqSessionVersion = 0
  let faqListRequestId = 0
  const activeFaqMutations = new Set()
  let chatbotConfigSessionVersion = 0
  let businessSessionVersion = 0
  let chatbotConfigRequestId = 0
  const activeChatbotConfigMutations = new Set()
  const selectedConversationId = ref('')
  const toast = ref(null)
  const connectionStatus = ref('offline')
  /**
   * A build pinned to a tenant (VITE_BUSINESS_ID) wins over whatever is in
   * localStorage. The other way round, a browser that signed in before the
   * build was pinned keeps its old business id forever and shows that tenant's
   * — usually empty — inbox, while messages pile up under the real one.
   */
  const storedBusinessId = localStorage.getItem(STORAGE.businessId) || ''
  const pinnedBusinessId = DEFAULT_WORKSPACE.id
  if (pinnedBusinessId && storedBusinessId !== pinnedBusinessId) {
    localStorage.setItem(STORAGE.businessId, pinnedBusinessId)
    localStorage.removeItem(STORAGE.businessName)
  }
  const businessId = ref(pinnedBusinessId || storedBusinessId)
  const businessName = ref(
    localStorage.getItem(STORAGE.businessName) ||
      DEFAULT_WORKSPACE.name ||
      'My Business',
  )
  const business = ref(null)
  const agentId = ref(localStorage.getItem(STORAGE.agentId) || 'agent_demo')
  const agentName = ref(localStorage.getItem(STORAGE.agentName) || 'Agent')
  const loadingInbox = ref(false)

  let toastTimer
  let socketApi = null

  function notify(message, type = 'success') {
    toast.value = { message, type }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
    }, 3200)
  }

  function persistSession() {
    localStorage.setItem(STORAGE.auth, authenticated.value ? 'true' : 'false')
    if (businessId.value)
      localStorage.setItem(STORAGE.businessId, businessId.value)
    if (businessName.value)
      localStorage.setItem(STORAGE.businessName, businessName.value)
    if (agentId.value) localStorage.setItem(STORAGE.agentId, agentId.value)
    if (agentName.value)
      localStorage.setItem(STORAGE.agentName, agentName.value)
  }

  function upsertConversation(summaryOrConversation) {
    const mapped = summaryOrConversation.id
      ? summaryOrConversation
      : mapConversation(summaryOrConversation)
    const index = conversations.value.findIndex((item) => item.id === mapped.id)
    if (index >= 0) {
      conversations.value[index] = { ...conversations.value[index], ...mapped }
    } else {
      conversations.value.unshift(mapped)
    }
    if (!selectedConversationId.value) {
      selectedConversationId.value = mapped.id
    }
    return mapped
  }

  function appendMessage(conversationKey, message) {
    messages.value[conversationKey] ||= []
    const exists = messages.value[conversationKey].some(
      (item) => item.id === message.id,
    )
    if (!exists) {
      messages.value[conversationKey].push(message)
    }
  }

  async function refreshConversations() {
    if (!businessId.value) return
    loadingInbox.value = true
    try {
      const result = await gatewayApi.listConversations(businessId.value)
      const mapped = (result.conversations || []).map(mapConversation)
      conversations.value = mapped
      if (
        mapped.length > 0 &&
        !mapped.some((item) => item.id === selectedConversationId.value)
      ) {
        selectedConversationId.value = mapped[0].id
      }
    } catch (error) {
      notify(error.message || 'Failed to load inbox', 'error')
    } finally {
      loadingInbox.value = false
    }
  }

  async function loadHistory(conversationKey) {
    const { platform, messenger_id } = parseConversationId(conversationKey)
    if (!platform || !messenger_id) return

    try {
      // Prefer agent hub history via websocket when connected; fallback to REST.
      const sent = socketApi?.send({
        type: 'get_history',
        platform,
        messenger_id,
        business_id: businessId.value,
        limit: 50,
      })

      if (!sent) {
        const result = await gatewayApi.getMessagingHistory({
          messenger_id,
          platform,
          limit: 50,
        })
        const history = Array.isArray(result.history) ? result.history : []
        messages.value[conversationKey] = history.map((entry) =>
          mapHistoryMessage({
            id: entry.id,
            from: entry.is_from_user ? 'user' : 'ai',
            text: entry.message_text || entry.text,
            metadata: entry.metadata,
            timestamp: entry.created_at || entry.timestamp,
          }),
        )
      }
    } catch (error) {
      notify(error.message || 'Failed to load messages', 'error')
    }
  }

  function handleSocketEvent(event) {
    if (!event?.type) return

    if (event.type === 'connected') {
      connectionStatus.value = 'connected'
      socketApi?.send({
        type: 'register',
        agent_id: agentId.value,
        agent_name: agentName.value,
        business_id: businessId.value || undefined,
      })
      return
    }

    if (event.type === 'registered') {
      connectionStatus.value = 'online'
      notify('Agent channel connected')
      refreshConversations()
      return
    }

    if (event.type === 'auth_failed') {
      connectionStatus.value = 'error'
      notify(event.error || 'Agent auth failed', 'error')
      return
    }

    if (event.type === 'queue_snapshot' && Array.isArray(event.chats)) {
      for (const chat of event.chats) {
        upsertConversation({
          messenger_id: chat.messenger_id,
          platform: chat.platform,
          display_name: chat.display_name,
          is_escalated: true,
          escalation_status: chat.escalation_status,
          claimed_by_agent_id: chat.claimed_by_agent_id,
          last_message: chat.escalation_summary
            ? {
                text: chat.escalation_summary,
                is_from_user: true,
                created_at: chat.updated_at,
              }
            : null,
          updated_at: chat.updated_at,
        })
      }
      return
    }

    if (event.type === 'chat_queued' && event.chat) {
      upsertConversation({
        messenger_id: event.chat.messenger_id,
        platform: event.chat.platform,
        display_name: event.chat.display_name,
        is_escalated: true,
        escalation_status: event.chat.escalation_status,
        claimed_by_agent_id: event.chat.claimed_by_agent_id,
        last_message: {
          text: event.chat.escalation_summary || 'Waiting for an agent',
          is_from_user: true,
          created_at: event.chat.updated_at,
        },
        updated_at: event.chat.updated_at,
      })
      notify('New chat waiting in triage')
      return
    }

    if (event.type === 'chat_claimed') {
      const id = conversationId(event.platform, event.messenger_id)
      const conversation = conversations.value.find((item) => item.id === id)
      if (conversation) {
        conversation.claimed = true
        conversation.escalated = true
        conversation.unread = false
      }
      return
    }

    if (event.type === 'chat_released' || event.type === 'de_escalated') {
      const id = conversationId(event.platform, event.messenger_id)
      const conversation = conversations.value.find((item) => item.id === id)
      if (conversation) {
        conversation.claimed = false
        if (event.type === 'de_escalated') conversation.escalated = false
      }
      return
    }

    if (event.type === 'chat_message') {
      const id = conversationId(event.platform, event.messenger_id)
      upsertConversation({
        messenger_id: event.messenger_id,
        platform: event.platform,
        display_name:
          conversations.value.find((item) => item.id === id)?.name ||
          event.messenger_id,
        is_escalated: true,
        escalation_status: 'claimed',
        claimed_by_agent_id: event.from === 'agent' ? event.agent_id : null,
        last_message: {
          text: event.text,
          is_from_user: event.from === 'user',
          created_at: event.timestamp,
        },
        updated_at: event.timestamp,
      })
      appendMessage(
        id,
        mapHistoryMessage({
          id: `${event.timestamp}-${event.from}-${event.text?.slice(0, 12)}`,
          from:
            event.from === 'user'
              ? 'user'
              : event.from === 'agent'
                ? 'agent'
                : 'ai',
          text: event.text,
          timestamp: event.timestamp,
        }),
      )
      return
    }

    if (event.type === 'history' && event.success) {
      const id = conversationId(event.platform, event.messenger_id)
      const mapped = (event.history || []).map(mapHistoryMessage)
      if (event.append) {
        messages.value[id] = [...mapped, ...(messages.value[id] || [])]
      } else {
        messages.value[id] = mapped
      }
      return
    }

    if (event.type === 'claim_result') {
      if (!event.success) {
        notify(event.error || 'Could not claim chat', 'error')
        return
      }
      const id = conversationId(event.platform, event.messenger_id)
      const conversation = conversations.value.find((item) => item.id === id)
      if (conversation) {
        conversation.claimed = true
        conversation.escalated = true
        conversation.unread = false
      }
      if (Array.isArray(event.history)) {
        messages.value[id] = event.history.map(mapHistoryMessage)
      }
      notify('Chat claimed — you can reply now')
      return
    }

    if (event.type === 'release_result') {
      if (!event.success) {
        notify(event.error || 'Could not release chat', 'error')
        return
      }
      const id = conversationId(event.platform, event.messenger_id)
      const conversation = conversations.value.find((item) => item.id === id)
      if (conversation) conversation.claimed = false
      notify('Chat released back to the queue')
      return
    }

    if (event.type === 'send_result' && !event.success) {
      notify(event.error || 'Failed to send message', 'error')
      return
    }

    if (event.type === 'error') {
      notify(event.message || 'Agent channel error', 'error')
    }
  }

  function connectAgentChannel() {
    if (!authenticated.value || !businessId.value) return
    socketApi?.close()
    connectionStatus.value = 'connecting'
    socketApi = createAgentSocket({
      onEvent: handleSocketEvent,
      onOpen: () => {
        connectionStatus.value = 'connected'
      },
      onClose: () => {
        connectionStatus.value = 'offline'
      },
      onError: () => {
        connectionStatus.value = 'error'
      },
    })
  }

  function disconnectAgentChannel() {
    socketApi?.close()
    socketApi = null
    connectionStatus.value = 'offline'
  }

  async function ensureBusinessSession({
    name = DEFAULT_WORKSPACE.name,
    sector = DEFAULT_WORKSPACE.sector,
    owner_email = DEFAULT_WORKSPACE.owner_email,
    agent_id = '',
    agent_name = 'Agent',
  } = {}) {
    agentName.value = agent_name
    agentId.value =
      agent_id ||
      localStorage.getItem(STORAGE.agentId) ||
      `agent_${Date.now().toString(36)}`

    if (businessId.value) {
      try {
        const existing = await gatewayApi.getBusiness(businessId.value)
        business.value = existing.business || null
        businessName.value = existing.business?.name || name
        persistSession()
        return existing.business
      } catch {
        // fall through and create
      }
    }

    const created = await gatewayApi.createBusiness({
      name,
      sector,
      owner_email,
    })
    businessId.value = created.business.id
    businessName.value = created.business.name
    business.value = created.business
    persistSession()
    return created.business
  }

  async function login(options = {}) {
    await ensureBusinessSession(options)
    authenticated.value = true
    persistSession()
    await refreshConversations()
    connectAgentChannel()
    refreshLeads().finally(connectLeadStream)
    refreshAppointments()
  }

  async function registerBusiness(form) {
    const created = await gatewayApi.createBusiness({
      name: form.business,
      sector: form.sector || 'Salon',
      owner_email: form.email,
    })
    businessId.value = created.business.id
    businessName.value = created.business.name
    business.value = created.business
    agentName.value = form.owner?.split(' ')[0] || 'Owner'
    agentId.value = `agent_${Date.now().toString(36)}`
    authenticated.value = true
    persistSession()
    connectAgentChannel()
    return created.business
  }

  function logout() {
    authenticated.value = false
    localStorage.setItem(STORAGE.auth, 'false')
    disconnectAgentChannel()
    disconnectLeadStream()
    // Invalidate prior-session lead work before clearing tenant data.
    leadSessionVersion.value += 1
    leadListRequestId += 1
    leadDetailRequestId += 1
    activeLeadMutations.clear()
    faqSessionVersion += 1
    faqListRequestId += 1
    activeFaqMutations.clear()
    chatbotConfigSessionVersion += 1
    businessSessionVersion += 1
    chatbotConfigRequestId += 1
    activeChatbotConfigMutations.clear()
    leads.value = []
    leadDetail.value = null
    leadActivities.value = []
    leadListError.value = ''
    leadDetailError.value = ''
    loadingLeads.value = false
    loadingLeadDetail.value = false
    business.value = null
    faqs.value = []
    faqError.value = ''
    loadingFaqs.value = false
    chatbotConfig.value = {
      businessId: '',
      chatbotEnabled: true,
      welcomeMessage: '',
      escalationMessage: '',
      updatedAt: null,
    }
    chatbotConfigError.value = ''
    loadingChatbotConfig.value = false
    savingChatbotConfig.value = false
    localStorage.removeItem(STORAGE.chatbot)
    appointments.value = []
  }

  function setInboxView(view) {
    inboxView.value = view
    localStorage.setItem(STORAGE.inboxView, view)
  }

  function claim(id) {
    const { platform, messenger_id } = parseConversationId(id)
    const sent = socketApi?.send({
      type: 'claim_chat',
      platform,
      messenger_id,
      business_id: businessId.value,
    })
    if (!sent) notify('Not connected to gateway', 'error')
  }

  function release(id) {
    const { platform, messenger_id } = parseConversationId(id)
    const sent = socketApi?.send({
      type: 'release_chat',
      platform,
      messenger_id,
      business_id: businessId.value,
    })
    if (!sent) notify('Not connected to gateway', 'error')
  }

  function sendMessage(id, text) {
    const optimistic = {
      id: Date.now(),
      sender: 'agent',
      text,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
    appendMessage(id, optimistic)

    const conversation = conversations.value.find((item) => item.id === id)
    if (conversation) conversation.preview = text

    const { platform, messenger_id } = parseConversationId(id)
    const sent = socketApi?.send({
      type: 'send_message',
      platform,
      messenger_id,
      message: text,
      business_id: businessId.value,
    })
    if (!sent) notify('Not connected to gateway', 'error')
  }

  async function refreshLeads(filters = {}) {
    if (!authenticated.value || !businessId.value) return null
    const sessionVersion = leadSessionVersion.value
    const requestBusinessId = businessId.value
    const requestId = ++leadListRequestId
    loadingLeads.value = true
    leadListError.value = ''
    try {
      const result = await leadService.list(requestBusinessId, filters)
      if (
        requestId !== leadListRequestId ||
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      )
        return null
      leads.value = result
      return result
    } catch (error) {
      if (
        requestId !== leadListRequestId ||
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      )
        return null
      leadListError.value = error.message || 'Failed to load leads'
      notify(error.message || 'Failed to load leads', 'error')
      return null
    } finally {
      if (
        requestId === leadListRequestId &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      )
        loadingLeads.value = false
    }
  }

  async function loadLead(id) {
    if (!businessId.value) return null
    return leadService.get(id, businessId.value)
  }

  async function refreshLeadDetail(id) {
    if (!authenticated.value || !businessId.value || !id) return null
    const sessionVersion = leadSessionVersion.value
    const requestBusinessId = businessId.value
    const requestId = ++leadDetailRequestId
    loadingLeadDetail.value = true
    leadDetailError.value = ''
    try {
      const result = await leadService.get(id, requestBusinessId)
      if (
        requestId !== leadDetailRequestId ||
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      )
        return null
      leadDetail.value = result.lead
      leadActivities.value = result.activities
      const index = leads.value.findIndex((lead) => lead.id === id)
      if (index >= 0) leads.value[index] = result.lead
      return result
    } catch (error) {
      if (
        requestId !== leadDetailRequestId ||
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      )
        return null
      leadDetailError.value = error.message || 'Failed to load lead'
      throw error
    } finally {
      if (
        requestId === leadDetailRequestId &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      )
        loadingLeadDetail.value = false
    }
  }

  /**
   * Live lead feed. Lead Manager publishes per tenant over SSE, so a lead
   * captured by the chatbot or by routing shows up without a refresh.
   */
  function connectLeadStream() {
    if (!authenticated.value || !businessId.value || leadStream) return
    const sessionVersion = leadSessionVersion.value
    const streamBusinessId = businessId.value
    try {
      leadStream = new EventSource(gatewayApi.leadStreamUrl(streamBusinessId))

      const upsert = (event) => {
        if (
          sessionVersion !== leadSessionVersion.value ||
          businessId.value !== streamBusinessId ||
          !authenticated.value
        )
          return
        const incoming = mapLead(JSON.parse(event.data))
        const index = leads.value.findIndex((item) => item.id === incoming.id)
        if (index === -1) leads.value.unshift(incoming)
        else leads.value[index] = incoming
      }

      leadStream.addEventListener('lead.created', upsert)
      leadStream.addEventListener('lead.updated', upsert)
      // EventSource reconnects on its own; only log so a blip is not a toast storm.
      leadStream.onerror = () =>
        console.warn('[leads] stream interrupted, retrying')
    } catch (error) {
      console.warn('[leads] stream unavailable:', error.message)
    }
  }

  function disconnectLeadStream() {
    leadStream?.close()
    leadStream = null
  }

  function mergeLead(updated) {
    if (!updated) return
    const index = leads.value.findIndex((lead) => lead.id === updated.id)
    if (index >= 0) leads.value[index] = { ...leads.value[index], ...updated }
    if (leadDetail.value?.id === updated.id) {
      leadDetail.value = { ...leadDetail.value, ...updated }
    }
  }

  function leadUpdateMessage(patch) {
    if ('notes' in patch) return 'Lead notes updated'
    if ('tags' in patch) return 'Lead tags updated'
    if ('status' in patch) return 'Lead status updated'
    if ('service_interest' in patch) return 'Lead service interest updated'
    if ('budget_range' in patch) return 'Lead budget updated'
    return 'Lead details updated'
  }

  async function updateLead(id, patch, { silent = false } = {}) {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = leadSessionVersion.value
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:${id}`
    if (activeLeadMutations.has(mutationKey)) {
      throw new Error('A lead update is already in progress')
    }
    activeLeadMutations.add(mutationKey)
    let updated
    try {
      updated = await leadService.update(id, requestBusinessId, {
        ...patch,
        performed_by: agentId.value,
      })
      if (
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      ) {
        activeLeadMutations.delete(mutationKey)
        return updated
      }
      mergeLead(updated)
    } catch (error) {
      if (
        !silent &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      )
        notify(error.message || 'Failed to update lead', 'error')
      activeLeadMutations.delete(mutationKey)
      throw error
    }

    try {
      if (
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      ) {
        activeLeadMutations.delete(mutationKey)
        return updated
      }
      const refreshed = await refreshLeadDetail(id)
      if (
        !silent &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      )
        notify(leadUpdateMessage(patch))
      return refreshed?.lead || updated
    } catch {
      if (
        !silent &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      ) {
        notify(
          'Lead updated, but the latest activity could not be loaded.',
          'error',
        )
      }
      return updated
    } finally {
      activeLeadMutations.delete(mutationKey)
    }
  }

  async function updateLeadStatus(id, status, options) {
    return updateLead(id, { status }, options)
  }

  async function assignLead(id, targetAgentId, { silent = false } = {}) {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = leadSessionVersion.value
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:${id}`
    if (activeLeadMutations.has(mutationKey)) {
      throw new Error('A lead assignment is already in progress')
    }
    activeLeadMutations.add(mutationKey)
    let updated
    try {
      const payload = { performed_by: agentId.value }
      if (targetAgentId) payload.agent_id = targetAgentId
      updated = await leadService.assign(id, requestBusinessId, payload)
      if (
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      ) {
        activeLeadMutations.delete(mutationKey)
        return updated
      }
      mergeLead(updated)
    } catch (error) {
      if (
        !silent &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      )
        notify(error.message || 'Failed to assign lead', 'error')
      activeLeadMutations.delete(mutationKey)
      throw error
    }

    try {
      if (
        sessionVersion !== leadSessionVersion.value ||
        businessId.value !== requestBusinessId
      )
        return updated
      const refreshed = await refreshLeadDetail(id)
      if (
        !silent &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      )
        notify('Lead assignment updated')
      return refreshed?.lead || updated
    } catch {
      if (
        !silent &&
        sessionVersion === leadSessionVersion.value &&
        businessId.value === requestBusinessId
      ) {
        notify(
          'Lead assigned, but the latest activity could not be loaded.',
          'error',
        )
      }
      return updated
    } finally {
      activeLeadMutations.delete(mutationKey)
    }
  }

  async function autoAssignLead(id, options) {
    return assignLead(id, undefined, options)
  }

  async function refreshAppointments() {
    if (!businessId.value) return
    loadingAppointments.value = true
    try {
      const result = await gatewayApi.listAppointments(businessId.value)
      appointments.value = (result.data || []).map(mapAppointment)
    } catch (error) {
      notify(error.message || 'Failed to load appointments', 'error')
    } finally {
      loadingAppointments.value = false
    }
  }

  async function addAppointment(item) {
    try {
      const created = await gatewayApi.createAppointment(
        toAppointmentPayload(item, businessId.value),
      )
      if (created.data) appointments.value.unshift(mapAppointment(created.data))
      notify('Appointment booked')
      return created.data
    } catch (error) {
      // 409 means the slot went while the form was open — say so, do not swallow it.
      notify(error.message || 'Failed to book appointment', 'error')
      throw error
    }
  }

  async function updateAppointmentStatus(id, status) {
    const appointment = appointments.value.find((item) => item.id === id)
    if (!appointment) {
      notify('Appointment not found', 'error')
      return null
    }

    const originalStatus = appointment.status
    appointment.status = status

    try {
      const confirmed = await appointmentService.updateStatus(
        id,
        businessId.value,
        status,
      )
      if (confirmed) Object.assign(appointment, confirmed)

      const successMessages = {
        confirmed: 'Appointment confirmed',
        completed: 'Appointment completed',
        cancelled: 'Appointment cancelled',
      }
      notify(successMessages[status] || 'Appointment updated')
      return appointment
    } catch (error) {
      appointment.status = originalStatus
      notify(error.message || 'Failed to update appointment', 'error')
      throw error
    }
  }

  async function refreshBusiness() {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const requestBusinessId = businessId.value
    const sessionVersion = businessSessionVersion
    const result = await gatewayApi.getBusiness(requestBusinessId)
    if (
      !authenticated.value ||
      sessionVersion !== businessSessionVersion ||
      businessId.value !== requestBusinessId ||
      !result?.business
    )
      return null
    business.value = result.business
    businessName.value = result.business.name || businessName.value
    persistSession()
    return business.value
  }

  async function refreshChatbotConfig() {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = chatbotConfigSessionVersion
    const requestBusinessId = businessId.value
    const requestId = ++chatbotConfigRequestId
    loadingChatbotConfig.value = true
    chatbotConfigError.value = ''
    try {
      const result = await gatewayApi.getChatbotConfig(requestBusinessId)
      if (
        requestId !== chatbotConfigRequestId ||
        sessionVersion !== chatbotConfigSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      if (!result?.config || typeof result.config !== 'object') {
        throw new Error('Gateway returned an invalid chatbot config response')
      }
      const mapped = mapChatbotConfig(result.config)
      chatbotConfig.value = mapped
      localStorage.setItem(STORAGE.chatbot, String(mapped.chatbotEnabled))
      return mapped
    } catch (error) {
      if (
        requestId !== chatbotConfigRequestId ||
        sessionVersion !== chatbotConfigSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      chatbotConfigError.value =
        error.message || 'Failed to load chatbot settings'
      notify(chatbotConfigError.value, 'error')
      throw error
    } finally {
      if (
        requestId === chatbotConfigRequestId &&
        sessionVersion === chatbotConfigSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      )
        loadingChatbotConfig.value = false
    }
  }

  async function patchChatbotConfig(
    changes,
    { successMessage, optimisticConfig = null, previousCache = null } = {},
  ) {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = chatbotConfigSessionVersion
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:${requestBusinessId}:config`
    if (activeChatbotConfigMutations.has(mutationKey)) {
      throw new Error('Chatbot settings are already being saved')
    }
    activeChatbotConfigMutations.add(mutationKey)
    const previousConfig = { ...chatbotConfig.value }
    if (optimisticConfig) chatbotConfig.value = optimisticConfig
    savingChatbotConfig.value = true
    try {
      const result = await gatewayApi.updateChatbotConfig(
        requestBusinessId,
        toChatbotConfigPatch(changes),
      )
      if (!result?.config || typeof result.config !== 'object') {
        throw new Error('Gateway returned an invalid chatbot config response')
      }
      const mapped = mapChatbotConfig(result.config)
      if (
        sessionVersion !== chatbotConfigSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return mapped
      chatbotConfigRequestId += 1
      loadingChatbotConfig.value = false
      chatbotConfig.value = mapped
      localStorage.setItem(STORAGE.chatbot, String(mapped.chatbotEnabled))
      notify(successMessage)
      return mapped
    } catch (error) {
      if (
        sessionVersion === chatbotConfigSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      ) {
        if (optimisticConfig) {
          chatbotConfig.value = previousConfig
          if (previousCache === null) localStorage.removeItem(STORAGE.chatbot)
          else localStorage.setItem(STORAGE.chatbot, previousCache)
        }
        notify(error.message || 'Failed to save chatbot settings', 'error')
      }
      throw error
    } finally {
      activeChatbotConfigMutations.delete(mutationKey)
      if (
        sessionVersion === chatbotConfigSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      )
        savingChatbotConfig.value = false
    }
  }

  async function updateChatbotEnabled(enabled) {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const mutationKey = `${chatbotConfigSessionVersion}:${businessId.value}:config`
    if (activeChatbotConfigMutations.has(mutationKey)) {
      throw new Error('Chatbot settings are already being saved')
    }
    const previousCache = localStorage.getItem(STORAGE.chatbot)
    const optimisticConfig = {
      ...chatbotConfig.value,
      chatbotEnabled: Boolean(enabled),
    }
    localStorage.setItem(STORAGE.chatbot, String(Boolean(enabled)))
    return patchChatbotConfig(
      { chatbotEnabled: Boolean(enabled) },
      {
        successMessage: `Chatbot ${enabled ? 'enabled' : 'disabled'}`,
        optimisticConfig,
        previousCache,
      },
    )
  }

  async function saveChatbotMessages(messages) {
    return patchChatbotConfig(messages, {
      successMessage: 'Chatbot messages saved',
    })
  }

  async function refreshFaqs() {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = faqSessionVersion
    const requestBusinessId = businessId.value
    const requestId = ++faqListRequestId
    loadingFaqs.value = true
    faqError.value = ''
    try {
      const result = await gatewayApi.listFaqs(requestBusinessId)
      if (
        requestId !== faqListRequestId ||
        sessionVersion !== faqSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      if (!Array.isArray(result?.faqs)) {
        throw new Error('Gateway returned an invalid FAQ list response')
      }
      faqs.value = result.faqs.map(mapFaq)
      return faqs.value
    } catch (error) {
      if (
        requestId !== faqListRequestId ||
        sessionVersion !== faqSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      faqError.value = error.message || 'Failed to load FAQs'
      notify(faqError.value, 'error')
      throw error
    } finally {
      if (
        requestId === faqListRequestId &&
        sessionVersion === faqSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      )
        loadingFaqs.value = false
    }
  }

  function invalidateFaqListRequests() {
    faqListRequestId += 1
    loadingFaqs.value = false
  }

  async function createFaq(faq) {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = faqSessionVersion
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:create`
    if (activeFaqMutations.has(mutationKey)) {
      throw new Error('An FAQ is already being created')
    }
    activeFaqMutations.add(mutationKey)
    try {
      const result = await gatewayApi.createFaq(
        requestBusinessId,
        toFaqPayload(faq),
      )
      if (!result?.faq?.id) {
        throw new Error('Gateway returned an invalid FAQ response')
      }
      const created = mapFaq(result.faq)
      if (
        sessionVersion !== faqSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return created
      invalidateFaqListRequests()
      faqs.value.unshift(created)
      notify('FAQ created')
      return created
    } catch (error) {
      if (
        sessionVersion === faqSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      )
        notify(error.message || 'FAQ could not be created', 'error')
      throw error
    } finally {
      activeFaqMutations.delete(mutationKey)
    }
  }

  async function updateFaq(faqId, changes) {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = faqSessionVersion
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:update:${faqId}`
    if (activeFaqMutations.has(mutationKey)) {
      throw new Error('This FAQ is already being updated')
    }
    activeFaqMutations.add(mutationKey)
    const index = faqs.value.findIndex((faq) => faq.id === faqId)
    const previous = index >= 0 ? { ...faqs.value[index] } : null
    const isToggle = Object.keys(changes).length === 1 && 'enabled' in changes
    if (isToggle && index >= 0) {
      faqs.value[index].enabled = Boolean(changes.enabled)
    }
    const payload = isToggle
      ? { enabled: Boolean(changes.enabled) }
      : toFaqPayload({ ...(previous || {}), ...changes })
    try {
      const result = await gatewayApi.updateFaq(faqId, payload)
      if (!result?.faq?.id) {
        throw new Error('Gateway returned an invalid FAQ response')
      }
      const updated = mapFaq(result.faq)
      if (
        sessionVersion !== faqSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return updated
      invalidateFaqListRequests()
      const currentIndex = faqs.value.findIndex((faq) => faq.id === faqId)
      if (currentIndex >= 0) faqs.value[currentIndex] = updated
      notify(
        isToggle
          ? `FAQ ${updated.enabled ? 'enabled' : 'disabled'}`
          : 'FAQ updated',
      )
      return updated
    } catch (error) {
      if (
        sessionVersion === faqSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      ) {
        if (isToggle && previous) {
          const currentIndex = faqs.value.findIndex((faq) => faq.id === faqId)
          if (currentIndex >= 0) faqs.value[currentIndex] = previous
        }
        notify(error.message || 'FAQ could not be updated', 'error')
      }
      throw error
    } finally {
      activeFaqMutations.delete(mutationKey)
    }
  }

  async function deleteFaq(faqId) {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = faqSessionVersion
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:delete:${faqId}`
    if (activeFaqMutations.has(mutationKey)) {
      throw new Error('This FAQ is already being deleted')
    }
    activeFaqMutations.add(mutationKey)
    try {
      await gatewayApi.deleteFaq(faqId)
      if (
        sessionVersion !== faqSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return
      invalidateFaqListRequests()
      faqs.value = faqs.value.filter((faq) => faq.id !== faqId)
      notify('FAQ deleted')
    } catch (error) {
      if (
        sessionVersion === faqSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      )
        notify(error.message || 'FAQ could not be deleted', 'error')
      throw error
    } finally {
      activeFaqMutations.delete(mutationKey)
    }
  }

  // Auto-reconnect after page refresh when already signed in
  if (authenticated.value && businessId.value) {
    refreshConversations().finally(() => connectAgentChannel())
    refreshLeads().finally(connectLeadStream)
    refreshAppointments()
  }

  return {
    authenticated,
    inboxView,
    chatbotConfig,
    loadingChatbotConfig,
    chatbotConfigError,
    savingChatbotConfig,
    conversations,
    messages,
    leads,
    leadDetail,
    leadActivities,
    appointments,
    faqs,
    selectedConversationId,
    toast,
    connectionStatus,
    businessId,
    businessName,
    business,
    agentId,
    agentName,
    loadingInbox,
    loadingLeads,
    loadingLeadDetail,
    leadListError,
    leadDetailError,
    leadSessionVersion,
    loadingAppointments,
    loadingFaqs,
    faqError,
    notify,
    login,
    registerBusiness,
    logout,
    setInboxView,
    refreshChatbotConfig,
    updateChatbotEnabled,
    saveChatbotMessages,
    claim,
    release,
    sendMessage,
    updateLeadStatus,
    updateLead,
    assignLead,
    autoAssignLead,
    refreshLeads,
    loadLead,
    refreshLeadDetail,
    refreshAppointments,
    addAppointment,
    updateAppointmentStatus,
    refreshConversations,
    loadHistory,
    refreshBusiness,
    refreshFaqs,
    createFaq,
    updateFaq,
    deleteFaq,
    connectAgentChannel,
  }
})
