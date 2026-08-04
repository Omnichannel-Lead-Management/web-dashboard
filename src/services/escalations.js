import { conversationId } from './mappers'

const clean = (value, max = 1000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const date = (value) => {
  const parsed =
    typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : null
  return parsed && Number.isFinite(parsed.getTime())
    ? parsed.toISOString()
    : null
}

export function normalizeEscalationStatus(value) {
  return value === 'claimed'
    ? 'claimed'
    : value === 'queued'
      ? 'queued'
      : 'unknown'
}

export function mapEscalation(source) {
  if (!source || typeof source !== 'object') return null
  const platform = clean(source.platform, 50).toLowerCase()
  const messengerId = clean(source.messenger_id ?? source.messengerId, 300)
  const stableId =
    clean(source.conversation_id ?? source.conversationId, 500) ||
    (platform && messengerId ? conversationId(platform, messengerId) : '')
  if (!stableId || !platform || !messengerId) return null
  const businessId = clean(source.business_id ?? source.businessId, 300)
  const customerName =
    clean(
      source.display_name ??
        source.displayName ??
        source.customer_name ??
        source.customerName,
      300,
    ) || messengerId
  return {
    id: stableId,
    conversationId: stableId,
    businessId,
    platform,
    messengerId,
    customerName,
    customerHandle: clean(
      source.username ?? source.customer_handle ?? source.customerHandle,
      300,
    ),
    avatarText: customerName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
    status: normalizeEscalationStatus(
      source.escalation_status ?? source.escalationStatus,
    ),
    claimedByAgentId: clean(
      source.claimed_by_agent_id ?? source.claimedByAgentId,
      300,
    ),
    claimedAt: date(source.claimed_at ?? source.claimedAt),
    requestedAt: date(
      source.escalation_requested_at ?? source.escalationRequestedAt,
    ),
    releasedAt: date(source.released_at ?? source.releasedAt),
    tag: clean(source.escalation_tag ?? source.escalationTag, 200),
    summary: clean(source.escalation_summary ?? source.escalationSummary, 2000),
    latestMessage: clean(
      source.latest_message ??
        source.latestMessage ??
        source.escalation_summary ??
        source.escalationSummary,
      1000,
    ),
    latestMessageAt: date(source.updated_at ?? source.updatedAt),
  }
}

export function mapEscalationQueue(value) {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(value?.queue)
      ? value.queue
      : Array.isArray(value?.chats)
        ? value.chats
        : []
  const unique = new Map()
  for (const row of rows) {
    const mapped = mapEscalation(row)
    if (mapped) unique.set(mapped.id, mapped)
  }
  return [...unique.values()]
}

export function getEscalationOwnership(item, agentId) {
  if (!item || item.status === 'queued') return 'queued'
  const current = clean(agentId, 300)
  if (!current) return 'missing-agent'
  return item.claimedByAgentId === current ? 'mine' : 'other'
}

export function getEscalationQueueAge(requestedAt, now = Date.now()) {
  const started = requestedAt ? new Date(requestedAt).getTime() : NaN
  if (!Number.isFinite(started)) return 'Waiting time unavailable'
  const minutes = Math.max(0, Math.floor((now - started) / 60000))
  if (minutes < 60) return `Waiting ${minutes} min`
  if (minutes < 1440)
    return `Waiting ${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`
  return `Waiting ${Math.floor(minutes / 1440)} days`
}

export function filterEscalations(
  items,
  { filter = 'all', search = '', agentId = '' } = {},
) {
  const query = clean(search).toLowerCase()
  return items.filter((item) => {
    const ownership = getEscalationOwnership(item, agentId)
    const matchesFilter =
      filter === 'all' ||
      (filter === 'queued' && item.status === 'queued') ||
      (filter === 'mine' && ownership === 'mine') ||
      (filter === 'others' && ownership === 'other')
    const haystack =
      `${item.customerName} ${item.messengerId} ${item.tag} ${item.summary} ${item.latestMessage}`.toLowerCase()
    return matchesFilter && (!query || haystack.includes(query))
  })
}

export function sortEscalations(items, mode = 'default') {
  const timestamp = (item, field) =>
    item[field] ? new Date(item[field]).getTime() : NaN
  const compareTime = (a, b, field, direction) => {
    const left = timestamp(a, field)
    const right = timestamp(b, field)
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0
    if (!Number.isFinite(right)) return -1
    return direction === 'desc' ? right - left : left - right
  }
  return [...items].sort((a, b) => {
    if (mode === 'newest') return compareTime(a, b, 'requestedAt', 'desc')
    if (mode === 'claimed') return compareTime(a, b, 'claimedAt', 'desc')
    if (a.status !== b.status) return a.status === 'queued' ? -1 : 1
    return a.status === 'queued'
      ? compareTime(a, b, 'requestedAt', 'asc')
      : compareTime(a, b, 'claimedAt', 'desc')
  })
}
