import { defineStore } from 'pinia'
import { ref } from 'vue'
import { leads as seedLeads, initialAppointments } from '../data/mockData'
import { gatewayApi } from '../services/gatewayApi'
import { createAgentSocket } from '../services/agentSocket'
import {
  mapConversation,
  mapHistoryMessage,
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
  name: import.meta.env.VITE_BUSINESS_NAME || 'My Business',
  sector: import.meta.env.VITE_BUSINESS_SECTOR || 'salon',
  owner_email: import.meta.env.VITE_BUSINESS_EMAIL || '',
}

export const useAppStore = defineStore('app', () => {
  const authenticated = ref(localStorage.getItem(STORAGE.auth) === 'true')
  const inboxView = ref(localStorage.getItem(STORAGE.inboxView) || 'conversation')
  const chatbotEnabled = ref(localStorage.getItem(STORAGE.chatbot) !== 'false')
  const conversations = ref([])
  const messages = ref({})
  const leads = ref(structuredClone(seedLeads))
  const appointments = ref(structuredClone(initialAppointments))
  const selectedConversationId = ref('')
  const toast = ref(null)
  const connectionStatus = ref('offline')
  const businessId = ref(localStorage.getItem(STORAGE.businessId) || '')
  const businessName = ref(localStorage.getItem(STORAGE.businessName) || 'My Business')
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
    if (businessId.value) localStorage.setItem(STORAGE.businessId, businessId.value)
    if (businessName.value) localStorage.setItem(STORAGE.businessName, businessName.value)
    if (agentId.value) localStorage.setItem(STORAGE.agentId, agentId.value)
    if (agentName.value) localStorage.setItem(STORAGE.agentName, agentName.value)
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
    const exists = messages.value[conversationKey].some((item) => item.id === message.id)
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
            ? { text: chat.escalation_summary, is_from_user: true, created_at: chat.updated_at }
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
          conversations.value.find((item) => item.id === id)?.name || event.messenger_id,
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
          from: event.from === 'user' ? 'user' : event.from === 'agent' ? 'agent' : 'ai',
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
      agent_id || localStorage.getItem(STORAGE.agentId) || `agent_${Date.now().toString(36)}`

    if (businessId.value) {
      try {
        const existing = await gatewayApi.getBusiness(businessId.value)
        businessName.value = existing.business?.name || name
        persistSession()
        return existing.business
      } catch {
        // fall through and create
      }
    }

    const created = await gatewayApi.createBusiness({ name, sector, owner_email })
    businessId.value = created.business.id
    businessName.value = created.business.name
    persistSession()
    return created.business
  }

  async function login(options = {}) {
    await ensureBusinessSession(options)
    authenticated.value = true
    persistSession()
    await refreshConversations()
    connectAgentChannel()
  }

  async function registerBusiness(form) {
    const created = await gatewayApi.createBusiness({
      name: form.business,
      sector: form.sector || 'Salon',
      owner_email: form.email,
    })
    businessId.value = created.business.id
    businessName.value = created.business.name
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
  }

  function setInboxView(view) {
    inboxView.value = view
    localStorage.setItem(STORAGE.inboxView, view)
  }

  function toggleChatbot() {
    chatbotEnabled.value = !chatbotEnabled.value
    localStorage.setItem(STORAGE.chatbot, String(chatbotEnabled.value))
    notify(`Chatbot ${chatbotEnabled.value ? 'enabled' : 'disabled'}`)
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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  function updateLeadStatus(id, status) {
    const lead = leads.value.find((currentLead) => currentLead.id === id)
    if (lead) lead.status = status
    notify('Lead status updated (local only — lead-manager not deployed)')
  }

  function addAppointment(item) {
    appointments.value.unshift({
      ...item,
      id: Date.now(),
      status: 'confirmed',
      day: 'Upcoming',
    })
    notify('Appointment saved locally (appointment service not deployed)')
  }

  async function connectTelegram(botToken) {
    if (!businessId.value) throw new Error('No business selected')
    const result = await gatewayApi.connectTelegram(businessId.value, botToken)
    notify(`Telegram connected${result.bot_username ? ` as @${result.bot_username}` : ''}`)
    return result
  }

  // Auto-reconnect after page refresh when already signed in
  if (authenticated.value && businessId.value) {
    refreshConversations().finally(() => connectAgentChannel())
  }

  return {
    authenticated,
    inboxView,
    chatbotEnabled,
    conversations,
    messages,
    leads,
    appointments,
    selectedConversationId,
    toast,
    connectionStatus,
    businessId,
    businessName,
    agentId,
    agentName,
    loadingInbox,
    notify,
    login,
    registerBusiness,
    logout,
    setInboxView,
    toggleChatbot,
    claim,
    release,
    sendMessage,
    updateLeadStatus,
    addAppointment,
    refreshConversations,
    loadHistory,
    connectTelegram,
    connectAgentChannel,
  }
})
