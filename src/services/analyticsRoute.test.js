import { describe, expect, test } from 'bun:test'
const read = (path) => Bun.file(new URL(path, import.meta.url)).text()
describe('analytics integration', () => {
  test('route remains authenticated and navigation/settings resolve', async () => {
    const [router, nav, settings] = await Promise.all([
      read('../router/index.js'),
      read('../components/layout/AppNavigation.vue'),
      read('../components/settings/AnalyticsSettings.vue'),
    ])
    expect(router).toContain("path: '/analytics'")
    expect(router).toContain('if (!to.meta.guest && !store.authenticated)')
    expect(nav).toContain("to: '/analytics', label: 'Analytics'")
    expect(settings).toContain('to="/analytics"')
  })
  test('disabled view is honest and charts have tables', async () => {
    const [view, trend, distribution] = await Promise.all([
      read('../views/AnalyticsView.vue'),
      read('../components/analytics/AnalyticsTrend.vue'),
      read('../components/analytics/AnalyticsDistribution.vue'),
    ])
    expect(view).toContain('What is open in this dashboard')
    expect(view).toContain('may not represent complete business totals')
    expect(view).not.toContain('Math.random')
    // The incomplete-data caveat must stay, but without platform jargon.
    expect(view).not.toContain('gateway analytics API')
    expect(view).not.toContain('Session snapshot')
    // Every chart keeps a tabular equivalent for assistive technology.
    expect(trend).toContain('<table')
    expect(trend).toContain('visually-hidden')
    expect(distribution).toContain('<table')
    expect(distribution).toContain('visually-hidden')
  })
  test('direct navigation resolves and reacts to the active business timezone', async () => {
    const [view, range] = await Promise.all([
      read('../views/AnalyticsView.vue'),
      read('../components/analytics/AnalyticsDateRange.vue'),
    ])
    expect(view).toContain('.refreshBusiness()')
    expect(view).toContain('businessLoadPromise')
    expect(view).toContain('store.business?.id === store.businessId')
    expect(view).toContain('watch(analyticsTimezone')
    expect(view).toContain('rebaseAnalyticsRangeTimezone')
    expect(view).toContain('lastAutomaticRangeKey')
    expect(view).toContain('Your device timezone:')
    expect(view).toContain('Business timezone:')
    expect(view).toContain('if (!store.authenticated')
    expect(range).toContain('timezoneLabel')
  })
})
