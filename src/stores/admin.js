import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  adminApi,
  getAdminToken,
  setAdminToken,
  setAdminUnauthorizedHandler,
} from '../services/adminApi'

const STORAGE = {
  auth: 'loop-admin-auth',
  name: 'loop-admin-name',
}

const DAY_MS = 24 * 60 * 60 * 1000

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

/** The console opens on the last 30 days, the window most billing questions live in. */
export function defaultPeriod() {
  const to = new Date()
  return {
    from: isoDate(new Date(to.getTime() - 29 * DAY_MS)),
    to: isoDate(to),
  }
}

/** The calendar month a date falls in — what an invoice period usually is. */
export function monthPeriod(reference = new Date()) {
  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth()
  return {
    from: isoDate(new Date(Date.UTC(year, month, 1))),
    to: isoDate(new Date(Date.UTC(year, month + 1, 0))),
  }
}

export function previousMonthPeriod(reference = new Date()) {
  return monthPeriod(
    new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 15),
    ),
  )
}

export const useAdminStore = defineStore('admin', () => {
  const authenticated = ref(
    localStorage.getItem(STORAGE.auth) === 'true' && Boolean(getAdminToken()),
  )
  const admin = ref(null)
  const adminName = ref(localStorage.getItem(STORAGE.name) || 'Admin')

  const period = ref(defaultPeriod())

  const overview = ref(null)
  const businesses = ref([])
  const businessDetail = ref(null)
  const plans = ref([])
  const invoices = ref([])
  const admins = ref([])

  const loadingOverview = ref(false)
  const loadingBusinesses = ref(false)
  const loadingBusinessDetail = ref(false)
  const loadingPlans = ref(false)
  const loadingInvoices = ref(false)
  const error = ref('')

  const toast = ref(null)

  const isOwner = computed(() => admin.value?.role === 'owner')
  const currency = computed(
    () => overview.value?.currency || plans.value[0]?.currency || 'LKR',
  )

  /**
   * Late responses from a previous period or a previous tenant must not
   * overwrite what is on screen now. Every loader captures the request id it
   * started with and drops its result if a newer one has begun.
   */
  let overviewRequestId = 0
  let businessesRequestId = 0
  let detailRequestId = 0
  let invoicesRequestId = 0

  function notify(message, tone = 'success') {
    toast.value = { message, tone, at: Date.now() }
  }

  function clearToast() {
    toast.value = null
  }

  function persist() {
    localStorage.setItem(STORAGE.auth, authenticated.value ? 'true' : 'false')
    if (adminName.value) localStorage.setItem(STORAGE.name, adminName.value)
  }

  function applyAdmin(next) {
    admin.value = next
    adminName.value = next?.name?.trim() || next?.email || 'Admin'
  }

  async function login({ email, password }) {
    const session = await adminApi.login({ email, password })
    if (!session?.admin?.id) throw new Error('Sign-in did not return an admin')

    applyAdmin(session.admin)
    authenticated.value = true
    persist()
    return session.admin
  }

  function logout() {
    authenticated.value = false
    setAdminToken('')
    localStorage.setItem(STORAGE.auth, 'false')
    admin.value = null
    overview.value = null
    businesses.value = []
    businessDetail.value = null
    plans.value = []
    invoices.value = []
    admins.value = []
    error.value = ''
    // Bump every guard so an in-flight response cannot repopulate the console
    // after the session it belonged to has ended.
    overviewRequestId += 1
    businessesRequestId += 1
    detailRequestId += 1
    invoicesRequestId += 1
  }

  /** Re-checks a stored token against the gateway before trusting it. */
  async function restoreSession() {
    if (!getAdminToken()) {
      authenticated.value = false
      return false
    }

    try {
      const body = await adminApi.currentAdmin()
      applyAdmin(body.admin)
      authenticated.value = true
      persist()
      return true
    } catch {
      logout()
      return false
    }
  }

  function setPeriod(next) {
    period.value = { ...period.value, ...next }
  }

  async function refreshOverview() {
    const requestId = (overviewRequestId += 1)
    loadingOverview.value = true
    error.value = ''
    try {
      const body = await adminApi.getOverview(period.value)
      if (requestId !== overviewRequestId) return
      overview.value = body.overview
    } catch (err) {
      if (requestId !== overviewRequestId) return
      error.value = err.message
    } finally {
      if (requestId === overviewRequestId) loadingOverview.value = false
    }
  }

  async function refreshBusinesses() {
    const requestId = (businessesRequestId += 1)
    loadingBusinesses.value = true
    try {
      const body = await adminApi.listBusinesses(period.value)
      if (requestId !== businessesRequestId) return
      businesses.value = body.businesses || []
    } catch (err) {
      if (requestId !== businessesRequestId) return
      error.value = err.message
    } finally {
      if (requestId === businessesRequestId) loadingBusinesses.value = false
    }
  }

  async function loadBusiness(businessId) {
    const requestId = (detailRequestId += 1)
    loadingBusinessDetail.value = true
    businessDetail.value = null
    try {
      const body = await adminApi.getBusiness(businessId, period.value)
      if (requestId !== detailRequestId) return null
      businessDetail.value = body
      return body
    } catch (err) {
      if (requestId !== detailRequestId) return null
      error.value = err.message
      return null
    } finally {
      if (requestId === detailRequestId) loadingBusinessDetail.value = false
    }
  }

  async function refreshPlans({ includeArchived = false } = {}) {
    loadingPlans.value = true
    try {
      const body = await adminApi.listPlans({ includeArchived })
      plans.value = body.plans || []
    } catch (err) {
      error.value = err.message
    } finally {
      loadingPlans.value = false
    }
  }

  async function savePlan(planId, changes) {
    const body = planId
      ? await adminApi.updatePlan(planId, changes)
      : await adminApi.createPlan(changes)

    await refreshPlans()
    notify(planId ? 'Prices updated.' : 'Plan created.')
    return body.plan
  }

  async function assignPlan(businessId, pricingPlanId) {
    await adminApi.updateBusinessBilling(businessId, {
      pricing_plan_id: pricingPlanId || null,
    })
    notify('Plan assigned.')
    await Promise.all([refreshBusinesses(), loadBusiness(businessId)])
  }

  async function setBillingActive(businessId, active) {
    await adminApi.updateBusinessBilling(businessId, { billing_active: active })
    notify(active ? 'Billing resumed.' : 'Billing paused.')
    await refreshBusinesses()
  }

  async function refreshInvoices(filter = {}) {
    const requestId = (invoicesRequestId += 1)
    loadingInvoices.value = true
    try {
      const body = await adminApi.listInvoices(filter)
      if (requestId !== invoicesRequestId) return
      invoices.value = body.invoices || []
    } catch (err) {
      if (requestId !== invoicesRequestId) return
      error.value = err.message
    } finally {
      if (requestId === invoicesRequestId) loadingInvoices.value = false
    }
  }

  async function createInvoice(input) {
    const body = await adminApi.createInvoice(input)
    notify(`Draft ${body.invoice.number} created.`)
    return body.invoice
  }

  async function sendInvoice(invoiceId) {
    const body = await adminApi.sendInvoice(invoiceId)

    // Issuing and emailing succeed independently: the invoice is now the
    // customer's to see either way, so a failed email is a warning, not an error.
    if (body.email_sent) notify(`${body.invoice.number} emailed to the owner.`)
    else
      notify(
        body.email_error || 'Invoice issued, but no email was sent.',
        'warning',
      )

    return body
  }

  async function setInvoiceStatus(invoiceId, status) {
    const body = await adminApi.setInvoiceStatus(invoiceId, status)
    notify(status === 'paid' ? 'Marked as paid.' : 'Invoice voided.')
    return body.invoice
  }

  async function deleteInvoice(invoiceId) {
    await adminApi.deleteInvoice(invoiceId)
    notify('Draft discarded.')
  }

  async function refreshAdmins() {
    const body = await adminApi.listAdmins()
    admins.value = body.admins || []
  }

  setAdminUnauthorizedHandler(() => {
    authenticated.value = false
    localStorage.setItem(STORAGE.auth, 'false')
  })

  return {
    authenticated,
    admin,
    adminName,
    isOwner,
    period,
    currency,
    overview,
    businesses,
    businessDetail,
    plans,
    invoices,
    admins,
    loadingOverview,
    loadingBusinesses,
    loadingBusinessDetail,
    loadingPlans,
    loadingInvoices,
    error,
    toast,
    notify,
    clearToast,
    login,
    logout,
    restoreSession,
    setPeriod,
    refreshOverview,
    refreshBusinesses,
    loadBusiness,
    refreshPlans,
    savePlan,
    assignPlan,
    setBillingActive,
    refreshInvoices,
    createInvoice,
    sendInvoice,
    setInvoiceStatus,
    deleteInvoice,
    refreshAdmins,
  }
})
