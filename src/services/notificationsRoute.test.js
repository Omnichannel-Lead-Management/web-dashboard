import { describe, expect, test } from 'bun:test'

const read = (path) => Bun.file(new URL(path, import.meta.url)).text()

describe('notification centre integration', () => {
  test('notifications route exists and uses the authenticated guard', async () => {
    const [router, view] = await Promise.all([
      read('../router/index.js'),
      read('../views/NotificationsView.vue'),
    ])
    expect(router).toContain("path: '/notifications'")
    const routeBlock = router.slice(
      router.indexOf("path: '/notifications'"),
      router.indexOf("path: '/onboarding'"),
    )
    expect(routeBlock).not.toContain('guest: true')
    expect(router).toContain('if (!to.meta.guest && !store.authenticated)')
    expect(view).toContain('AppShell')
  })

  test('authenticated header includes the bell and panel links to the route', async () => {
    const [header, panel] = await Promise.all([
      read('../components/layout/AppHeader.vue'),
      read('../components/notifications/NotificationPanel.vue'),
    ])
    expect(header).toContain('<NotificationBell />')
    expect(panel).toContain('to="/notifications"')
  })

  test('settings navigation and preview action resolve to notifications', async () => {
    const [navigation, settings] = await Promise.all([
      read('../components/settings/SettingsNavigation.vue'),
      read('../components/settings/NotificationSettings.vue'),
    ])
    expect(navigation).toContain("['notifications', 'Notification Centre'")
    expect(settings).toContain("router.push('/notifications')")
  })

  test('bell cleans up global listeners and restores focus', async () => {
    const bell = await read('../components/notifications/NotificationBell.vue')
    expect(bell).toContain("event.key === 'Escape'")
    expect(bell).toContain("removeEventListener('keydown'")
    expect(bell).toContain("removeEventListener('pointerdown'")
    expect(bell).toContain('bell.value?.focus()')
  })

  test('notification rendering never uses HTML or external navigation', async () => {
    const [item, view] = await Promise.all([
      read('../components/notifications/NotificationItem.vue'),
      read('../views/NotificationsView.vue'),
    ])
    expect(item).not.toContain('v-html')
    expect(item).not.toContain('window.location')
    expect(view).not.toContain('window.location')
  })
})
