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

  // ── Leads (gateway proxies these to the Lead Manager service) ──
  listLeads(businessId, { status, assignedAgentId } = {}) {
    const params = new URLSearchParams({ businessId })
    if (status) params.set('status', status)
    if (assignedAgentId) params.set('assignedAgentId', assignedAgentId)
    return request(`/api/leads?${params}`)
  },

  getLead(id, businessId) {
    const params = new URLSearchParams({ businessId })
    return request(`/api/leads/${encodeURIComponent(id)}?${params}`)
  },

  updateLead(id, businessId, changes) {
    return request(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ business_id: businessId, ...changes }),
    })
  },

  assignLead(id, businessId, agentId) {
    return request(`/api/leads/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId, agent_id: agentId }),
    })
  },

  /** URL for the live lead feed — consumed by EventSource, not fetch. */
  leadStreamUrl(businessId) {
    return `${GATEWAY_URL}/api/leads/stream?businessId=${encodeURIComponent(businessId)}`
  },

  // ── Appointments (proxied to the Appointment service) ──
  listAppointments(businessId) {
    const params = new URLSearchParams({ businessId })
    return request(`/api/appointments?${params}`)
  },

  createAppointment(payload) {
    return request('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateAppointmentStatus(id, businessId, status) {
    return request(`/api/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ businessId, status }),
    })
  },
}
