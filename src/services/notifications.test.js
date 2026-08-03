import { describe, expect, test } from 'bun:test'
import {
  filterNotifications,
  getUnreadNotificationCount,
  isSafeNotificationActionUrl,
  mapNotification,
  mapNotificationsResponse,
} from './notifications.js'

describe('notification normalization', () => {
  test('maps snake_case and camelCase records without mutating the source', () => {
    const snake = {
      id: 'n_1',
      business_id: 'biz_1',
      notification_type: 'lead',
      title: ' New lead ',
      message: ' A customer enquired ',
      is_read: false,
      created_at: '2026-08-01T10:00:00Z',
      action_url: '/leads/n_1',
      metadata: { private: 'not rendered' },
    }
    const snapshot = structuredClone(snake)
    expect(mapNotification(snake)).toMatchObject({
      id: 'n_1',
      businessId: 'biz_1',
      type: 'lead',
      title: 'New lead',
      body: 'A customer enquired',
      isRead: false,
      actionUrl: '/leads/n_1',
    })
    expect(snake).toEqual(snapshot)

    expect(
      mapNotification({
        notificationId: 'n_2',
        businessId: 'biz_1',
        notificationType: 'appointment',
        isRead: true,
        createdAt: '2026-08-01T11:00:00Z',
      }),
    ).toMatchObject({ id: 'n_2', type: 'appointment', isRead: true })
  })

  test('rejects missing IDs and normalizes unknown types and invalid timestamps', () => {
    expect(mapNotification({ title: 'No ID' })).toBeNull()
    expect(
      mapNotification({ id: 'n_1', type: 'custom', created_at: 'bad' }),
    ).toMatchObject({ type: 'other', createdAt: '' })
  })

  test('accepts only safe dashboard-relative action URLs', () => {
    expect(isSafeNotificationActionUrl('/inbox?conversation=1')).toBe(true)
    expect(isSafeNotificationActionUrl('/appointments/one')).toBe(true)
    expect(isSafeNotificationActionUrl('https://evil.test/leads')).toBe(false)
    expect(isSafeNotificationActionUrl('//evil.test/leads')).toBe(false)
    expect(isSafeNotificationActionUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeNotificationActionUrl('/unknown')).toBe(false)
  })

  test('maps response wrappers, counts unread and filters immutably', () => {
    const rows = mapNotificationsResponse({
      notifications: [
        { id: '1', type: 'lead', is_read: false },
        { id: '2', type: 'system', is_read: true },
        { id: '3', type: 'unknown', is_read: false },
      ],
    })
    const snapshot = structuredClone(rows)
    expect(getUnreadNotificationCount(rows)).toBe(2)
    expect(filterNotifications(rows, 'unread').map((item) => item.id)).toEqual([
      '1',
      '3',
    ])
    expect(filterNotifications(rows, 'leads').map((item) => item.id)).toEqual([
      '1',
    ])
    expect(filterNotifications(rows, 'all')).toEqual(rows)
    expect(rows).toEqual(snapshot)
  })
})
