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
    summary.escalation_status === 'claimed' || Boolean(summary.claimed_by_agent_id)

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
    status: summary.is_escalated ? (claimed ? 'contacted' : 'qualified') : 'new',
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

export function mapHistoryMessage(entry) {
  const sender =
    entry.from === 'user' ? 'customer' : entry.from === 'agent' ? 'agent' : 'bot'

  return {
    id: entry.id ?? `${entry.timestamp}-${entry.from}`,
    sender,
    text: entry.text,
    time: formatTime(entry.timestamp),
  }
}
