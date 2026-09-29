import { GATEWAY_URL } from '../config'

const TOKEN_STORAGE_KEY = 'loop-session-token'

/**
 * The gateway rejects `/api/` requests without a session token, and every call
 * in this module goes through `request()`, so the token is attached in exactly
 * one place. It is mirrored into localStorage so a refresh keeps the session.
 */
let sessionToken = readStoredToken()

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch {
    // Private mode or blocked storage: run with an in-memory token only.
    return ''
  }
}

export function setSessionToken(token) {
  sessionToken = token || ''
  try {
    if (sessionToken) localStorage.setItem(TOKEN_STORAGE_KEY, sessionToken)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Non-fatal: the in-memory token still authenticates this tab.
  }
}

export function getSessionToken() {
  return sessionToken
}

/**
 * Called when the gateway rejects our token so the store can drop the session
 * and send the user back to /login instead of leaving a half-dead dashboard.
 */
let onUnauthorized = null
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

async function request(path, options = {}) {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
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
    // 401 = no/!expired session. 403 = the session is valid but names another
    // tenant, which only happens when the stored business id disagrees with the
    // signed-in account; both leave the dashboard unusable until it signs in
    // again, so both tear the session down rather than looping on failures.
    if ((response.status === 401 || response.status === 403) && sessionToken) {
      setSessionToken('')
      onUnauthorized?.()
    }

    const message =
      body?.message || body?.error || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.body = body
    throw error
  }

  return body
}

export const gatewayApi = {
  async login({ owner_email, password }) {
    const body = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ owner_email, password }),
    })
    if (body?.token) setSessionToken(body.token)
    return body
  },

  currentSession() {
    return request('/api/auth/me')
  },

  changePassword({ current_password, new_password }) {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    })
  },

  async createBusiness({ name, sector, owner_email, owner_name, password }) {
    const body = await request('/api/businesses', {
      method: 'POST',
      body: JSON.stringify({ name, sector, owner_email, owner_name, password }),
    })
    return body
  },

  getBusiness(id) {
    return request(`/api/businesses/${encodeURIComponent(id)}`)
  },

  getBusinessAnalytics(businessId, { from, to, timezone } = {}) {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (timezone) params.set('timezone', timezone)
    const query = params.toString()
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/analytics${query ? `?${query}` : ''}`,
    )
  },

  updateBusiness(id, changes) {
    return request(`/api/businesses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },

  listConversations(businessId) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/conversations`,
    )
  },

  connectTelegram(businessId, botToken) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/channels/telegram`,
      {
        method: 'POST',
        body: JSON.stringify({ bot_token: botToken }),
      },
    )
  },

  connectWhatsApp(businessId) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/channels/whatsapp-evolution`,
      { method: 'POST' },
    )
  },

  getWhatsAppQr(businessId) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/channels/whatsapp-evolution/qrcode`,
    )
  },

  getWhatsAppStatus(businessId) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/channels/whatsapp-evolution/status`,
    )
  },

  // ── FAQs (business-scoped; see BACKEND_REQUIREMENTS.md for the contract) ──
  listFaqs(businessId) {
    return request(`/api/businesses/${encodeURIComponent(businessId)}/faqs`)
  },

  createFaq(businessId, faq) {
    return request(`/api/businesses/${encodeURIComponent(businessId)}/faqs`, {
      method: 'POST',
      body: JSON.stringify(faq),
    })
  },

  replaceFaqs(businessId, items) {
    return request(`/api/businesses/${encodeURIComponent(businessId)}/faqs`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    })
  },

  updateFaq(faqId, changes) {
    return request(`/api/faqs/${encodeURIComponent(faqId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },

  deleteFaq(faqId) {
    return request(`/api/faqs/${encodeURIComponent(faqId)}`, {
      method: 'DELETE',
    })
  },

  getChatbotConfig(businessId) {
    return request(`/api/businesses/${encodeURIComponent(businessId)}/config`)
  },

  updateChatbotConfig(businessId, patch) {
    return request(`/api/businesses/${encodeURIComponent(businessId)}/config`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  listTemplates() {
    return request('/api/templates')
  },

  attachTemplate(businessId, payload) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/attach-template`,
      { method: 'POST', body: JSON.stringify(payload) },
    )
  },

  listFlows(businessId) {
    const params = new URLSearchParams({ businessId })
    return request(`/api/flows?${params}`)
  },

  getFlow(flowId) {
    return request(`/api/flows/${encodeURIComponent(flowId)}`)
  },

  updateFlow(flowId, changes) {
    return request(`/api/flows/${encodeURIComponent(flowId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },

  deleteFlow(flowId) {
    return request(`/api/flows/${encodeURIComponent(flowId)}`, {
      method: 'DELETE',
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

  updateLead(id, businessId, payload) {
    return request(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ business_id: businessId, ...payload }),
    })
  },

  assignLead(id, businessId, payload) {
    return request(`/api/leads/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ business_id: businessId, ...payload }),
    })
  },

  /** URL for the live lead feed — consumed by EventSource, not fetch. */
  leadStreamUrl(businessId) {
    // EventSource cannot set an Authorization header, so this one route also
    // accepts the session token as a query parameter (see requireAuth.ts).
    const params = new URLSearchParams({ businessId })
    if (sessionToken) params.set('access_token', sessionToken)
    return `${GATEWAY_URL}/api/leads/stream?${params}`
  },

  // ── Appointments (proxied to the Appointment service) ──
  listAppointments(businessId) {
    const params = new URLSearchParams({ businessId })
    return request(`/api/appointments?${params}`)
  },

  getAvailability({ businessId, date }) {
    const params = new URLSearchParams({ businessId, date })
    return request(`/api/appointments/availability?${params}`)
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

  // Prepared frontend contract. The gateway does not expose these routes yet.
  listNotifications(businessId, { unread, type } = {}) {
    const params = new URLSearchParams()
    if (unread !== undefined) params.set('unread', String(Boolean(unread)))
    if (type) params.set('type', type)
    const query = params.size ? `?${params}` : ''
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/notifications${query}`,
    )
  },

  markNotificationRead(businessId, notificationId) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: 'PATCH' },
    )
  },

  markAllNotificationsRead(businessId) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/notifications/read-all`,
      { method: 'POST' },
    )
  },

  /**
   * The tenant's own billing page: their rate card, their usage so far, and
   * the invoices the platform has issued them. Drafts are never returned here
   * — an owner should only ever see a bill that has actually been sent.
   */
  getBilling(businessId, { from, to } = {}) {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const query = params.toString()
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/billing${query ? `?${query}` : ''}`,
    )
  },

  getBusinessInvoice(businessId, invoiceId) {
    return request(
      `/api/businesses/${encodeURIComponent(businessId)}/invoices/${encodeURIComponent(invoiceId)}`,
    )
  },
}
