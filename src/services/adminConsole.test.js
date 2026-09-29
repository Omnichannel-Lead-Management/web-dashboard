import { describe, expect, test } from 'bun:test'

const read = (path) => Bun.file(new URL(path, import.meta.url)).text()

describe('the admin console is routed separately from the dashboard', () => {
  test('every admin route is guarded by the admin session, not the business one', async () => {
    const router = await read('../router/index.js')

    expect(router).toContain("path: '/admin/login'")
    expect(router).toContain("path: '/admin/businesses/:id'")
    expect(router).toContain("path: '/admin/invoices/:id'")
    expect(router).toContain("path: '/admin/pricing'")
    // The guard splits on meta.admin before the tenant guard ever runs.
    expect(router).toContain('if (to.meta.admin) return await guardAdmin(to)')
    expect(router).toContain(
      "if (!to.meta.guest && !admin.authenticated) return '/admin/login'",
    )
  })

  test('a stored admin token is re-checked with the gateway before it is trusted', async () => {
    const router = await read('../router/index.js')
    expect(router).toContain('await admin.restoreSession()')
  })

  test('team management is owner-only in the router as well as the API', async () => {
    const router = await read('../router/index.js')
    expect(router).toContain('meta: { admin: true, owner: true }')
    expect(router).toContain(
      "if (to.meta.owner && !admin.isOwner) return '/admin'",
    )
  })
})

describe('the two clients never share a credential', () => {
  test('the admin client keeps its own token under its own key', async () => {
    const [adminApi, gatewayApi] = await Promise.all([
      read('./adminApi.js'),
      read('./gatewayApi.js'),
    ])

    expect(adminApi).toContain("TOKEN_STORAGE_KEY = 'loop-admin-token'")
    expect(gatewayApi).toContain("TOKEN_STORAGE_KEY = 'loop-session-token'")
    // The admin client must never reach for the dashboard's token.
    expect(adminApi).not.toContain('loop-session-token')
    expect(gatewayApi).not.toContain('loop-admin-token')
  })

  test('the admin client only ever calls /api/admin/', async () => {
    const source = await read('./adminApi.js')
    const paths = [...source.matchAll(/`(\/api\/[^`$]*)/g)].map(
      (match) => match[1],
    )

    expect(paths.length).toBeGreaterThan(5)
    for (const path of paths) expect(path.startsWith('/api/admin/')).toBe(true)
  })

  test('a 403 on an admin route does not tear the session down', async () => {
    const source = await read('./adminApi.js')
    // Only 401 clears the token: 403 means "your role cannot do that one thing".
    expect(source).toContain('if (response.status === 401 && adminToken)')
  })
})

describe('the console cannot show message content', () => {
  test('no admin view reaches for conversations, messages or leads', async () => {
    const views = [
      '../views/admin/AdminOverviewView.vue',
      '../views/admin/AdminBusinessesView.vue',
      '../views/admin/AdminBusinessDetailView.vue',
      '../views/admin/AdminInvoicesView.vue',
      '../views/admin/AdminInvoiceDetailView.vue',
      '../views/admin/AdminPricingView.vue',
    ]

    for (const path of views) {
      const source = await read(path)
      expect(source).not.toContain('listConversations')
      expect(source).not.toContain('gatewayApi')
      expect(source).not.toContain('useAppStore')
    }
  })

  test('the overview says plainly what the console can and cannot see', async () => {
    const source = await read('../views/admin/AdminOverviewView.vue')
    expect(source).toContain('cannot open a tenant')
  })
})

describe('billing reaches the business it bills', () => {
  test('the tenant dashboard has its own Billing page in the nav', async () => {
    const [router, nav] = await Promise.all([
      read('../router/index.js'),
      read('../components/layout/AppNavigation.vue'),
    ])

    expect(router).toContain("path: '/billing'")
    expect(nav).toContain("to: '/billing', label: 'Billing'")
  })

  test('the estimate on the tenant page is labelled as an estimate', async () => {
    const source = await read('../views/BillingView.vue')
    expect(source).toContain('An estimate from your usage to date')
    // Whitespace-insensitive: the claim matters, the line wrapping does not.
    expect(source.replace(/\s+/g, ' ')).toContain(
      'Your actual invoice is issued by the platform',
    )
  })

  test('a failed invoice email is surfaced, not swallowed', async () => {
    const [detail, list, store] = await Promise.all([
      read('../views/admin/AdminInvoiceDetailView.vue'),
      read('../views/admin/AdminInvoicesView.vue'),
      read('../stores/admin.js'),
    ])

    expect(detail).toContain('This invoice was issued, but not emailed')
    expect(list).toContain('Email failed')
    expect(store).toContain('body.email_error')
  })
})
