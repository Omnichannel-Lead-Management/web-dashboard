import { GATEWAY_URL } from '../config'

async function request(path, options = {}) {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message = body?.error || `Request failed (${response.status})`
    throw new Error(message)
  }

  return body
}

export const gatewayApi = {
  createBusiness({ name, sector, owner_email }) {
    return request('/api/businesses', {
      method: 'POST',
      body: JSON.stringify({ name, sector, owner_email }),
    })
  },

  getBusiness(id) {
    return request(`/api/businesses/${encodeURIComponent(id)}`)
  },

  listConversations(businessId) {
    return request(`/api/businesses/${encodeURIComponent(businessId)}/conversations`)
  },

  connectTelegram(businessId, botToken) {
    return request(`/api/businesses/${encodeURIComponent(businessId)}/channels/telegram`, {
      method: 'POST',
      body: JSON.stringify({ bot_token: botToken }),
    })
  },

  getMessagingHistory({ messenger_id, platform, limit = 50 }) {
    const params = new URLSearchParams({
      messenger_id,
      platform,
      limit: String(limit),
    })
    return request(`/api/messaging/history?${params}`)
  },

  getAgentQueue(businessId) {
    const params = businessId
      ? `?business_id=${encodeURIComponent(businessId)}`
      : ''
    return request(`/api/agents/queue${params}`)
  },
}
