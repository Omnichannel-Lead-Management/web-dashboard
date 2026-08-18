import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { gatewayApi } from '../services/gatewayApi'
import { appointmentService } from '../services/appointmentService'
import { leadService } from '../services/leadService'
import { createAgentSocket } from '../services/agentSocket'
import {
  agentEscalationQueueEnabled,
  analyticsEnabled,
  notificationCenterEnabled,
} from '../config'
import { mapAnalyticsResponse } from '../services/analytics'
import { friendlyErrorMessage } from '../services/displayText'
import {
  analyticsRangeKey as createAnalyticsRangeKey,
  isValidAnalyticsDateRange,
} from '../services/analyticsDateRange'
import {
  BUSINESS_SECTORS,
  normalizeBusinessSector,
} from '../constants/businessSectors'
import {
  getEscalationOwnership,
  mapEscalation,
  mapEscalationQueue,
} from '../services/escalations'
import {
  getUnreadNotificationCount,
  mapNotification,
  mapNotificationsResponse,
} from '../services/notifications'
import {
  createOnboardingProgress,
  loadOnboardingProgress as readOnboardingProgress,
  removeOnboardingProgress,
  saveOnboardingProgress,
} from '../services/onboardingProgress'
import {
  mapConversation,
  mapHistoryMessage,
  mapLead,
  mapAppointment,
  mapFaq,
  toFaqPayload,
  mapChatbotConfig,
  mapConversationTemplate,
  mapConversationFlow,
  toChatbotConfigPatch,
  toAppointmentPayload,
  conversationId,
  parseConversationId,
  mapBusinessProfile,
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
  const conversationTemplates = ref([])
  const businessFlows = ref([])
  const loadingTemplates = ref(false)
  const loadingFlows = ref(false)
  const templateError = ref('')
  const flowError = ref('')
  const loadingFaqs = ref(false)
  const faqError = ref('')
  const loadingLeads = ref(false)
  const loadingLeadDetail = ref(false)
  const leadListError = ref('')
  const leadDetailError = ref('')
  const loadingAppointments = ref(false)
  const onboardingProgress = ref(createOnboardingProgress(''))
  const onboardingLoaded = ref(false)
  /** EventSource for the live lead feed; closed on sign-out. */
  let leadStream = null
  let leadListRequestId = 0
  let leadDetailRequestId = 0
  const leadSessionVersion = ref(0)
  const activeLeadMutations = new Set()
  let faqSessionVersion = 0
  let faqListRequestId = 0
  const activeFaqMutations = new Set()
  let flowSessionVersion = 0
  let templateRequestId = 0
  let flowListRequestId = 0
  const activeFlowMutations = new Set()
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
  const businessProfileSaving = ref(false)
  const businessProfileError = ref('')
  const notificationCenterAvailable = ref(notificationCenterEnabled)
  const notifications = ref([])
  const notificationsLoading = ref(false)
  const notificationsError = ref('')
  const notificationsLoadedForBusinessId = ref('')
  const notificationMutationIds = ref([])
  const notificationsLastUpdatedAt = ref(0)
  const notificationUnreadCount = computed(() =>
    notificationCenterAvailable.value &&
    notificationsLoadedForBusinessId.value === businessId.value
      ? getUnreadNotificationCount(notifications.value)
      : 0,
  )
  let notificationSessionVersion = 0
  let notificationRequestId = 0
  let notificationRefreshPromise = null
  let notificationActiveRefreshId = 0
  const notificationMutationPromises = new Map()
  const escalationQueueAvailable = ref(agentEscalationQueueEnabled)
  const escalations = ref([])
  const escalationsLoading = ref(false)
  const escalationsRefreshing = ref(false)
  const escalationsError = ref('')
  const escalationsLoadedForBusinessId = ref('')
  const escalationClaimPendingIds = ref([])
  const escalationReleasePendingIds = ref([])
  const escalationsLastUpdatedAt = ref(0)
  let escalationSessionVersion = 0
  let escalationRefreshId = 0
  let escalationRefreshPromise = null
  let escalationMutationVersion = 0
  let escalationQueueRevision = 0
  let agentSocketGeneration = 0
  const escalationMutations = new Map()
  const analyticsAvailable = ref(analyticsEnabled)
  const analytics = ref(null)
  const analyticsLoading = ref(false)
  const analyticsRefreshing = ref(false)
  const analyticsError = ref('')
  const analyticsLoadedForBusinessId = ref('')
  const analyticsRangeKey = ref('')
  const analyticsLastUpdatedAt = ref(0)
  let analyticsSessionVersion = 0
  let analyticsRequestId = 0
  let analyticsRequest = null
  let analyticsRequestKey = ''
  const agentId = ref(localStorage.getItem(STORAGE.agentId) || '')
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

  function clearAnalyticsState() {
    analyticsSessionVersion += 1
    analyticsRequestId += 1
    analyticsRequest = null
    analyticsRequestKey = ''
    analytics.value = null
    analyticsLoading.value = false
    analyticsRefreshing.value = false
    analyticsError.value = ''
    analyticsLoadedForBusinessId.value = ''
    analyticsRangeKey.value = ''
    analyticsLastUpdatedAt.value = 0
  }

  function refreshAnalytics(range) {
    if (
      !analyticsAvailable.value ||
      !authenticated.value ||
      !businessId.value ||
      !isValidAnalyticsDateRange(range)
    )
      return Promise.resolve(null)
    const requestBusinessId = businessId.value
    const rangeKey = createAnalyticsRangeKey(range)
    const operationKey = `${requestBusinessId}|${rangeKey}`
    if (analyticsRequest && analyticsRequestKey === operationKey)
      return analyticsRequest
    const session = analyticsSessionVersion
    const requestId = ++analyticsRequestId
    const sameRange =
      analyticsLoadedForBusinessId.value === requestBusinessId &&
      analyticsRangeKey.value === rangeKey
    if (!sameRange) analytics.value = null
    analyticsLoading.value = !sameRange
    analyticsRefreshing.value = sameRange
    analyticsError.value = ''
    analyticsRequestKey = operationKey
    const request = gatewayApi
      .getBusinessAnalytics(requestBusinessId, range)
      .then((response) => {
        const mapped = mapAnalyticsResponse(response)
        if (!mapped) throw new Error('Gateway returned invalid analytics data')
        if (
          !analyticsAvailable.value ||
          !authenticated.value ||
          session !== analyticsSessionVersion ||
          requestId !== analyticsRequestId ||
          requestBusinessId !== businessId.value
        )
          return null
        analytics.value = mapped
        analyticsLoadedForBusinessId.value = requestBusinessId
        analyticsRangeKey.value = rangeKey
        analyticsLastUpdatedAt.value = Date.now()
        return mapped
      })
      .catch((error) => {
        if (
          analyticsAvailable.value &&
          authenticated.value &&
          session === analyticsSessionVersion &&
          requestId === analyticsRequestId &&
          requestBusinessId === businessId.value
        )
          analyticsError.value = friendlyErrorMessage(
            error,
            'We could not load your report. Please try again.',
          )
        throw error
      })
      .finally(() => {
        if (analyticsRequest === request) {
          analyticsRequest = null
          analyticsRequestKey = ''
        }
        if (
          session === analyticsSessionVersion &&
          requestId === analyticsRequestId &&
          requestBusinessId === businessId.value
        ) {
          analyticsLoading.value = false
          analyticsRefreshing.value = false
        }
      })
    analyticsRequest = request
    return request
  }

  function escalationRequestIsCurrent(version, requestBusinessId) {
    return (
      authenticated.value &&
      version === escalationSessionVersion &&
      requestBusinessId === businessId.value
    )
  }

  function cancelPendingEscalationMutations(reason = 'session_reset') {
    const cancellation = {
      success: false,
      cancelled: true,
      reason,
    }
    const pending = [...escalationMutations.values()]
    escalationMutations.clear()
    escalationClaimPendingIds.value = []
    escalationReleasePendingIds.value = []
    for (const mutation of pending) {
      clearTimeout(mutation.timer)
      mutation.resolve(cancellation)
    }
  }

  function clearEscalationState(reason = 'session_reset') {
    escalationSessionVersion += 1
    escalationRefreshId += 1
    escalationRefreshPromise = null
    escalationMutationVersion += 1
    escalationQueueRevision += 1
    cancelPendingEscalationMutations(reason)
    escalations.value = []
    escalationsLoading.value = false
    escalationsRefreshing.value = false
    escalationsError.value = ''
    escalationsLoadedForBusinessId.value = ''
    escalationClaimPendingIds.value = []
    escalationReleasePendingIds.value = []
    escalationsLastUpdatedAt.value = 0
  }

  function escalationQueuesMatch(left, right) {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  function applyEscalationSnapshot(
    payload,
    requestBusinessId = businessId.value,
    { realtime = false } = {},
  ) {
    if (
      !escalationQueueAvailable.value ||
      requestBusinessId !== businessId.value
    )
      return false
    const mapped = mapEscalationQueue(payload).filter(
      (item) => !item.businessId || item.businessId === requestBusinessId,
    )
    const next = mapped.map((item) => ({
      ...item,
      businessId: requestBusinessId,
    }))
    const changed = !escalationQueuesMatch(escalations.value, next)
    if (changed) {
      escalations.value = next
      if (realtime) escalationQueueRevision += 1
    }
    escalationsLoadedForBusinessId.value = requestBusinessId
    if (changed) escalationsLastUpdatedAt.value = Date.now()
    escalationsError.value = ''
    return changed
  }

  function upsertEscalation(source, { realtime = false } = {}) {
    const mapped = mapEscalation(source)
    if (
      !mapped ||
      (mapped.businessId && mapped.businessId !== businessId.value)
    )
      return null
    const next = { ...mapped, businessId: businessId.value }
    const existing = escalations.value.find((item) => item.id === next.id)
    if (existing && escalationQueuesMatch(existing, next)) return existing
    escalations.value = [
      ...escalations.value.filter((item) => item.id !== next.id),
      next,
    ]
    if (realtime) escalationQueueRevision += 1
    escalationsLastUpdatedAt.value = Date.now()
    return next
  }

  function removeEscalation(id, { realtime = false } = {}) {
    if (!escalations.value.some((item) => item.id === id)) return false
    escalations.value = escalations.value.filter((item) => item.id !== id)
    if (realtime) escalationQueueRevision += 1
    escalationsLastUpdatedAt.value = Date.now()
    return true
  }

  function applyConfirmedEscalationRelease(id, releasedAt) {
    const existing = escalations.value.find((item) => item.id === id)
    const conversation = conversations.value.find((item) => item.id === id)
    const alreadyQueued =
      existing?.status === 'queued' && !existing.claimedByAgentId
    const confirmedReleaseTime =
      (alreadyQueued && existing.releasedAt) ||
      releasedAt ||
      new Date().toISOString()

    if (existing) {
      upsertEscalation(
        {
          ...existing,
          business_id: businessId.value,
          escalation_status: 'queued',
          escalation_tag: existing.tag,
          escalation_summary: existing.summary,
          escalation_requested_at: existing.requestedAt,
          latest_message: existing.latestMessage,
          updated_at: existing.latestMessageAt,
          claimed_by_agent_id: '',
          claimedByAgentId: '',
          claimed_at: null,
          claimedAt: null,
          released_at: confirmedReleaseTime,
          releasedAt: confirmedReleaseTime,
        },
        { realtime: true },
      )
    }

    if (conversation) {
      conversation.escalated = true
      conversation.claimed = false
      conversation.claimedByAgentId = ''
      conversation.claimedByMe = false
      conversation.claimedByOther = false
      conversation.claimedAt = null
      conversation.claimed_at = null
      conversation.escalationStatus = 'queued'
      conversation.escalation_status = 'queued'
      conversation.releasedAt = confirmedReleaseTime
      conversation.released_at = confirmedReleaseTime
    }

    return existing ? escalations.value.find((item) => item.id === id) : null
  }

  function escalationBusinessId(source) {
    const value =
      source?.business_id ??
      source?.businessId ??
      source?.chat?.business_id ??
      source?.chat?.businessId
    return typeof value === 'string' ? value.trim() : ''
  }

  function isCurrentEscalationBusiness(source) {
    return Boolean(
      authenticated.value &&
      businessId.value &&
      escalationBusinessId(source) === businessId.value,
    )
  }

  function settleEscalationMutation(
    type,
    id,
    { value = null, error = '' } = {},
  ) {
    const key = `${type}:${id}`
    const mutation = escalationMutations.get(key)
    if (
      !mutation ||
      !escalationRequestIsCurrent(mutation.version, mutation.businessId)
    )
      return false
    clearTimeout(mutation.timer)
    escalationMutations.delete(key)
    if (type === 'claim') {
      escalationClaimPendingIds.value = escalationClaimPendingIds.value.filter(
        (item) => item !== id,
      )
    } else {
      escalationReleasePendingIds.value =
        escalationReleasePendingIds.value.filter((item) => item !== id)
    }
    if (error) {
      escalationsError.value = error
      mutation.resolve(null)
    } else {
      escalationMutationVersion += 1
      escalationsError.value = ''
      mutation.resolve(value)
    }
    return true
  }

  function refreshEscalations() {
    if (
      !escalationQueueAvailable.value ||
      !authenticated.value ||
      !businessId.value
    )
      return Promise.resolve(null)
    if (escalationRefreshPromise) return escalationRefreshPromise
    const version = escalationSessionVersion
    const requestBusinessId = businessId.value
    const requestId = ++escalationRefreshId
    const mutationAtStart = escalationMutationVersion
    const revisionAtStart = escalationQueueRevision
    const hasData = escalationsLoadedForBusinessId.value === requestBusinessId
    escalationsLoading.value = !hasData
    escalationsRefreshing.value = hasData
    escalationsError.value = ''
    const request = gatewayApi
      .getAgentQueue(requestBusinessId)
      .then((result) => {
        if (result?.success !== true || !Array.isArray(result.queue))
          throw new Error('Gateway returned an invalid escalation queue')
        if (
          !escalationRequestIsCurrent(version, requestBusinessId) ||
          requestId !== escalationRefreshId ||
          mutationAtStart !== escalationMutationVersion ||
          revisionAtStart !== escalationQueueRevision
        )
          return null
        applyEscalationSnapshot(result.queue, requestBusinessId)
        return escalations.value
      })
      .catch((error) => {
        if (
          escalationRequestIsCurrent(version, requestBusinessId) &&
          requestId === escalationRefreshId &&
          revisionAtStart === escalationQueueRevision
        )
          escalationsError.value = friendlyErrorMessage(
            error,
            'We could not load the escalation queue. Please try again.',
          )
        throw error
      })
      .finally(() => {
        if (escalationRefreshPromise === request)
          escalationRefreshPromise = null
        if (
          escalationRequestIsCurrent(version, requestBusinessId) &&
          requestId === escalationRefreshId
        ) {
          escalationsLoading.value = false
          escalationsRefreshing.value = false
        }
      })
    escalationRefreshPromise = request
    return request
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

  function loadOnboardingProgress() {
    const activeBusinessId = businessId.value
    onboardingProgress.value = activeBusinessId
      ? readOnboardingProgress(activeBusinessId)
      : createOnboardingProgress('')
    onboardingLoaded.value = Boolean(activeBusinessId)
    return onboardingProgress.value
  }

  function persistOnboardingProgress(next) {
    if (
      !businessId.value ||
      next?.businessId !== businessId.value ||
      onboardingProgress.value.businessId !== businessId.value
    )
      return null
    const saved = saveOnboardingProgress(next)
    if (!saved || saved.businessId !== businessId.value) return null
    onboardingProgress.value = saved
    onboardingLoaded.value = true
    return saved
  }

  function setOnboardingStep(step) {
    return persistOnboardingProgress({
      ...onboardingProgress.value,
      currentStep: step,
    })
  }

  function setOnboardingStepStatus(step, status) {
    const numericStep = Number(step)
    const keys = {
      completed: 'completedSteps',
      skipped: 'skippedSteps',
      blocked: 'blockedSteps',
    }
    const targetKey = keys[status]
    if (!targetKey) return null
    const next = {
      ...onboardingProgress.value,
      completedSteps: onboardingProgress.value.completedSteps.filter(
        (item) => item !== numericStep,
      ),
      skippedSteps: onboardingProgress.value.skippedSteps.filter(
        (item) => item !== numericStep,
      ),
      blockedSteps: onboardingProgress.value.blockedSteps.filter(
        (item) => item !== numericStep,
      ),
    }
    next[targetKey] = [...next[targetKey], numericStep]
    return persistOnboardingProgress(next)
  }

  function markOnboardingStepComplete(step) {
    return setOnboardingStepStatus(step, 'completed')
  }

  function markOnboardingStepBlocked(step) {
    return setOnboardingStepStatus(step, 'blocked')
  }

  function skipOnboardingStep(step) {
    return setOnboardingStepStatus(step, 'skipped')
  }

  function finishOnboardingLocally() {
    return persistOnboardingProgress({
      ...onboardingProgress.value,
      currentStep: 6,
      locallyFinished: true,
    })
  }

  function resetOnboardingProgress() {
    const activeBusinessId = businessId.value
    if (!activeBusinessId) return null
    removeOnboardingProgress(activeBusinessId)
    onboardingProgress.value = createOnboardingProgress(activeBusinessId)
    onboardingLoaded.value = true
    return onboardingProgress.value
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
      notify(
        friendlyErrorMessage(
          error,
          'We could not load your inbox. Please try again.',
        ),
        'error',
      )
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
      notify(
        friendlyErrorMessage(
          error,
          'We could not load these messages. Please try again.',
        ),
        'error',
      )
    }
  }

  function handleSocketEvent(event) {
    if (!event?.type) return

    const escalationEventTypes = new Set([
      'queue_snapshot',
      'chat_queued',
      'chat_claimed',
      'chat_released',
      'de_escalated',
      'claim_result',
      'release_result',
    ])
    if (
      escalationEventTypes.has(event.type) &&
      (!escalationQueueAvailable.value || !authenticated.value)
    )
      return

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
      if (typeof event.agent_id === 'string' && event.agent_id.trim()) {
        agentId.value = event.agent_id.trim()
        persistSession()
      }
      connectionStatus.value = 'online'
      notify('Agent channel connected')
      refreshConversations()
      if (escalationQueueAvailable.value) socketApi?.send({ type: 'get_queue' })
      return
    }

    if (event.type === 'auth_failed') {
      connectionStatus.value = 'error'
      notify(event.error || 'Agent auth failed', 'error')
      return
    }

    if (event.type === 'queue_snapshot' && Array.isArray(event.chats)) {
      const currentBusinessChats = event.chats.filter(
        isCurrentEscalationBusiness,
      )
      if (event.chats.length && !currentBusinessChats.length) return
      applyEscalationSnapshot(currentBusinessChats, businessId.value, {
        realtime: true,
      })
      for (const chat of currentBusinessChats) {
        upsertConversation({
          messenger_id: chat.messenger_id,
          platform: chat.platform,
          display_name: chat.display_name,
          is_escalated: true,
          escalation_status: chat.escalation_status,
          claimed_by_agent_id: chat.claimed_by_agent_id,
          escalation_requested_at: chat.escalation_requested_at,
          escalation_tag: chat.escalation_tag,
          escalation_summary: chat.escalation_summary,
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
      if (!isCurrentEscalationBusiness(event.chat)) return
      upsertEscalation(event.chat, { realtime: true })
      upsertConversation({
        messenger_id: event.chat.messenger_id,
        platform: event.chat.platform,
        display_name: event.chat.display_name,
        is_escalated: true,
        escalation_status: event.chat.escalation_status,
        claimed_by_agent_id: event.chat.claimed_by_agent_id,
        escalation_requested_at: event.chat.escalation_requested_at,
        escalation_tag: event.chat.escalation_tag,
        escalation_summary: event.chat.escalation_summary,
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
      if (!isCurrentEscalationBusiness(event)) return
      const id = conversationId(event.platform, event.messenger_id)
      const conversation = conversations.value.find((item) => item.id === id)
      if (conversation) {
        conversation.claimed = event.claimed_by_agent_id === agentId.value
        conversation.claimedByAgentId = event.claimed_by_agent_id || ''
        conversation.escalated = true
        conversation.unread = false
      }
      const existing = escalations.value.find((item) => item.id === id)
      if (existing)
        upsertEscalation(
          {
            ...existing,
            business_id: businessId.value,
            escalation_status: 'claimed',
            claimed_by_agent_id: event.claimed_by_agent_id,
          },
          { realtime: true },
        )
      if (event.claimed_by_agent_id === agentId.value) {
        settleEscalationMutation('claim', id, {
          value: escalations.value.find((item) => item.id === id) || null,
        })
      }
      return
    }

    if (event.type === 'chat_released') {
      if (!isCurrentEscalationBusiness(event)) return
      const id = conversationId(event.platform, event.messenger_id)
      const mutation = escalationMutations.get(`release:${id}`)
      applyConfirmedEscalationRelease(
        id,
        event.released_at ?? event.releasedAt ?? mutation?.startedAt,
      )
      if (event.released_by_agent_id === agentId.value) {
        settleEscalationMutation('release', id, { value: true })
      }
      return
    }

    if (event.type === 'de_escalated') {
      if (!isCurrentEscalationBusiness(event)) return
      const id = conversationId(event.platform, event.messenger_id)
      const conversation = conversations.value.find((item) => item.id === id)
      if (conversation) {
        conversation.escalated = false
        conversation.claimed = false
        conversation.claimedByAgentId = ''
        conversation.claimedByOther = false
      }
      removeEscalation(id, { realtime: true })
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
        // A queued chat is still handled by the AI — only a claim makes it a
        // human's chat, so never infer "claimed" from message traffic alone.
        escalation_status: event.escalation_status || 'claimed',
        claimed_by_agent_id:
          event.claimed_by_agent_id ??
          (event.from === 'agent' ? event.agent_id : null),
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
      const mutationKey = conversationId(event.platform, event.messenger_id)
      const mutation = escalationMutations.get(`claim:${mutationKey}`)
      if (
        !mutation ||
        !escalationRequestIsCurrent(mutation.version, mutation.businessId)
      )
        return
      if (!event.success) {
        const error = event.error || 'Could not claim conversation'
        settleEscalationMutation('claim', mutationKey, { error })
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
      const existing = escalations.value.find((item) => item.id === id)
      if (existing)
        upsertEscalation(
          {
            ...existing,
            business_id: mutation.businessId,
            escalation_status: 'claimed',
            claimed_by_agent_id: agentId.value,
            claimed_at: new Date().toISOString(),
          },
          { realtime: true },
        )
      settleEscalationMutation('claim', mutationKey, {
        value: escalations.value.find((item) => item.id === id) || null,
      })
      if (Array.isArray(event.history)) {
        messages.value[id] = event.history.map(mapHistoryMessage)
      }
      notify('Chat claimed — you can reply now')
      return
    }

    if (event.type === 'release_result') {
      const mutationKey = conversationId(event.platform, event.messenger_id)
      const mutation = escalationMutations.get(`release:${mutationKey}`)
      if (
        !mutation ||
        !escalationRequestIsCurrent(mutation.version, mutation.businessId)
      )
        return
      if (!event.success) {
        const error = event.error || 'Could not release conversation'
        settleEscalationMutation('release', mutationKey, { error })
        notify(event.error || 'Could not release chat', 'error')
        return
      }
      const id = conversationId(event.platform, event.messenger_id)
      applyConfirmedEscalationRelease(id, mutation.startedAt)
      settleEscalationMutation('release', mutationKey, { value: true })
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

  function applyEscalationEvent(event) {
    const allowed = new Set([
      'queue_snapshot',
      'chat_queued',
      'chat_claimed',
      'chat_released',
      'de_escalated',
      'claim_result',
      'release_result',
    ])
    if (!allowed.has(event?.type)) return false
    handleSocketEvent(event)
    return true
  }

  function connectAgentChannel() {
    if (!authenticated.value || !businessId.value) return
    socketApi?.close()
    const generation = ++agentSocketGeneration
    connectionStatus.value = 'connecting'
    socketApi = createAgentSocket({
      onEvent: (event) => {
        if (generation === agentSocketGeneration) handleSocketEvent(event)
      },
      onOpen: () => {
        if (generation === agentSocketGeneration)
          connectionStatus.value = 'connected'
      },
      onClose: () => {
        if (generation === agentSocketGeneration)
          connectionStatus.value = 'offline'
      },
      onError: () => {
        if (generation === agentSocketGeneration)
          connectionStatus.value = 'error'
      },
      onStateChange: (state) => {
        if (generation !== agentSocketGeneration) return
        if (state === 'connected') connectionStatus.value = 'online'
        else if (state === 'offline' || state === 'closed')
          connectionStatus.value = 'offline'
        else connectionStatus.value = state
      },
    })
  }

  function disconnectAgentChannel() {
    agentSocketGeneration += 1
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
      sector: normalizeBusinessSector(form.sector) || BUSINESS_SECTORS[0].value,
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

  function resetFlowTemplateState() {
    flowSessionVersion += 1
    templateRequestId += 1
    flowListRequestId += 1
    activeFlowMutations.clear()
    conversationTemplates.value = []
    businessFlows.value = []
    templateError.value = ''
    flowError.value = ''
    loadingTemplates.value = false
    loadingFlows.value = false
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
    resetFlowTemplateState()
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
    businessProfileSaving.value = false
    businessProfileError.value = ''
    clearNotificationState()
    clearEscalationState('logout')
    clearAnalyticsState()
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
    onboardingProgress.value = createOnboardingProgress('')
    onboardingLoaded.value = false
  }

  function setInboxView(view) {
    inboxView.value = view
    localStorage.setItem(STORAGE.inboxView, view)
  }

  function claimEscalation(id) {
    if (
      !escalationQueueAvailable.value ||
      !authenticated.value ||
      !businessId.value ||
      !agentId.value ||
      connectionStatus.value !== 'online'
    )
      return Promise.resolve(null)
    const escalation = escalations.value.find((item) => item.id === id)
    if (
      !escalation ||
      getEscalationOwnership(escalation, agentId.value) !== 'queued'
    )
      return Promise.resolve(null)
    const key = `claim:${id}`
    if (escalationMutations.has(key))
      return escalationMutations.get(key).promise
    const { platform, messenger_id } = parseConversationId(id)
    if (!platform || !messenger_id) return Promise.resolve(null)
    const version = escalationSessionVersion
    const requestBusinessId = businessId.value
    let resolve
    const promise = new Promise((done) => {
      resolve = done
    })
    const timer = setTimeout(() => {
      const active = escalationMutations.get(key)
      if (!active || active.promise !== promise) return
      escalationMutations.delete(key)
      escalationClaimPendingIds.value = escalationClaimPendingIds.value.filter(
        (item) => item !== id,
      )
      if (escalationRequestIsCurrent(version, requestBusinessId))
        escalationsError.value = 'Claim confirmation timed out'
      resolve(null)
    }, 12000)
    escalationMutations.set(key, {
      promise,
      resolve,
      reject: resolve,
      timer,
      version,
      businessId: requestBusinessId,
      startedAt: new Date().toISOString(),
    })
    escalationClaimPendingIds.value = [...escalationClaimPendingIds.value, id]
    const sent = socketApi?.send({
      type: 'claim_chat',
      platform,
      messenger_id,
      business_id: requestBusinessId,
    })
    if (!sent) {
      clearTimeout(timer)
      escalationMutations.delete(key)
      escalationClaimPendingIds.value = escalationClaimPendingIds.value.filter(
        (item) => item !== id,
      )
      escalationsError.value = 'Not connected to gateway'
      resolve(null)
    }
    return promise
  }

  function releaseEscalation(id) {
    if (
      !escalationQueueAvailable.value ||
      !authenticated.value ||
      !businessId.value ||
      !agentId.value ||
      connectionStatus.value !== 'online'
    )
      return Promise.resolve(null)
    const escalation = escalations.value.find((item) => item.id === id)
    if (
      !escalation ||
      getEscalationOwnership(escalation, agentId.value) !== 'mine'
    )
      return Promise.resolve(null)
    const key = `release:${id}`
    if (escalationMutations.has(key))
      return escalationMutations.get(key).promise
    const { platform, messenger_id } = parseConversationId(id)
    if (!platform || !messenger_id) return Promise.resolve(null)
    const version = escalationSessionVersion
    const requestBusinessId = businessId.value
    let resolve
    const promise = new Promise((done) => {
      resolve = done
    })
    const timer = setTimeout(() => {
      const active = escalationMutations.get(key)
      if (!active || active.promise !== promise) return
      escalationMutations.delete(key)
      escalationReleasePendingIds.value =
        escalationReleasePendingIds.value.filter((item) => item !== id)
      if (escalationRequestIsCurrent(version, requestBusinessId))
        escalationsError.value = 'Release confirmation timed out'
      resolve(null)
    }, 12000)
    escalationMutations.set(key, {
      promise,
      resolve,
      reject: resolve,
      timer,
      version,
      businessId: requestBusinessId,
      startedAt: new Date().toISOString(),
    })
    escalationReleasePendingIds.value = [
      ...escalationReleasePendingIds.value,
      id,
    ]
    const sent = socketApi?.send({
      type: 'release_chat',
      platform,
      messenger_id,
      business_id: requestBusinessId,
    })
    if (!sent) {
      clearTimeout(timer)
      escalationMutations.delete(key)
      escalationReleasePendingIds.value =
        escalationReleasePendingIds.value.filter((item) => item !== id)
      escalationsError.value = 'Not connected to gateway'
      resolve(null)
    }
    return promise
  }

  const claim = claimEscalation
  const release = releaseEscalation

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
      leadListError.value = friendlyErrorMessage(
        error,
        'We could not load your leads. Please try again.',
      )
      notify(
        friendlyErrorMessage(
          error,
          'We could not load your leads. Please try again.',
        ),
        'error',
      )
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
      leadDetailError.value = friendlyErrorMessage(
        error,
        'We could not load this lead. Please try again.',
      )
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
        notify(
          friendlyErrorMessage(
            error,
            'We could not save that change. Please try again.',
          ),
          'error',
        )
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
        notify(
          friendlyErrorMessage(
            error,
            'We could not assign this lead. Please try again.',
          ),
          'error',
        )
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
      notify(
        friendlyErrorMessage(
          error,
          'We could not load your appointments. Please try again.',
        ),
        'error',
      )
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
      notify(
        friendlyErrorMessage(
          error,
          'We could not book that appointment. Please try again.',
        ),
        'error',
      )
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
      notify(
        friendlyErrorMessage(
          error,
          'We could not update that appointment. Please try again.',
        ),
        'error',
      )
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

  async function saveBusinessProfile(changes) {
    if (!authenticated.value || !businessId.value)
      throw new Error('No active business session')
    if (!changes || !Object.keys(changes).length)
      throw new Error('No business profile changes to save')

    const requestBusinessId = businessId.value
    const sessionVersion = businessSessionVersion
    businessProfileSaving.value = true
    businessProfileError.value = ''
    try {
      const result = await gatewayApi.updateBusiness(requestBusinessId, changes)
      if (
        !authenticated.value ||
        sessionVersion !== businessSessionVersion ||
        businessId.value !== requestBusinessId
      )
        return null
      if (!result?.business || typeof result.business !== 'object')
        throw new Error('Gateway returned an invalid business profile response')

      const mapped = mapBusinessProfile(result.business)
      if (!mapped.id || mapped.id !== requestBusinessId) return null
      business.value = { ...business.value, ...result.business }
      businessName.value = mapped.name || businessName.value
      persistSession()
      notify('Business profile saved')
      return mapped
    } catch (error) {
      if (
        authenticated.value &&
        sessionVersion === businessSessionVersion &&
        businessId.value === requestBusinessId
      ) {
        businessProfileError.value = friendlyErrorMessage(
          error,
          'We could not save your business profile. Please try again.',
        )
        notify(businessProfileError.value, 'error')
      }
      throw error
    } finally {
      if (
        authenticated.value &&
        sessionVersion === businessSessionVersion &&
        businessId.value === requestBusinessId
      )
        businessProfileSaving.value = false
    }
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
      chatbotConfigError.value = friendlyErrorMessage(
        error,
        'We could not load your chatbot settings. Please try again.',
      )
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
        notify(
          friendlyErrorMessage(
            error,
            'We could not save your chatbot settings. Please try again.',
          ),
          'error',
        )
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
    return patchChatbotConfig(
      { chatbotEnabled: Boolean(enabled) },
      {
        successMessage: `Chatbot ${enabled ? 'enabled' : 'disabled'}`,
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
      faqError.value = friendlyErrorMessage(
        error,
        'We could not load your FAQs. Please try again.',
      )
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

  async function refreshConversationTemplates() {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = flowSessionVersion
    const requestBusinessId = businessId.value
    const requestId = ++templateRequestId
    loadingTemplates.value = true
    templateError.value = ''
    try {
      const result = await gatewayApi.listTemplates()
      if (
        requestId !== templateRequestId ||
        sessionVersion !== flowSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      if (!Array.isArray(result?.templates) || !Array.isArray(result?.stored)) {
        throw new Error('Gateway returned an invalid template list response')
      }
      conversationTemplates.value = result.templates.map((template) => {
        const stored = result.stored.find(
          (item) => item.id === template.id || item.sector === template.sector,
        )
        return mapConversationTemplate(template, stored)
      })
      return conversationTemplates.value
    } catch (error) {
      if (
        requestId !== templateRequestId ||
        sessionVersion !== flowSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      templateError.value = friendlyErrorMessage(
        error,
        'We could not load the templates. Please try again.',
      )
      throw error
    } finally {
      if (
        requestId === templateRequestId &&
        sessionVersion === flowSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      )
        loadingTemplates.value = false
    }
  }

  async function refreshBusinessFlows() {
    if (!authenticated.value || !businessId.value) {
      throw new Error('No active business session')
    }
    const sessionVersion = flowSessionVersion
    const requestBusinessId = businessId.value
    const requestId = ++flowListRequestId
    loadingFlows.value = true
    flowError.value = ''
    try {
      const result = await gatewayApi.listFlows(requestBusinessId)
      if (
        requestId !== flowListRequestId ||
        sessionVersion !== flowSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      if (!Array.isArray(result?.flows)) {
        throw new Error('Gateway returned an invalid flow list response')
      }
      if (result.flows.some((flow) => !flow?.id || !flow?.business_id)) {
        throw new Error('Gateway returned an invalid flow list response')
      }
      businessFlows.value = result.flows.map(mapConversationFlow)
      return businessFlows.value
    } catch (error) {
      if (
        requestId !== flowListRequestId ||
        sessionVersion !== flowSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      flowError.value = friendlyErrorMessage(
        error,
        'We could not load your conversation flows. Please try again.',
      )
      throw error
    } finally {
      if (
        requestId === flowListRequestId &&
        sessionVersion === flowSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      )
        loadingFlows.value = false
    }
  }

  async function attachConversationTemplate(template) {
    if (!authenticated.value || !businessId.value)
      throw new Error('No active business session')
    const sessionVersion = flowSessionVersion
    const requestBusinessId = businessId.value
    const sector = String(template?.sector || '')
    const mutationKey = `${sessionVersion}:attach:${sector}`
    if (activeFlowMutations.has(mutationKey))
      throw new Error('This template is already being attached')
    if (
      businessFlows.value.some(
        (flow) => flow.sector.toLowerCase() === sector.toLowerCase(),
      )
    ) {
      throw new Error('This template is already attached')
    }
    activeFlowMutations.add(mutationKey)
    flowError.value = ''
    try {
      const payload = { sector }
      if (agentId.value) payload.created_by = agentId.value
      const result = await gatewayApi.attachTemplate(requestBusinessId, payload)
      if (!result?.flow?.id)
        throw new Error('Gateway returned an invalid attached flow response')
      const created = mapConversationFlow(result.flow)
      if (
        sessionVersion !== flowSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return null
      if (created.businessId && created.businessId !== requestBusinessId)
        return null
      flowListRequestId += 1
      loadingFlows.value = false
      businessFlows.value.push(created)
      notify(`${created.name || 'Conversation template'} attached`)
      return created
    } catch (error) {
      if (
        sessionVersion === flowSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      ) {
        flowError.value = friendlyErrorMessage(
          error,
          'We could not attach that template. Please try again.',
        )
      }
      throw error
    } finally {
      activeFlowMutations.delete(mutationKey)
    }
  }

  async function updateBusinessFlow(flowId, changes) {
    if (!authenticated.value || !businessId.value)
      throw new Error('No active business session')
    const sessionVersion = flowSessionVersion
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:update:${flowId}`
    if (activeFlowMutations.has(mutationKey))
      throw new Error('This flow is already being updated')
    const index = businessFlows.value.findIndex((flow) => flow.id === flowId)
    if (index < 0) throw new Error('Flow not found')
    activeFlowMutations.add(mutationKey)
    const previous = { ...businessFlows.value[index] }
    businessFlows.value[index] = {
      ...previous,
      isActive: Boolean(changes.isActive),
    }
    flowError.value = ''
    try {
      const result = await gatewayApi.updateFlow(flowId, {
        is_active: Boolean(changes.isActive),
      })
      if (!result?.flow?.id)
        throw new Error('Gateway returned an invalid flow response')
      const updated = mapConversationFlow(result.flow)
      if (
        sessionVersion !== flowSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return updated
      flowListRequestId += 1
      loadingFlows.value = false
      const currentIndex = businessFlows.value.findIndex(
        (flow) => flow.id === flowId,
      )
      if (currentIndex >= 0) businessFlows.value[currentIndex] = updated
      notify(`Flow ${updated.isActive ? 'enabled' : 'disabled'}`)
      return updated
    } catch (error) {
      if (
        sessionVersion === flowSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      ) {
        const currentIndex = businessFlows.value.findIndex(
          (flow) => flow.id === flowId,
        )
        if (currentIndex >= 0) businessFlows.value[currentIndex] = previous
        flowError.value = friendlyErrorMessage(
          error,
          'We could not update that flow. Please try again.',
        )
      }
      throw error
    } finally {
      activeFlowMutations.delete(mutationKey)
    }
  }

  async function deleteBusinessFlow(flowId) {
    if (!authenticated.value || !businessId.value)
      throw new Error('No active business session')
    const sessionVersion = flowSessionVersion
    const requestBusinessId = businessId.value
    const mutationKey = `${sessionVersion}:delete:${flowId}`
    if (activeFlowMutations.has(mutationKey))
      throw new Error('This flow is already being deleted')
    activeFlowMutations.add(mutationKey)
    flowError.value = ''
    try {
      const result = await gatewayApi.deleteFlow(flowId)
      if (result?.success !== true)
        throw new Error('Gateway returned an invalid delete response')
      if (
        sessionVersion !== flowSessionVersion ||
        businessId.value !== requestBusinessId ||
        !authenticated.value
      )
        return
      flowListRequestId += 1
      loadingFlows.value = false
      businessFlows.value = businessFlows.value.filter(
        (flow) => flow.id !== flowId,
      )
      notify('Conversation flow deleted')
    } catch (error) {
      if (
        sessionVersion === flowSessionVersion &&
        businessId.value === requestBusinessId &&
        authenticated.value
      ) {
        flowError.value = friendlyErrorMessage(
          error,
          'We could not delete that flow. Please try again.',
        )
      }
      throw error
    } finally {
      activeFlowMutations.delete(mutationKey)
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
        notify(
          friendlyErrorMessage(
            error,
            'We could not save that FAQ. Please try again.',
          ),
          'error',
        )
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
        notify(
          friendlyErrorMessage(
            error,
            'We could not update that FAQ. Please try again.',
          ),
          'error',
        )
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
        notify(
          friendlyErrorMessage(
            error,
            'We could not delete that FAQ. Please try again.',
          ),
          'error',
        )
      throw error
    } finally {
      activeFaqMutations.delete(mutationKey)
    }
  }

  function clearNotificationState() {
    notificationSessionVersion += 1
    notificationRequestId += 1
    notificationRefreshPromise = null
    notificationActiveRefreshId = 0
    notificationMutationPromises.clear()
    notifications.value = []
    notificationsLoading.value = false
    notificationsError.value = ''
    notificationsLoadedForBusinessId.value = ''
    notificationMutationIds.value = []
    notificationsLastUpdatedAt.value = 0
  }

  function notificationRequestIsCurrent(sessionVersion, requestBusinessId) {
    return (
      sessionVersion === notificationSessionVersion &&
      authenticated.value &&
      businessId.value === requestBusinessId
    )
  }

  function invalidateNotificationRefresh(refreshId) {
    if (!refreshId || notificationActiveRefreshId !== refreshId) return
    notificationRequestId += 1
    notificationActiveRefreshId = 0
    notificationRefreshPromise = null
    notificationsLoading.value = false
  }

  function refreshNotifications() {
    if (
      !notificationCenterAvailable.value ||
      !authenticated.value ||
      !businessId.value
    )
      return Promise.resolve(null)
    if (notificationRefreshPromise) return notificationRefreshPromise

    const sessionVersion = notificationSessionVersion
    const requestBusinessId = businessId.value
    const requestId = ++notificationRequestId
    notificationActiveRefreshId = requestId
    notificationsLoading.value = true
    notificationsError.value = ''

    const request = gatewayApi
      .listNotifications(requestBusinessId)
      .then((result) => {
        if (
          requestId !== notificationRequestId ||
          !notificationRequestIsCurrent(sessionVersion, requestBusinessId)
        )
          return null
        if (
          !Array.isArray(result) &&
          !Array.isArray(result?.notifications) &&
          !Array.isArray(result?.data)
        )
          throw new Error('Gateway returned an invalid notifications response')
        const mapped = mapNotificationsResponse(result)
          .filter(
            (notification) =>
              !notification.businessId ||
              notification.businessId === requestBusinessId,
          )
          .map((notification) => ({
            ...notification,
            businessId: notification.businessId || requestBusinessId,
          }))
        notifications.value = mapped
        notificationsLoadedForBusinessId.value = requestBusinessId
        notificationsLastUpdatedAt.value = Date.now()
        return mapped
      })
      .catch((error) => {
        if (
          requestId === notificationRequestId &&
          notificationRequestIsCurrent(sessionVersion, requestBusinessId)
        )
          notificationsError.value = friendlyErrorMessage(
            error,
            'We could not load your notifications. Please try again.',
          )
        return null
      })
      .finally(() => {
        if (
          requestId === notificationRequestId &&
          notificationRequestIsCurrent(sessionVersion, requestBusinessId)
        )
          notificationsLoading.value = false
        if (notificationRefreshPromise === request)
          notificationRefreshPromise = null
        if (notificationActiveRefreshId === requestId)
          notificationActiveRefreshId = 0
      })
    notificationRefreshPromise = request
    return request
  }

  function markNotificationRead(notificationId) {
    if (
      !notificationCenterAvailable.value ||
      !authenticated.value ||
      !businessId.value
    )
      return Promise.resolve(null)
    const existing = notifications.value.find(
      (notification) => notification.id === notificationId,
    )
    if (
      !existing ||
      existing.isRead ||
      (existing.businessId && existing.businessId !== businessId.value)
    )
      return Promise.resolve(existing || null)
    if (notificationMutationPromises.has(notificationId))
      return notificationMutationPromises.get(notificationId)

    const sessionVersion = notificationSessionVersion
    const requestBusinessId = businessId.value
    const refreshIdAtMutationStart = notificationActiveRefreshId
    notificationMutationIds.value = [
      ...notificationMutationIds.value,
      notificationId,
    ]
    const request = gatewayApi
      .markNotificationRead(requestBusinessId, notificationId)
      .then((result) => {
        if (result?.success !== true)
          throw new Error('Gateway returned an invalid notification response')
        const returned = result.notification
          ? mapNotification(result.notification)
          : null
        if (
          result.notification &&
          (!returned ||
            returned.id !== notificationId ||
            (returned.businessId &&
              returned.businessId !== requestBusinessId) ||
            returned.isRead !== true)
        )
          throw new Error('Gateway returned a mismatched notification response')
        if (!notificationRequestIsCurrent(sessionVersion, requestBusinessId))
          return returned
        invalidateNotificationRefresh(refreshIdAtMutationStart)
        notifications.value = notifications.value.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                ...(returned || {}),
                businessId: requestBusinessId,
                isRead: true,
              }
            : notification,
        )
        return notifications.value.find(
          (notification) => notification.id === notificationId,
        )
      })
      .catch((error) => {
        if (notificationRequestIsCurrent(sessionVersion, requestBusinessId))
          notificationsError.value = friendlyErrorMessage(
            error,
            'We could not update that notification. Please try again.',
          )
        throw error
      })
      .finally(() => {
        if (notificationMutationPromises.get(notificationId) === request)
          notificationMutationPromises.delete(notificationId)
        if (notificationRequestIsCurrent(sessionVersion, requestBusinessId))
          notificationMutationIds.value = notificationMutationIds.value.filter(
            (id) => id !== notificationId,
          )
      })
    notificationMutationPromises.set(notificationId, request)
    return request
  }

  function markAllNotificationsRead() {
    const mutationKey = '__all__'
    if (
      !notificationCenterAvailable.value ||
      !authenticated.value ||
      !businessId.value ||
      notificationUnreadCount.value === 0
    )
      return Promise.resolve(null)
    if (notificationMutationPromises.has(mutationKey))
      return notificationMutationPromises.get(mutationKey)

    const sessionVersion = notificationSessionVersion
    const requestBusinessId = businessId.value
    const refreshIdAtMutationStart = notificationActiveRefreshId
    notificationMutationIds.value = [
      ...notificationMutationIds.value,
      mutationKey,
    ]
    const request = gatewayApi
      .markAllNotificationsRead(requestBusinessId)
      .then((result) => {
        if (result?.success !== true)
          throw new Error('Gateway returned an invalid notification response')
        if (!notificationRequestIsCurrent(sessionVersion, requestBusinessId))
          return null
        invalidateNotificationRefresh(refreshIdAtMutationStart)
        notifications.value = notifications.value.map((notification) => ({
          ...notification,
          isRead: true,
        }))
        return notifications.value
      })
      .catch((error) => {
        if (notificationRequestIsCurrent(sessionVersion, requestBusinessId))
          notificationsError.value = friendlyErrorMessage(
            error,
            'We could not update your notifications. Please try again.',
          )
        throw error
      })
      .finally(() => {
        if (notificationMutationPromises.get(mutationKey) === request)
          notificationMutationPromises.delete(mutationKey)
        if (notificationRequestIsCurrent(sessionVersion, requestBusinessId))
          notificationMutationIds.value = notificationMutationIds.value.filter(
            (id) => id !== mutationKey,
          )
      })
    notificationMutationPromises.set(mutationKey, request)
    return request
  }

  watch(
    businessId,
    (nextBusinessId, previousBusinessId) => {
      businessSessionVersion += 1
      businessProfileSaving.value = false
      businessProfileError.value = ''
      clearNotificationState()
      clearEscalationState(
        previousBusinessId && nextBusinessId !== previousBusinessId
          ? 'business_changed'
          : 'session_reset',
      )
      clearAnalyticsState()
      loadOnboardingProgress()
      if (
        previousBusinessId &&
        nextBusinessId !== previousBusinessId &&
        authenticated.value
      ) {
        disconnectAgentChannel()
        if (nextBusinessId) connectAgentChannel()
      }
    },
    { immediate: true, flush: 'sync' },
  )

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
    conversationTemplates,
    businessFlows,
    loadingTemplates,
    loadingFlows,
    templateError,
    flowError,
    selectedConversationId,
    toast,
    connectionStatus,
    businessId,
    businessName,
    business,
    businessProfileSaving,
    businessProfileError,
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
    onboardingProgress,
    onboardingLoaded,
    notificationCenterAvailable,
    notifications,
    notificationsLoading,
    notificationsError,
    notificationsLoadedForBusinessId,
    notificationMutationIds,
    notificationsLastUpdatedAt,
    notificationUnreadCount,
    escalationQueueAvailable,
    escalations,
    escalationsLoading,
    escalationsRefreshing,
    escalationsError,
    escalationsLoadedForBusinessId,
    escalationClaimPendingIds,
    escalationReleasePendingIds,
    escalationsLastUpdatedAt,
    analyticsAvailable,
    analytics,
    analyticsLoading,
    analyticsRefreshing,
    analyticsError,
    analyticsLoadedForBusinessId,
    analyticsRangeKey,
    analyticsLastUpdatedAt,
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
    saveBusinessProfile,
    refreshFaqs,
    refreshConversationTemplates,
    refreshBusinessFlows,
    attachConversationTemplate,
    updateBusinessFlow,
    deleteBusinessFlow,
    resetFlowTemplateState,
    createFaq,
    updateFaq,
    deleteFaq,
    loadOnboardingProgress,
    setOnboardingStep,
    markOnboardingStepComplete,
    markOnboardingStepBlocked,
    skipOnboardingStep,
    finishOnboardingLocally,
    resetOnboardingProgress,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotificationState,
    refreshEscalations,
    claimEscalation,
    releaseEscalation,
    applyEscalationSnapshot,
    applyEscalationEvent,
    clearEscalationState,
    refreshAnalytics,
    clearAnalyticsState,
    connectAgentChannel,
  }
})
