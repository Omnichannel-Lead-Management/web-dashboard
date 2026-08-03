const TYPES = new Set(['lead', 'appointment', 'message', 'system'])
const SAFE_PATHS = [
  /^\/inbox(?:[/?#]|$)/,
  /^\/leads(?:[/?#]|$)/,
  /^\/appointments(?:[/?#]|$)/,
  /^\/analytics(?:[/?#]|$)/,
  /^\/settings(?:[/?#]|$)/,
  /^\/notifications(?:[/?#]|$)/,
]

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function boolean(value) {
  if (value === true || value === 1 || value === '1' || value === 'true')
    return true
  return false
}

export function isSafeNotificationActionUrl(value) {
  const candidate = cleanText(value, 500)
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return false
  try {
    const parsed = new URL(candidate, 'https://dashboard.invalid')
    if (parsed.origin !== 'https://dashboard.invalid') return false
    return SAFE_PATHS.some((pattern) => pattern.test(candidate))
  } catch {
    return false
  }
}

export function mapNotification(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source))
    return null
  const id = cleanText(
    source.id || source.notification_id || source.notificationId,
    160,
  )
  if (!id) return null
  const rawType = cleanText(
    source.type || source.notification_type || source.notificationType,
    40,
  ).toLowerCase()
  const rawTimestamp = source.created_at ?? source.createdAt
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : null
  const action = source.action_url ?? source.actionUrl

  return {
    id,
    businessId: cleanText(source.business_id ?? source.businessId, 160),
    type: TYPES.has(rawType) ? rawType : 'other',
    title: cleanText(source.title, 180),
    body: cleanText(source.body ?? source.message, 1000),
    isRead: boolean(source.is_read ?? source.isRead ?? source.read),
    createdAt:
      parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
        ? parsedTimestamp.toISOString()
        : '',
    actionUrl: isSafeNotificationActionUrl(action)
      ? cleanText(action, 500)
      : '',
    metadata:
      source.metadata &&
      typeof source.metadata === 'object' &&
      !Array.isArray(source.metadata)
        ? { ...source.metadata }
        : {},
  }
}

export function mapNotificationsResponse(response) {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.notifications)
      ? response.notifications
      : Array.isArray(response?.data)
        ? response.data
        : []
  return rows.map(mapNotification).filter(Boolean)
}

export function getUnreadNotificationCount(notifications) {
  if (!Array.isArray(notifications)) return 0
  return notifications.reduce(
    (count, notification) => count + (notification?.isRead === false ? 1 : 0),
    0,
  )
}

export function filterNotifications(notifications, filter = 'all') {
  const rows = Array.isArray(notifications) ? notifications : []
  if (filter === 'all') return [...rows]
  if (filter === 'unread')
    return rows.filter((notification) => notification.isRead === false)
  const type =
    filter === 'leads'
      ? 'lead'
      : filter === 'appointments'
        ? 'appointment'
        : filter === 'messages'
          ? 'message'
          : filter
  return rows.filter((notification) => notification.type === type)
}

export function formatNotificationTime(value, now = Date.now()) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'Time unavailable'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(timestamp).toLocaleDateString()
}
