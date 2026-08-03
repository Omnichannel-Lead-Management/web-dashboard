import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { gatewayApi } from '../services/gatewayApi'
import { useAppStore } from './app'
const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
}
const range = (from = '2026-07-01', to = '2026-07-31') => ({
  from,
  to,
  timezone: 'Asia/Colombo',
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
let store
beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_a'
  store.analyticsAvailable = true
  gatewayApi.getBusinessAnalytics = async () => ({
    summary: { conversations: 1 },
  })
})
describe('analytics store', () => {
  test('disabled capability performs no request', async () => {
    let calls = 0
    gatewayApi.getBusinessAnalytics = async () => {
      calls++
      return { summary: {} }
    }
    store.analyticsAvailable = false
    expect(await store.refreshAnalytics(range())).toBeNull()
    expect(calls).toBe(0)
    expect(store.analytics).toBeNull()
  })
  test('stores normalized current-business analytics', async () => {
    await store.refreshAnalytics(range())
    expect(store.analytics.summary.conversations).toBe(1)
    expect(store.analyticsLoadedForBusinessId).toBe('biz_a')
    expect(store.analyticsLoading).toBe(false)
  })
  test('deduplicates the same active business and range request', async () => {
    const pending = deferred()
    let calls = 0
    gatewayApi.getBusinessAnalytics = () => {
      calls++
      return pending.promise
    }
    const first = store.refreshAnalytics(range())
    const second = store.refreshAnalytics(range())
    expect(calls).toBe(1)
    pending.resolve({ summary: { leads: 2 } })
    expect(await first).toEqual(await second)
  })
  test('late Range A cannot overwrite Range B', async () => {
    const a = deferred()
    const b = deferred()
    gatewayApi.getBusinessAnalytics = (_id, filters) =>
      filters.from === '2026-07-01' ? a.promise : b.promise
    const first = store.refreshAnalytics(range())
    const second = store.refreshAnalytics(range('2026-08-01', '2026-08-03'))
    b.resolve({ summary: { conversations: 2 } })
    await second
    a.resolve({ summary: { conversations: 9 } })
    expect(await first).toBeNull()
    expect(store.analytics.summary.conversations).toBe(2)
    expect(store.analyticsLoading).toBe(false)
  })
  test('late browser-timezone response cannot overwrite the corrected business timezone', async () => {
    const browser = deferred()
    const business = deferred()
    gatewayApi.getBusinessAnalytics = (_id, filters) =>
      filters.timezone === 'UTC' ? browser.promise : business.promise
    const oldRequest = store.refreshAnalytics({ ...range(), timezone: 'UTC' })
    const correctedRequest = store.refreshAnalytics({
      ...range(),
      timezone: 'Asia/Colombo',
    })
    business.resolve({ summary: { conversations: 2 } })
    await correctedRequest
    browser.resolve({ summary: { conversations: 9 } })
    expect(await oldRequest).toBeNull()
    expect(store.analytics.summary.conversations).toBe(2)
    expect(store.analyticsRangeKey).toContain('Asia/Colombo')
  })
  test('business switch and logout invalidate pending responses', async () => {
    const pending = deferred()
    gatewayApi.getBusinessAnalytics = () => pending.promise
    const request = store.refreshAnalytics(range())
    store.businessId = 'biz_b'
    pending.resolve({ summary: { conversations: 9 } })
    expect(await request).toBeNull()
    expect(store.analytics).toBeNull()
    store.logout()
    expect(store.analyticsError).toBe('')
    expect(store.analyticsLastUpdatedAt).toBe(0)
  })
  test('same-range refresh failure preserves confirmed data', async () => {
    await store.refreshAnalytics(range())
    gatewayApi.getBusinessAnalytics = async () => {
      throw new Error('Unavailable')
    }
    await expect(store.refreshAnalytics(range())).rejects.toThrow('Unavailable')
    expect(store.analytics.summary.conversations).toBe(1)
    expect(store.analyticsError).toBe('Unavailable')
  })
  test('capability disabled during request prevents application', async () => {
    const pending = deferred()
    gatewayApi.getBusinessAnalytics = () => pending.promise
    const request = store.refreshAnalytics(range())
    store.analyticsAvailable = false
    pending.resolve({ summary: { conversations: 7 } })
    expect(await request).toBeNull()
    expect(store.analytics).toBeNull()
  })

  test('a new-range failure does not retain data labelled for the old range', async () => {
    await store.refreshAnalytics(range())
    gatewayApi.getBusinessAnalytics = async () => {
      throw new Error('Range unavailable')
    }
    await expect(
      store.refreshAnalytics(range('2026-08-01', '2026-08-03')),
    ).rejects.toThrow('Range unavailable')
    expect(store.analytics).toBeNull()
    expect(store.analyticsError).toBe('Range unavailable')
  })

  test('malformed success is rejected without creating an empty confirmed report', async () => {
    gatewayApi.getBusinessAnalytics = async () => ({ success: true })
    await expect(store.refreshAnalytics(range())).rejects.toThrow(
      'Gateway returned invalid analytics data',
    )
    expect(store.analytics).toBeNull()
    expect(store.analyticsLoadedForBusinessId).toBe('')
  })

  test('local snapshots do not alter canonical remote analytics state', async () => {
    await store.refreshAnalytics(range())
    const confirmed = store.analytics
    store.conversations = [{ id: 'conversation-1', businessId: 'biz_a' }]
    expect(store.analytics).toBe(confirmed)
    expect(store.analytics.summary.conversations).toBe(1)
  })
})
