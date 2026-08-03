import { describe, expect, test } from 'bun:test'
import {
  belongsToActiveBusiness,
  createLocalAnalyticsSnapshot,
} from './localAnalytics'
describe('local analytics snapshot', () => {
  test('counts only loaded tenant data and remains explicitly partial', () => {
    const input = {
      businessId: 'a',
      conversations: [
        { businessId: 'a', unread: true, escalated: true },
        { businessId: 'b' },
      ],
      leads: [
        { businessId: 'a', status: 'new' },
        { businessId: 'a', status: 'new' },
      ],
      appointments: [{ businessId: 'a', status: 'booked' }],
      escalations: [{ businessId: 'a', status: 'queued' }],
    }
    const copy = structuredClone(input)
    const result = createLocalAnalyticsSnapshot(input)
    expect(result.partial).toBe(true)
    expect(result.summary).toEqual({
      conversations: 1,
      unreadConversations: 1,
      escalatedConversations: 1,
      leads: 2,
      appointments: 1,
      escalations: 1,
    })
    expect(result.leadStatuses).toEqual([{ category: 'new', value: 2 }])
    expect(result.trends).toBeNull()
    expect(input).toEqual(copy)
  })
  test('empty inputs are explicitly empty', () =>
    expect(createLocalAnalyticsSnapshot({ businessId: 'a' })).toMatchObject({
      partial: true,
      empty: true,
    }))

  test('includes missing tenant IDs only within an active scoped collection', () => {
    const conversations = [
      { id: 'matching', businessId: 'a' },
      { id: 'missing', unread: true },
      { id: 'empty', businessId: '', escalated: true },
      { id: 'null', businessId: null },
      { id: 'other', businessId: 'b', unread: true, escalated: true },
    ]
    const copy = structuredClone(conversations)

    const result = createLocalAnalyticsSnapshot({
      businessId: 'a',
      conversations,
    })

    expect(result.summary.conversations).toBe(4)
    expect(result.summary.unreadConversations).toBe(1)
    expect(result.summary.escalatedConversations).toBe(1)
    expect(conversations).toEqual(copy)
  })

  test('requires an active business and rejects explicit cross-business rows', () => {
    expect(belongsToActiveBusiness(undefined, '')).toBe(false)
    expect(belongsToActiveBusiness('', null)).toBe(false)
    expect(belongsToActiveBusiness('a', 'b')).toBe(false)
    expect(belongsToActiveBusiness(undefined, 'a')).toBe(true)
    expect(belongsToActiveBusiness('', 'a')).toBe(true)
    expect(belongsToActiveBusiness(null, 'a')).toBe(true)
    expect(belongsToActiveBusiness(7, '7')).toBe(true)

    const result = createLocalAnalyticsSnapshot({
      conversations: [{ id: 'missing' }, { id: 'explicit', businessId: 'a' }],
    })
    expect(result.summary.conversations).toBe(0)
    expect(result.empty).toBe(true)
  })

  test('recalculates only from the active business collection after a switch', () => {
    const businessA = createLocalAnalyticsSnapshot({
      businessId: 'a',
      conversations: [{ id: 'a-row' }],
    })
    const businessB = createLocalAnalyticsSnapshot({
      businessId: 'b',
      conversations: [
        { id: 'b-row' },
        { id: 'stale-explicit-a', businessId: 'a' },
      ],
    })

    expect(businessA.summary.conversations).toBe(1)
    expect(businessB.summary.conversations).toBe(1)
  })

  test('applies inherited request scope consistently to other scoped store rows', () => {
    const result = createLocalAnalyticsSnapshot({
      businessId: 'a',
      leads: [{ status: 'new' }, { businessId: 'b', status: 'converted' }],
      appointments: [{ businessId: '', status: 'booked' }],
      escalations: [{ businessId: null, status: 'queued' }],
    })

    expect(result.summary).toMatchObject({
      leads: 1,
      appointments: 1,
      escalations: 1,
    })
    expect(result.leadStatuses).toEqual([{ category: 'new', value: 1 }])
    expect(result.appointmentStatuses).toEqual([
      { category: 'booked', value: 1 },
    ])
    expect(result.escalationStatuses).toEqual([
      { category: 'queued', value: 1 },
    ])
  })
})
