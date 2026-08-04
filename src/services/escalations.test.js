import { describe, expect, test } from 'bun:test'
import {
  filterEscalations,
  getEscalationOwnership,
  getEscalationQueueAge,
  mapEscalation,
  mapEscalationQueue,
  sortEscalations,
} from './escalations'

const row = (changes = {}) => ({
  messenger_id: 'm1',
  platform: 'telegram',
  business_id: 'b1',
  display_name: 'Ana',
  escalation_status: 'queued',
  escalation_requested_at: '2026-08-03T10:00:00Z',
  escalation_tag: 'billing',
  escalation_summary: 'Needs help',
  ...changes,
})

describe('escalation helpers', () => {
  test('maps snake and camel case without mutation or priority', () => {
    const source = row()
    const before = structuredClone(source)
    expect(mapEscalation(source)).toMatchObject({
      id: 'telegram:m1',
      businessId: 'b1',
      status: 'queued',
      tag: 'billing',
    })
    expect(
      mapEscalation({
        platform: 'web',
        messengerId: 'm2',
        businessId: 'b2',
        displayName: 'Sam',
        escalationStatus: 'claimed',
        claimedByAgentId: 'a1',
      }),
    ).toMatchObject({ status: 'claimed', claimedByAgentId: 'a1' })
    expect(source).toEqual(before)
    expect(mapEscalation(source)).not.toHaveProperty('priority')
  })
  test('rejects missing identifiers and safely normalizes unknown status', () => {
    expect(mapEscalation({ platform: 'web' })).toBeNull()
    expect(mapEscalation(row({ escalation_status: 'resolved' })).status).toBe(
      'unknown',
    )
  })
  test('deduplicates and derives ownership', () => {
    expect(
      mapEscalationQueue([row(), row({ escalation_summary: 'new' })]),
    ).toHaveLength(1)
    const claimed = mapEscalation(
      row({ escalation_status: 'claimed', claimed_by_agent_id: 'a1' }),
    )
    expect(getEscalationOwnership(claimed, 'a1')).toBe('mine')
    expect(getEscalationOwnership(claimed, 'a2')).toBe('other')
    expect(getEscalationOwnership(claimed, '')).toBe('missing-agent')
  })
  test('formats queue age and invalid timestamps', () => {
    expect(
      getEscalationQueueAge(
        '2026-08-03T10:00:00Z',
        new Date('2026-08-03T11:12:00Z').getTime(),
      ),
    ).toBe('Waiting 1 hr 12 min')
    expect(getEscalationQueueAge(null)).toBe('Waiting time unavailable')
  })
  test('filters/searches and sorts without mutation', () => {
    const items = mapEscalationQueue([
      row(),
      row({
        messenger_id: 'm2',
        display_name: 'Bob',
        escalation_status: 'claimed',
        claimed_by_agent_id: 'a1',
        claimed_at: '2026-08-03T12:00:00Z',
      }),
    ])
    const before = structuredClone(items)
    expect(
      filterEscalations(items, { filter: 'mine', agentId: 'a1' }),
    ).toHaveLength(1)
    expect(filterEscalations(items, { search: 'billing' })).toHaveLength(2)
    expect(sortEscalations(items)[0].status).toBe('queued')
    const missing = mapEscalation(
      row({ messenger_id: 'm3', escalation_requested_at: null }),
    )
    expect(sortEscalations([missing, items[0]], 'newest').at(-1).id).toBe(
      'telegram:m3',
    )
    expect(items).toEqual(before)
  })
})
