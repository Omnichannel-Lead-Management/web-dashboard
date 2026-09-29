import { GATEWAY_URL } from '../config'

/**
 * The platform admin console talks to `/api/admin/` and nothing else.
 *
 * It keeps its own token under its own storage key, deliberately separate from
 * the business dashboard's. An admin and a business owner can be signed in in
 * the same browser without either session standing in for the other — and,
 * more importantly, neither client can accidentally send the wrong token to
 * the wrong API, because the two never share a `request()`.
 */

const TOKEN_STORAGE_KEY = 'loop-admin-token'

let adminToken = readStoredToken()

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch {
    // Private mode or blocked storage: run with an in-memory token only.
    return ''
  }
}

export function setAdminToken(token) {
  adminToken = token || ''
  try {
    if (adminToken) localStorage.setItem(TOKEN_STORAGE_KEY, adminToken)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Non-fatal: the in-memory token still authenticates this tab.
  }
}

export function getAdminToken() {
  return adminToken
}

let onUnauthorized = null
export function setAdminUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

async function request(path, options = {}) {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
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
    // 401 means this session is over. 403 on an admin route means the role is
    // not allowed to do that one thing, which is not a reason to sign out.
    if (response.status === 401 && adminToken) {
      setAdminToken('')
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

function periodQuery({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const adminApi = {
  async login({ email, password }) {
    const body = await request('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (body?.token) setAdminToken(body.token)
    return body
  },

  currentAdmin() {
    return request('/api/admin/auth/me')
  },

  changePassword({ current_password, new_password }) {
    return request('/api/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    })
  },

  // ── Stats ──
  getOverview(period) {
    return request(`/api/admin/overview${periodQuery(period)}`)
  },

  listBusinesses(period) {
    return request(`/api/admin/businesses${periodQuery(period)}`)
  },

  getBusiness(businessId, period) {
    return request(
      `/api/admin/businesses/${encodeURIComponent(businessId)}${periodQuery(period)}`,
    )
  },

  updateBusinessBilling(businessId, changes) {
    return request(
      `/api/admin/businesses/${encodeURIComponent(businessId)}/billing`,
      { method: 'PATCH', body: JSON.stringify(changes) },
    )
  },

  // ── Pricing ──
  listPlans({ includeArchived = false } = {}) {
    return request(
      `/api/admin/pricing-plans${includeArchived ? '?include_archived=true' : ''}`,
    )
  },

  createPlan(plan) {
    return request('/api/admin/pricing-plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
  },

  updatePlan(planId, changes) {
    return request(`/api/admin/pricing-plans/${encodeURIComponent(planId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },

  // ── Invoices ──
  previewInvoice({ business_id, period_start, period_end }) {
    const params = new URLSearchParams({
      business_id,
      period_start,
      period_end,
    })
    return request(`/api/admin/invoices/preview?${params}`)
  },

  listInvoices({ business_id, status, limit } = {}) {
    const params = new URLSearchParams()
    if (business_id) params.set('business_id', business_id)
    if (status) params.set('status', status)
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request(`/api/admin/invoices${query ? `?${query}` : ''}`)
  },

  getInvoice(invoiceId) {
    return request(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`)
  },

  createInvoice(invoice) {
    return request('/api/admin/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice),
    })
  },

  updateInvoice(invoiceId, changes) {
    return request(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },

  deleteInvoice(invoiceId) {
    return request(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`, {
      method: 'DELETE',
    })
  },

  sendInvoice(invoiceId) {
    return request(
      `/api/admin/invoices/${encodeURIComponent(invoiceId)}/send`,
      { method: 'POST' },
    )
  },

  setInvoiceStatus(invoiceId, status) {
    return request(
      `/api/admin/invoices/${encodeURIComponent(invoiceId)}/status`,
      { method: 'POST', body: JSON.stringify({ status }) },
    )
  },

  // ── Admin accounts (owner role only) ──
  listAdmins() {
    return request('/api/admin/admins')
  },

  createAdmin(admin) {
    return request('/api/admin/admins', {
      method: 'POST',
      body: JSON.stringify(admin),
    })
  },

  updateAdmin(adminId, changes) {
    return request(`/api/admin/admins/${encodeURIComponent(adminId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
  },
}
