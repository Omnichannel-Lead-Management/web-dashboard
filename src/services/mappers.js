function initialsFrom(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function channelLabel(platform = '') {
  const normalized = platform.toLowerCase()
  if (normalized === 'telegram') return 'Telegram'
  if (normalized === 'whatsapp') return 'WhatsApp'
  if (normalized === 'web') return 'Web'
  return platform || 'Channel'
}

function faqKeywords(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Older records used comma-separated text instead of a JSON array.
  }

  return value.split(',')
}

function faqBoolean(value) {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return Boolean(value)
}

function faqTimestamp(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (Number.isInteger(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/** chatbot-builder FAQ record -> the stable shape used by settings. */
export function mapFaq(faq = {}) {
  const keywords = faqKeywords(faq.keywords ?? faq.keyword_list)
    .map((keyword) => String(keyword).trim())
    .filter(Boolean)

  return {
    id: faq.id,
    businessId: faq.business_id ?? faq.businessId ?? '',
    question: String(faq.question ?? ''),
    answer: String(faq.answer ?? ''),
    keywords,
    enabled: faqBoolean(faq.enabled),
    createdAt: faqTimestamp(faq.created_at ?? faq.createdAt),
    updatedAt: faqTimestamp(faq.updated_at ?? faq.updatedAt),
  }
}

/** Form FAQ -> documented gateway request contract. */
export function toFaqPayload(faq) {
  const seenKeywords = new Set()
  return {
    question: String(faq.question ?? '').trim(),
    answer: String(faq.answer ?? '').trim(),
    keywords: (faq.keywords || [])
      .map((keyword) => String(keyword).trim())
      .filter((keyword) => {
        const normalized = keyword.toLowerCase()
        if (!keyword || seenKeywords.has(normalized)) return false
        seenKeywords.add(normalized)
        return true
      }),
    enabled: faq.enabled !== false,
  }
}

export function faqPayloadWithPendingKeyword(faq, pendingKeyword = '') {
  return toFaqPayload({
    ...faq,
    keywords: [...(faq.keywords || []), pendingKeyword],
  })
}

export function faqEditorDraft(faq = {}) {
  return {
    question: String(faq.question ?? ''),
    answer: String(faq.answer ?? ''),
    keywords: Array.isArray(faq.keywords) ? [...faq.keywords] : [],
    enabled: faq.enabled !== false,
    keywordInput: '',
  }
}

function configBoolean(value, fallback = true) {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function whatsappBoolean(value, fallback = false) {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function telegramSource(response) {
  return response?.data ?? response?.result ?? response
}

/** Verified Telegram connect response -> secret-free settings state. */
export function mapTelegramConnection(response = {}) {
  const source = telegramSource(response) || {}
  const success = response?.success ?? source.success
  if (success !== true || source.ok !== true) {
    throw new Error('Gateway returned an invalid Telegram connection response')
  }
  return {
    connected: true,
    botUsername: String(source.bot_username ?? '').trim(),
  }
}

function flowBoolean(value, fallback = true) {
  if (value === true || value === 1 || value === '1') return true
  if (value === false || value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function flowTimestamp(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function parsedFlowJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

export function mapConversationTemplate(template = {}, stored = null) {
  return {
    id: String(template.id ?? ''),
    name: String(template.name ?? '').trim(),
    sector: String(template.sector ?? '').trim(),
    triggerIntents: Array.isArray(template.trigger_intents)
      ? [...template.trigger_intents].map(String)
      : [],
    flowJson: parsedFlowJson(stored?.flow ?? stored?.flow_json),
  }
}

export function mapConversationFlow(source = {}) {
  const rawFlow = source.flow ?? source.flow_json
  const flowJson = parsedFlowJson(rawFlow)
  return {
    id: String(source.id ?? ''),
    businessId: String(source.business_id ?? source.businessId ?? ''),
    name: String(source.name ?? '').trim(),
    sector: String(source.sector ?? '').trim(),
    isActive: flowBoolean(source.is_active ?? source.isActive, true),
    isTemplate: flowBoolean(source.is_template ?? source.isTemplate, false),
    flowJson,
    flowError:
      rawFlow !== undefined && !flowJson ? 'This flow has malformed step data.' : '',
    triggerIntents: Array.isArray(source.trigger_intents)
      ? [...source.trigger_intents].map(String)
      : [],
    createdBy: String(source.created_by ?? source.createdBy ?? ''),
    createdAt: flowTimestamp(source.created_at ?? source.createdAt),
    updatedAt: flowTimestamp(source.updated_at ?? source.updatedAt),
  }
}

function nodeText(node) {
  return String(node.content ?? node.message ?? '').trim()
}

/** Deterministic, bounded graph traversal for the read-only owner view. */
export function mapFlowSteps(flowJson, maxSteps = 100) {
  if (!flowJson || typeof flowJson !== 'object' || !Array.isArray(flowJson.nodes)) {
    throw new Error('This flow has malformed step data.')
  }
  const nodes = new Map(
    flowJson.nodes
      .filter((node) => node && typeof node.id === 'string')
      .map((node) => [node.id, node]),
  )
  const start = typeof flowJson.start === 'string' ? flowJson.start : flowJson.nodes[0]?.id
  if (!start) return []
  const visited = new Set()
  const steps = []

  function walk(id, branchLabel = '') {
    if (!id || visited.has(id) || steps.length >= maxSteps) return
    const node = nodes.get(id)
    if (!node) {
      steps.push({
        id,
        order: steps.length + 1,
        type: 'missing',
        title: 'Missing referenced step',
        text: `The flow references “${id}”, but that step is unavailable.`,
        branchLabel,
      })
      return
    }
    visited.add(id)
    const labels = {
      message: 'Bot message',
      question: 'Customer question',
      branch: 'Conditional branch',
      action: 'Automation action',
      escalate: 'Human handoff',
      trigger_service: 'Service handoff',
    }
    const text = nodeText(node)
    steps.push({
      id: node.id,
      order: steps.length + 1,
      type: String(node.type || 'step'),
      title: labels[node.type] || 'Conversation step',
      text:
        text ||
        (node.type === 'action'
          ? String(node.action || 'Run automation')
          : node.type === 'branch'
            ? 'Choose a path based on the customer response.'
            : 'Continue the conversation.'),
      branchLabel,
    })
    if (node.type === 'branch' && Array.isArray(node.conditions)) {
      node.conditions.forEach((condition) => {
        const label = condition.default === true
          ? 'Otherwise'
          : `When response includes “${String(condition.keyword ?? '')}”`
        walk(condition.next, label)
      })
    } else {
      walk(node.next)
    }
  }

  walk(start)
  return steps
}

function whatsappSource(response) {
  return response?.data ?? response?.result ?? response
}

function qrImageSource(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  const dataUri = trimmed.match(
    /^data:image\/(?:png|jpeg|jpg|webp);base64,([a-z0-9+/=\s]+)$/i,
  )
  if (dataUri) {
    const compactPayload = dataUri[1].replace(/\s/g, '')
    if (
      compactPayload.length >= 16 &&
      compactPayload.length % 4 === 0 &&
      /^[a-z0-9+/]+={0,2}$/i.test(compactPayload)
    ) {
      return `${trimmed.slice(0, trimmed.indexOf(',') + 1)}${compactPayload}`
    }
    return ''
  }
  const compact = trimmed.replace(/\s/g, '')
  if (
    compact.length >= 16 &&
    compact.length % 4 === 0 &&
    /^[a-z0-9+/]+={0,2}$/i.test(compact)
  ) {
    return `data:image/png;base64,${compact}`
  }
  return ''
}

/** Gateway Evolution instance creation response -> stable connection state. */
export function mapWhatsAppConnection(response = {}) {
  const source = whatsappSource(response) || {}
  return {
    connected: whatsappBoolean(source.connected, false),
    instanceName: String(source.instance_name ?? source.instanceName ?? ''),
    qrImage: qrImageSource(source.qrcode ?? source.qrImage),
    expiresAt: null,
    status: String(source.status ?? ''),
  }
}

/** Gateway Evolution QR response. Throws instead of exposing a broken image. */
export function mapWhatsAppQr(response = {}) {
  const source = whatsappSource(response) || {}
  const qrImage = qrImageSource(source.qrcode ?? source.qrImage)
  if (!qrImage) throw new Error('Gateway returned an invalid WhatsApp QR code')
  return { qrImage, expiresAt: null }
}

/** Gateway Evolution connection-state response -> stable status state. */
export function mapWhatsAppStatus(response = {}) {
  const source = whatsappSource(response) || {}
  return {
    connected: whatsappBoolean(source.connected, false),
    instanceName: String(source.instance_name ?? source.instanceName ?? ''),
    status: String(source.status ?? ''),
  }
}

/** chatbot-builder business config -> stable settings state. */
export function mapChatbotConfig(response = {}) {
  const source = response?.config ?? response
  return {
    businessId: source?.business_id ?? source?.businessId ?? '',
    chatbotEnabled: configBoolean(
      source?.chatbot_enabled ?? source?.chatbotEnabled,
      true,
    ),
    welcomeMessage: String(
      source?.welcome_message ?? source?.welcomeMessage ?? '',
    ),
    escalationMessage: String(
      source?.escalation_message ?? source?.escalationMessage ?? '',
    ),
    updatedAt: faqTimestamp(source?.updated_at ?? source?.updatedAt),
  }
}

/** Settings draft -> partial chatbot-builder PATCH contract. */
export function toChatbotConfigPatch(changes = {}) {
  const patch = {}
  if ('chatbotEnabled' in changes) {
    patch.chatbot_enabled = Boolean(changes.chatbotEnabled)
  }
  if ('welcomeMessage' in changes) {
    patch.welcome_message = String(changes.welcomeMessage ?? '').trim()
  }
  if ('escalationMessage' in changes) {
    patch.escalation_message = String(changes.escalationMessage ?? '').trim()
  }
  return patch
}

export function conversationId(platform, messengerId) {
  return `${platform}:${messengerId}`
}

export function parseConversationId(id) {
  const index = String(id).indexOf(':')
  if (index <= 0) return { platform: '', messenger_id: id }
  return {
    platform: id.slice(0, index),
    messenger_id: id.slice(index + 1),
  }
}

export function mapConversation(summary) {
  const id = conversationId(summary.platform, summary.messenger_id)
  const claimed =
    summary.escalation_status === 'claimed' ||
    Boolean(summary.claimed_by_agent_id)

  return {
    id,
    messenger_id: summary.messenger_id,
    platform: summary.platform,
    name: summary.display_name || summary.messenger_id,
    handle: summary.messenger_id,
    initials: initialsFrom(summary.display_name || summary.messenger_id),
    channel: channelLabel(summary.platform),
    time: formatTime(summary.updated_at || summary.last_message?.created_at),
    preview: summary.last_message?.text || 'No messages yet',
    status: summary.is_escalated
      ? claimed
        ? 'contacted'
        : 'qualified'
      : 'new',
    score: summary.is_escalated ? 60 : 20,
    unread: Boolean(summary.is_escalated && !claimed),
    escalated: Boolean(summary.is_escalated),
    claimed,
    language: 'EN',
    email: 'Not provided',
    phone: 'Not provided',
    location: '—',
    interest: summary.is_escalated ? 'Needs human help' : 'Bot conversation',
  }
}

/** Compact age like the inbox uses: 45s, 12m, 3h, 5d. */
function relativeAge(timestamp) {
  if (!timestamp) return ''
  const parsed =
    typeof timestamp === 'number' || /^\d+$/.test(String(timestamp))
      ? Number(timestamp)
      : new Date(timestamp).getTime()
  if (Number.isNaN(parsed)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function formatDate(timestamp) {
  if (!timestamp) return '—'
  const value =
    typeof timestamp === 'number' || /^\d+$/.test(String(timestamp))
      ? Number(timestamp)
      : timestamp
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Lead Manager row -> the shape LeadTable/LeadDetailView render.
 *
 * Lead Manager is the system of record for leads only; it never sees a customer's
 * display name or contact details, so those stay placeholders rather than being
 * invented here. `messenger_id` is the identity an agent can actually act on.
 */
export function mapLead(lead) {
  const source = lead || {}
  const name = source.display_name || source.messenger_id || 'Unknown'

  return {
    id: source.id,
    businessId: source.business_id ?? '',
    business_id: source.business_id,
    messenger_id: source.messenger_id,
    platform: source.platform,
    name,
    initials: initialsFrom(name),
    channel: channelLabel(source.platform),
    status: source.status || 'new',
    score: source.score ?? 0,
    interest: source.service_interest || 'Not specified',
    serviceInterest: source.service_interest ?? '',
    agent: source.assigned_agent_id || 'Unassigned',
    assignedAgentId: source.assigned_agent_id ?? null,
    assigned_agent_id: source.assigned_agent_id ?? null,
    age: relativeAge(source.created_at),
    created: formatDate(source.created_at),
    notes: source.notes ?? '',
    tags: Array.isArray(source.tags) ? [...source.tags] : [],
    source: source.source ?? '',
    channelSource: source.channel_source ?? '',
    budgetRange: source.budget_range ?? null,
    budget_range: source.budget_range ?? null,
    conversionValue: source.conversion_value ?? null,
    createdAt: source.created_at ?? null,
    updatedAt: source.updated_at ?? null,
    lastContactAt: source.last_contact_at ?? null,
    convertedAt: source.converted_at ?? null,
    email: 'Not provided',
    phone: 'Not provided',
    location: '—',
  }
}

/** Activity trail entry from GET /api/leads/:id. */
export function mapLeadActivity(activity) {
  const source = activity || {}
  return {
    id: source.id,
    type: source.activity_type ?? source.action ?? source.type ?? '',
    description: source.description ?? '',
    by: source.performed_by ?? '',
    createdAt: source.created_at ?? null,
    at: formatDate(source.created_at),
    age: relativeAge(source.created_at),
    metadata: source.metadata ?? null,
  }
}

export function retainVisibleLeadSelection(selectedIds, visibleIds) {
  const visible = new Set(visibleIds)
  return selectedIds.filter((id) => visible.has(id))
}

export function filterVisibleLeads(
  leads,
  { search = '', status = '', channel = 'All' } = {},
) {
  const normalizedSearch = search.trim().toLowerCase()
  return leads.filter((lead) => {
    const searchableText =
      `${lead.name ?? ''} ${lead.id ?? ''} ${lead.interest ?? ''}`.toLowerCase()
    const matchesSearch =
      !normalizedSearch || searchableText.includes(normalizedSearch)
    const matchesStatus = !status || lead.status === status
    const matchesChannel = channel === 'All' || lead.channel === channel
    return matchesSearch && matchesStatus && matchesChannel
  })
}

export function summarizeBulkLeadResults(ids, results) {
  const succeededIds = []
  const failedIds = []
  results.forEach((result, index) => {
    const target = result.status === 'fulfilled' ? succeededIds : failedIds
    target.push(ids[index])
  })
  return { succeededIds, failedIds }
}

export function isLeadListRequestCurrent(requestId, latestRequestId) {
  return requestId === latestRequestId
}

export function leadStatusDrafts(lead) {
  return {
    status: lead?.status || 'new',
    conversionValue:
      lead?.conversionValue == null ? '' : String(lead.conversionValue),
  }
}

export function normalizeConversionValue(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null
  }
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : Number.NaN
}

export function hasConversionValueChanged(draft, currentValue) {
  return !Object.is(
    normalizeConversionValue(draft),
    normalizeConversionValue(currentValue),
  )
}

export function buildLeadStatusPatch({
  currentStatus,
  currentConversionValue,
  status,
  conversionValue,
}) {
  const statusChanged = status !== currentStatus
  const conversionChanged = hasConversionValueChanged(
    conversionValue,
    currentConversionValue,
  )
  const conversionRequired = status === 'converted'
  const normalizedConversion = normalizeConversionValue(conversionValue)
  const conversionValid =
    normalizedConversion !== null &&
    Number.isFinite(normalizedConversion) &&
    normalizedConversion >= 0

  if (!statusChanged && !(conversionRequired && conversionChanged)) {
    return { patch: null, error: '' }
  }
  if (conversionRequired && !conversionValid) {
    return {
      patch: null,
      error: 'Enter a valid conversion value of zero or more.',
    }
  }

  const patch = {}
  if (statusChanged) patch.status = status
  if (conversionRequired && (statusChanged || conversionChanged)) {
    patch.conversion_value = normalizedConversion
  }
  return { patch, error: '' }
}

/**
 * Appointment row -> the shape AppointmentsView renders. The service stores
 * start_time/end_time as ISO strings; the UI wants them split into a day label
 * and a 12-hour clock.
 */
export function mapAppointment(appointment) {
  // The Appointment service serialises camelCase (startTime/customerName), unlike
  // Lead Manager's snake_case rows. Accept both so this does not silently render
  // "Unknown / Unscheduled" if either side changes its casing.
  const startTime = appointment.startTime ?? appointment.start_time
  const endTime = appointment.endTime ?? appointment.end_time
  const start = new Date(startTime)
  const valid = !Number.isNaN(start.getTime())
  const today = new Date()
  const isToday = valid && start.toDateString() === today.toDateString()

  const dayLabel = valid
    ? start.toLocaleDateString([], {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
      })
    : 'Unscheduled'

  const hours = valid ? start.getHours() : 0
  const minutes = valid ? String(start.getMinutes()).padStart(2, '0') : '00'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12

  return {
    id: appointment.id,
    startTime: startTime || null,
    endTime: endTime || null,
    date: valid ? start.toISOString().slice(0, 10) : '',
    day: isToday ? `Today · ${dayLabel}` : dayLabel,
    time: `${hour12}:${minutes}`,
    ampm: hours >= 12 ? 'PM' : 'AM',
    customer:
      appointment.customerName || appointment.customer_name || 'Unknown',
    service: appointment.service || '—',
    duration: durationLabel(startTime, endTime),
    status: appointment.status || 'pending',
    staff: appointment.staff || '—',
    notes: appointment.notes || '',
  }
}

export function mapAvailability(response) {
  const data = response?.data
  if (!data || typeof data !== 'object') {
    return { businessId: '', date: '', slots: [] }
  }

  const slots = Array.isArray(data.slots)
    ? data.slots.flatMap((slot) => {
        if (
          typeof slot?.startTime !== 'string' ||
          typeof slot?.endTime !== 'string'
        ) {
          return []
        }
        const start = new Date(slot?.startTime)
        const end = new Date(slot?.endTime)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return []
        }
        return [
          {
            startTime: slot.startTime,
            endTime: slot.endTime,
            label: start.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            }),
          },
        ]
      })
    : []

  return {
    businessId: typeof data.businessId === 'string' ? data.businessId : '',
    date: typeof data.date === 'string' ? data.date : '',
    slots,
  }
}

export function selectAppointmentSlot(form, slot) {
  return {
    ...form,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }
}

export function clearAppointmentSlot(form) {
  return { ...form, startTime: '', endTime: '' }
}

export function isAvailabilityRequestCurrent({
  requestDate,
  selectedDate,
  requestId,
  latestRequestId,
}) {
  return requestDate === selectedDate && requestId === latestRequestId
}

export function isAppointmentSubmissionReady(
  form,
  { availabilityLoading = false, submitting = false } = {},
) {
  return Boolean(
    form.customer?.trim() &&
    form.service &&
    form.date &&
    form.startTime &&
    form.endTime &&
    !availabilityLoading &&
    !submitting,
  )
}

export function isAvailabilityFullyBooked({
  date,
  slots,
  loading = false,
  error = '',
}) {
  return Boolean(date && !loading && !error && slots.length === 0)
}

export function appointmentStatusActions(status) {
  if (status === 'pending') return ['confirmed', 'cancelled']
  if (status === 'confirmed') return ['completed', 'cancelled']
  return []
}

export function filterAppointmentsByStatus(appointments, status) {
  if (!status || status === 'all') return [...appointments]
  return appointments.filter((appointment) => appointment.status === status)
}

function appointmentTimestamp(appointment) {
  const value = appointment.endTime || appointment.startTime
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export function splitAppointmentsByTime(appointments, now = Date.now()) {
  const upcoming = []
  const past = []

  for (const appointment of appointments) {
    const timestamp = appointmentTimestamp(appointment)
    if (timestamp !== null && timestamp < now) past.push(appointment)
    else upcoming.push(appointment)
  }

  upcoming.sort(
    (left, right) =>
      (appointmentTimestamp(left) ?? Number.POSITIVE_INFINITY) -
      (appointmentTimestamp(right) ?? Number.POSITIVE_INFINITY),
  )
  past.sort(
    (left, right) =>
      (appointmentTimestamp(right) ?? Number.NEGATIVE_INFINITY) -
      (appointmentTimestamp(left) ?? Number.NEGATIVE_INFINITY),
  )

  return { upcoming, past }
}

/**
 * AppointmentForm shape -> the Appointment service's create contract.
 *
 * The form collects a date, a 12-hour time and a "60 min" duration string; the
 * service wants businessId/customerName/startTime/endTime as ISO instants. Doing
 * the conversion here keeps the form free of API concerns — and keeps the two
 * from drifting silently, since a mismatch is a 400 rather than a wrong booking.
 */
export function toAppointmentPayload(form, businessId) {
  const selectedStart = new Date(form.startTime)
  const selectedEnd = new Date(form.endTime)
  if (
    form.startTime &&
    form.endTime &&
    !Number.isNaN(selectedStart.getTime()) &&
    !Number.isNaN(selectedEnd.getTime())
  ) {
    return {
      businessId,
      customerName: form.customer,
      service: form.service,
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes || undefined,
    }
  }

  const [rawHour, rawMinute = '0'] = String(form.time || '').split(':')
  let hour = Number(rawHour)
  if (form.ampm === 'PM' && hour < 12) hour += 12
  if (form.ampm === 'AM' && hour === 12) hour = 0

  const start = new Date(`${form.date}T00:00:00`)
  start.setHours(hour, Number(rawMinute) || 0, 0, 0)

  const minutes = Number.parseInt(String(form.duration), 10)
  const end = new Date(
    start.getTime() + (Number.isFinite(minutes) ? minutes : 60) * 60000,
  )

  return {
    businessId,
    customerName: form.customer,
    service: form.service,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    notes: form.notes || undefined,
  }
}

function durationLabel(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—'
  const minutes = Math.round((end - start) / 60000)
  return minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60} hr`
    : `${minutes} min`
}

/**
 * Voice notes and photos are transcribed/described to text by the gateway, so the
 * body is already readable here. `kind` only drives a badge — it tells the agent
 * the words came from a transcript (which can be imperfect) rather than typing.
 */
function mediaKind(metadata) {
  if (!metadata) return null
  const parsed =
    typeof metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(metadata)
          } catch {
            return null
          }
        })()
      : metadata
  const type = parsed?.type
  return type === 'voice' || type === 'audio'
    ? 'voice'
    : type === 'photo' || type === 'image'
      ? 'photo'
      : null
}

export function mapHistoryMessage(entry) {
  const sender =
    entry.from === 'user'
      ? 'customer'
      : entry.from === 'agent'
        ? 'agent'
        : 'bot'

  return {
    id: entry.id ?? `${entry.timestamp}-${entry.from}`,
    sender,
    text: entry.text,
    kind: mediaKind(entry.metadata),
    time: formatTime(entry.timestamp),
  }
}
