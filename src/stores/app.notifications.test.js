import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { gatewayApi } from '../services/gatewayApi.js'
import { useAppStore } from './app.js'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
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
  store.notificationCenterAvailable = true
  gatewayApi.listNotifications = async () => ({ notifications: [] })
  gatewayApi.markNotificationRead = async () => ({ success: true })
  gatewayApi.markAllNotificationsRead = async () => ({ success: true })
})

describe('notification store', () => {
  test('disabled capability performs no fetch and exposes no unread count', async () => {
    let calls = 0
    gatewayApi.listNotifications = async () => {
      calls += 1
      return { notifications: [{ id: 'n_1', is_read: false }] }
    }
    store.notificationCenterAvailable = false

    expect(await store.refreshNotifications()).toBeNull()
    expect(calls).toBe(0)
    expect(store.notificationUnreadCount).toBe(0)
  })

  test('successful fetch normalizes and same-business refresh replaces data', async () => {
    let round = 0
    gatewayApi.listNotifications = async (businessId) => ({
      notifications:
        round++ === 0
          ? [
              {
                id: 'n_1',
                business_id: businessId,
                type: 'lead',
                title: 'Lead',
                is_read: false,
              },
            ]
          : [{ id: 'n_2', business_id: businessId, is_read: true }],
    })

    await store.refreshNotifications()
    expect(store.notifications.map((item) => item.id)).toEqual(['n_1'])
    expect(store.notificationsLoadedForBusinessId).toBe('biz_a')
    expect(store.notificationUnreadCount).toBe(1)
    await store.refreshNotifications()
    expect(store.notifications.map((item) => item.id)).toEqual(['n_2'])
    expect(store.notificationUnreadCount).toBe(0)
  })

  test('duplicate refreshes share one request', async () => {
    const pending = deferred()
    let calls = 0
    gatewayApi.listNotifications = () => {
      calls += 1
      return pending.promise
    }
    const first = store.refreshNotifications()
    const second = store.refreshNotifications()
    expect(calls).toBe(1)
    pending.resolve({ notifications: [] })
    await Promise.all([first, second])
  })

  test('refresh failure and malformed refresh preserve confirmed data', async () => {
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'other' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.listNotifications = async () => {
      throw new Error('Gateway down')
    }
    await store.refreshNotifications()
    expect(store.notifications.map((item) => item.id)).toEqual(['n_1'])
    expect(store.notificationsError).toBe('Gateway down')

    gatewayApi.listNotifications = async () => ({ success: true })
    await store.refreshNotifications()
    expect(store.notifications.map((item) => item.id)).toEqual(['n_1'])
    expect(store.notificationsError).toContain('invalid notifications')
  })

  test('business switching clears rows and ignores stale responses', async () => {
    const pending = deferred()
    gatewayApi.listNotifications = () => pending.promise
    const request = store.refreshNotifications()
    store.notifications = [
      { id: 'old', businessId: 'biz_a', isRead: false, type: 'other' },
    ]
    store.businessId = 'biz_b'
    expect(store.notifications).toEqual([])
    pending.resolve({
      notifications: [{ id: 'late_a', business_id: 'biz_a', is_read: false }],
    })
    await request
    expect(store.notifications).toEqual([])
    expect(store.notificationUnreadCount).toBe(0)
  })

  test('logout clears all notification state and invalidates pending fetch', async () => {
    const pending = deferred()
    gatewayApi.listNotifications = () => pending.promise
    const request = store.refreshNotifications()
    store.notificationsError = 'old'
    store.logout()
    pending.resolve({ notifications: [{ id: 'late', is_read: false }] })
    await request
    expect(store.notifications).toEqual([])
    expect(store.notificationsError).toBe('')
    expect(store.notificationsLoading).toBe(false)
    expect(store.notificationMutationIds).toEqual([])
  })

  test('logout invalidates a pending read mutation', async () => {
    const pending = deferred()
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.markNotificationRead = () => pending.promise
    const request = store.markNotificationRead('n_1')
    store.logout()
    pending.resolve({ success: true })
    await request

    expect(store.notifications).toEqual([])
    expect(store.notificationMutationIds).toEqual([])
    expect(store.notificationUnreadCount).toBe(0)
  })

  test('mark one updates only after success and already-read sends nothing', async () => {
    const pending = deferred()
    let calls = 0
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
      { id: 'n_2', businessId: 'biz_a', isRead: true, type: 'system' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.markNotificationRead = () => {
      calls += 1
      return pending.promise
    }
    const request = store.markNotificationRead('n_1')
    expect(store.notifications[0].isRead).toBe(false)
    pending.resolve({ success: true })
    await request
    expect(store.notifications[0].isRead).toBe(true)
    await store.markNotificationRead('n_2')
    expect(calls).toBe(1)
    expect(store.notificationUnreadCount).toBe(0)
  })

  test('mark failure and malformed success preserve unread state', async () => {
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.markNotificationRead = async () => {
      throw new Error('Read rejected')
    }
    await expect(store.markNotificationRead('n_1')).rejects.toThrow(
      'Read rejected',
    )
    expect(store.notifications[0].isRead).toBe(false)

    gatewayApi.markNotificationRead = async () => ({ success: false })
    await expect(store.markNotificationRead('n_1')).rejects.toThrow(
      'invalid notification',
    )
    expect(store.notifications[0].isRead).toBe(false)
  })

  test('duplicate item mutation shares one request', async () => {
    const pending = deferred()
    let calls = 0
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    gatewayApi.markNotificationRead = () => {
      calls += 1
      return pending.promise
    }
    const first = store.markNotificationRead('n_1')
    const second = store.markNotificationRead('n_1')
    expect(calls).toBe(1)
    pending.resolve({ success: true })
    await Promise.all([first, second])
  })

  test('mark-all success confirms every row and failure preserves them', async () => {
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
      { id: 'n_2', businessId: 'biz_a', isRead: false, type: 'message' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.markAllNotificationsRead = async () => {
      throw new Error('Bulk rejected')
    }
    await expect(store.markAllNotificationsRead()).rejects.toThrow(
      'Bulk rejected',
    )
    expect(store.notificationUnreadCount).toBe(2)

    gatewayApi.markAllNotificationsRead = async () => ({ success: true })
    await store.markAllNotificationsRead()
    expect(store.notifications.every((item) => item.isRead)).toBe(true)
    expect(store.notificationUnreadCount).toBe(0)
    expect(await store.markAllNotificationsRead()).toBeNull()
  })

  test('duplicate mark-all submissions use one backend request', async () => {
    const pending = deferred()
    let calls = 0
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.markAllNotificationsRead = () => {
      calls += 1
      return pending.promise
    }
    const first = store.markAllNotificationsRead()
    const second = store.markAllNotificationsRead()
    expect(calls).toBe(1)
    pending.resolve({ success: true })
    await Promise.all([first, second])
    expect(store.notificationUnreadCount).toBe(0)
  })

  test('stale mutation cannot alter or unlock the new business', async () => {
    const old = deferred()
    gatewayApi.markNotificationRead = () => old.promise
    store.notifications = [
      { id: 'same', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    const requestA = store.markNotificationRead('same')
    store.businessId = 'biz_b'
    store.notifications = [
      { id: 'same', businessId: 'biz_b', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_b'
    const newer = deferred()
    gatewayApi.markNotificationRead = () => newer.promise
    const requestB = store.markNotificationRead('same')
    old.resolve({ success: true })
    await requestA
    expect(store.notifications[0].isRead).toBe(false)
    expect(store.notificationMutationIds).toContain('same')
    newer.resolve({ success: true })
    await requestB
    expect(store.notifications[0].isRead).toBe(true)
  })

  test('a confirmed mark-one invalidates an older unread refresh', async () => {
    const pendingRefresh = deferred()
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.listNotifications = () => pendingRefresh.promise

    const refresh = store.refreshNotifications()
    await store.markNotificationRead('n_1')
    expect(store.notifications[0].isRead).toBe(true)
    expect(store.notificationsLoading).toBe(false)

    pendingRefresh.resolve({
      notifications: [{ id: 'n_1', business_id: 'biz_a', is_read: false }],
    })
    await refresh
    expect(store.notifications[0].isRead).toBe(true)
    expect(store.notificationUnreadCount).toBe(0)
    expect(store.notificationsLoading).toBe(false)
  })

  test('a confirmed mark-all invalidates an older unread refresh', async () => {
    const pendingRefresh = deferred()
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
      { id: 'n_2', businessId: 'biz_a', isRead: false, type: 'message' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.listNotifications = () => pendingRefresh.promise

    const refresh = store.refreshNotifications()
    await store.markAllNotificationsRead()
    pendingRefresh.resolve({
      notifications: [
        { id: 'n_1', business_id: 'biz_a', is_read: false },
        { id: 'n_2', business_id: 'biz_a', is_read: false },
      ],
    })
    await refresh

    expect(store.notifications.every((item) => item.isRead)).toBe(true)
    expect(store.notificationUnreadCount).toBe(0)
    expect(store.notificationsLoading).toBe(false)
    expect(store.notificationMutationIds).toEqual([])
  })

  test('failed mutations leave an active refresh eligible to apply', async () => {
    const pendingRefresh = deferred()
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.listNotifications = () => pendingRefresh.promise
    gatewayApi.markNotificationRead = async () => {
      throw new Error('Read rejected')
    }

    const refresh = store.refreshNotifications()
    await expect(store.markNotificationRead('n_1')).rejects.toThrow(
      'Read rejected',
    )
    expect(store.notificationsLoading).toBe(true)
    pendingRefresh.resolve({
      notifications: [{ id: 'new', business_id: 'biz_a', is_read: true }],
    })
    await refresh
    expect(store.notifications.map((item) => item.id)).toEqual(['new'])
    expect(store.notificationsLoading).toBe(false)
  })

  test('failed mark-all leaves an active refresh eligible to apply', async () => {
    const pendingRefresh = deferred()
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.listNotifications = () => pendingRefresh.promise
    gatewayApi.markAllNotificationsRead = async () => {
      throw new Error('Bulk rejected')
    }

    const refresh = store.refreshNotifications()
    await expect(store.markAllNotificationsRead()).rejects.toThrow(
      'Bulk rejected',
    )
    pendingRefresh.resolve({
      notifications: [{ id: 'new', business_id: 'biz_a', is_read: true }],
    })
    await refresh
    expect(store.notifications.map((item) => item.id)).toEqual(['new'])
    expect(store.notificationsLoading).toBe(false)
  })

  test('a refresh started after a mutation request remains current', async () => {
    const pendingMutation = deferred()
    const pendingRefresh = deferred()
    store.notifications = [
      { id: 'n_1', businessId: 'biz_a', isRead: false, type: 'lead' },
    ]
    store.notificationsLoadedForBusinessId = 'biz_a'
    gatewayApi.markNotificationRead = () => pendingMutation.promise

    const mutation = store.markNotificationRead('n_1')
    gatewayApi.listNotifications = () => pendingRefresh.promise
    const refresh = store.refreshNotifications()
    pendingMutation.resolve({ success: true })
    await mutation
    expect(store.notifications[0].isRead).toBe(true)
    expect(store.notificationsLoading).toBe(true)

    pendingRefresh.resolve({
      notifications: [{ id: 'n_2', business_id: 'biz_a', is_read: false }],
    })
    await refresh
    expect(store.notifications.map((item) => item.id)).toEqual(['n_2'])
    expect(store.notificationUnreadCount).toBe(1)
    expect(store.notificationsLoading).toBe(false)
  })
})
