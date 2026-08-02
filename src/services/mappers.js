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
  if (!Number.isInteger(numeric)) return null
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
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
  return {
    question: String(faq.question ?? '').trim(),
    answer: String(faq.answer ?? '').trim(),
    keywords: [
      ...new Set(
        (faq.keywords || [])
          .map((keyword) => String(keyword).trim())
          .filter(Boolean),
      ),
    ],
    enabled: faq.enabled !== false,
  }
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
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Number(timestamp)) / 1000),
  )
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function formatDate(timestamp) {
  if (!timestamp) return '—'
  const date = new Date(Number(timestamp))
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
  const name = lead.display_name || lead.messenger_id || 'Unknown'

  return {
    id: lead.id,
    business_id: lead.business_id,
    messenger_id: lead.messenger_id,
    platform: lead.platform,
    name,
    initials: initialsFrom(name),
    channel: channelLabel(lead.platform),
    status: lead.status,
    score: lead.score ?? 0,
    interest: lead.service_interest || 'Not specified',
    agent: lead.assigned_agent_id || 'Unassigned',
    assigned_agent_id: lead.assigned_agent_id || null,
    age: relativeAge(lead.created_at),
    created: formatDate(lead.created_at),
    notes: lead.notes || 'No notes yet.',
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    source: lead.source || '',
    budget_range: lead.budget_range || '',
    email: 'Not provided',
    phone: 'Not provided',
    location: '—',
  }
}

/** Activity trail entry from GET /api/leads/:id. */
export function mapLeadActivity(activity) {
  return {
    id: activity.id,
    type: activity.activity_type,
    description: activity.description,
    by: activity.performed_by || 'system',
    at: formatDate(activity.created_at),
    age: relativeAge(activity.created_at),
  }
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
    businessId:
      typeof data.businessId === 'string' ? data.businessId : '',
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
