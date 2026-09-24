const gatewayUrl = (
  import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000'
).replace(/\/$/, '')

export const GATEWAY_URL = gatewayUrl

/**
 * Tenant this build belongs to. The customer web chat widget has no dashboard
 * session to read a business from, so this is what tells the gateway which
 * business the conversation belongs to.
 */
export const BUSINESS_ID = import.meta.env.VITE_BUSINESS_ID || ''

export function explicitTrue(value) {
  return value === 'true'
}

export const businessProfileUpdateEnabled = explicitTrue(
  import.meta.env.VITE_BUSINESS_PROFILE_UPDATE_ENABLED,
)

export const webChatEnabled = explicitTrue(
  import.meta.env.VITE_WEB_CHAT_ENABLED,
)

export const notificationCenterEnabled = explicitTrue(
  import.meta.env.VITE_NOTIFICATION_CENTER_ENABLED,
)

export const imageAttachmentsEnabled = explicitTrue(
  import.meta.env.VITE_IMAGE_ATTACHMENTS_ENABLED,
)

export const agentEscalationQueueEnabled = explicitTrue(
  import.meta.env.VITE_AGENT_ESCALATION_QUEUE_ENABLED,
)

export const analyticsEnabled = explicitTrue(
  import.meta.env.VITE_ANALYTICS_ENABLED,
)

export function gatewayWsUrl(path = '/ws/agents', baseUrl = GATEWAY_URL) {
  const url = new URL(baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = path
  url.search = ''
  url.hash = ''
  return url.toString()
}
