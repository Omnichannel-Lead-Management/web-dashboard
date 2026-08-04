import { createRouter, createWebHistory } from 'vue-router'

import { useAppStore } from '../stores/app'

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
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const store = useAppStore()

  if (!to.meta.guest && !store.authenticated) {
    return '/login'
  }

  if (to.meta.guest && store.authenticated && to.path === '/login') {
    return '/inbox'
  }
})

export default router
