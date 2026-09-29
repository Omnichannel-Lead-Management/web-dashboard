import { createRouter, createWebHistory } from 'vue-router'

import { useAppStore } from '../stores/app'
import { useAdminStore } from '../stores/admin'

const routes = [
  {
    path: '/',
    redirect: () =>
      localStorage.getItem('loop-auth') === 'true' ? '/inbox' : '/login',
  },
  {
    path: '/login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guest: true },
  },
  {
    path: '/web-chat',
    component: () => import('../views/WebChatView.vue'),
    meta: { guest: true, publicChat: true },
  },
  { path: '/inbox', component: () => import('../views/InboxView.vue') },
  {
    path: '/escalations',
    component: () => import('../views/EscalationsView.vue'),
  },
  { path: '/leads', component: () => import('../views/LeadsView.vue') },
  {
    path: '/leads/:id',
    component: () => import('../views/LeadDetailView.vue'),
  },
  {
    path: '/appointments',
    component: () => import('../views/AppointmentsView.vue'),
  },
  {
    path: '/appointments/new',
    component: () => import('../views/NewAppointmentView.vue'),
  },
  { path: '/analytics', component: () => import('../views/AnalyticsView.vue') },
  {
    path: '/notifications',
    component: () => import('../views/NotificationsView.vue'),
  },
  {
    path: '/onboarding',
    component: () => import('../views/OnboardingView.vue'),
  },
  { path: '/settings', component: () => import('../views/SettingsView.vue') },
  { path: '/billing', component: () => import('../views/BillingView.vue') },

  /**
   * The platform admin console. `meta.admin` puts these routes on the admin
   * session instead of the business one — the guard below treats the two as
   * entirely separate worlds, so being signed in to one is never being signed
   * in to the other.
   */
  {
    path: '/admin/login',
    component: () => import('../views/admin/AdminLoginView.vue'),
    meta: { admin: true, guest: true },
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminOverviewView.vue'),
    meta: { admin: true },
  },
  {
    path: '/admin/businesses',
    component: () => import('../views/admin/AdminBusinessesView.vue'),
    meta: { admin: true },
  },
  {
    path: '/admin/businesses/:id',
    component: () => import('../views/admin/AdminBusinessDetailView.vue'),
    meta: { admin: true },
  },
  {
    path: '/admin/invoices',
    component: () => import('../views/admin/AdminInvoicesView.vue'),
    meta: { admin: true },
  },
  {
    path: '/admin/invoices/:id',
    component: () => import('../views/admin/AdminInvoiceDetailView.vue'),
    meta: { admin: true },
  },
  {
    path: '/admin/pricing',
    component: () => import('../views/admin/AdminPricingView.vue'),
    meta: { admin: true },
  },
  {
    path: '/admin/team',
    component: () => import('../views/admin/AdminTeamView.vue'),
    meta: { admin: true, owner: true },
  },
  {
    path: '/admin/account',
    component: () => import('../views/admin/AdminAccountView.vue'),
    meta: { admin: true },
  },

  { path: '/:pathMatch(.*)*', redirect: '/' },
]
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * The inbox design preview renders from seeded data and reaches no backend, so
 * while developing it opens without signing in. `import.meta.env.DEV` is
 * replaced with `false` when building, which drops this from production.
 */
function isDesignPreview(to) {
  return import.meta.env.DEV && to.path === '/inbox' && to.query.preview === '1'
}

/**
 * Admin routes are guarded against the admin session and nothing else. A
 * stored admin token is re-checked with the gateway on the first navigation
 * into the console, so a token that was revoked (or an account that was
 * deactivated) lands on the login page rather than on an empty dashboard.
 */
let adminSessionChecked = false

async function guardAdmin(to) {
  const admin = useAdminStore()

  if (!adminSessionChecked && !to.meta.guest) {
    adminSessionChecked = true
    await admin.restoreSession()
  }

  if (!to.meta.guest && !admin.authenticated) return '/admin/login'
  if (to.meta.guest && admin.authenticated) return '/admin'

  // Team management is owner-only; a billing admin who types the URL is sent
  // back rather than shown a page that will only answer 403.
  if (to.meta.owner && !admin.isOwner) return '/admin'

  return true
}

router.beforeEach(async (to) => {
  if (to.meta.admin) return await guardAdmin(to)

  const store = useAppStore()

  if (isDesignPreview(to)) return true

  if (!to.meta.guest && !store.authenticated) {
    return '/login'
  }

  if (to.meta.guest && store.authenticated && to.path === '/login') {
    return '/inbox'
  }
})

export default router
