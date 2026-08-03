const gatewayUrl = (
  import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000'
).replace(/\/$/, '')

export const GATEWAY_URL = gatewayUrl

export function explicitTrue(value) {
  return value === 'true'
}

export const businessProfileUpdateEnabled = explicitTrue(
  import.meta.env.VITE_BUSINESS_PROFILE_UPDATE_ENABLED,
)

export function gatewayWsUrl(path = '/ws/agents', baseUrl = GATEWAY_URL) {
  const url = new URL(baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = path
  url.search = ''
  url.hash = ''
  return url.toString()
}
