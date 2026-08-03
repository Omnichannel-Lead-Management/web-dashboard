import { describe, expect, test } from 'bun:test'
import {
  calculatePercentage,
  mapAnalyticsResponse,
  normalizeAnalyticsNumber,
} from './analytics'
describe('analytics normalization', () => {
  test('rejects a response without recognized analytics data', () =>
    expect(mapAnalyticsResponse({ success: true })).toBeNull())
  test('maps snake and camel fields while preserving genuine zero and missing null', () => {
    const source = {
      summary: {
        conversations: 0,
        converted_leads: 2,
        conversionRate: 25,
        conversion_value: 12.5,
      },
      trends: {
        leads: [
          { date: '2026-02-02', count: 2 },
          { date: '2026-02-01', count: 1 },
          { date: '2026-02-02', count: 3 },
        ],
      },
      channels: [{ channel: 'telegram', count: 2 }, { count: 1 }],
    }
    const copy = structuredClone(source)
    const mapped = mapAnalyticsResponse(source)
    expect(mapped.summary).toMatchObject({
      conversations: 0,
      convertedLeads: 2,
      conversionRate: 25,
      conversionValue: 12.5,
      leads: null,
      currency: '',
    })
    expect(mapped.trends.leads).toEqual([
      { date: '2026-02-01', value: 1 },
      { date: '2026-02-02', value: 3 },
    ])
    expect(mapped.channels[1]).toEqual({ category: 'Other', value: 1 })
    expect(source).toEqual(copy)
  })
  test('rejects impossible and non-finite values', () => {
    expect(normalizeAnalyticsNumber(NaN, { count: true })).toBeNull()
    expect(normalizeAnalyticsNumber(Infinity)).toBeNull()
    expect(normalizeAnalyticsNumber(-1, { count: true })).toBeNull()
    expect(normalizeAnalyticsNumber('nope')).toBeNull()
  })
  test('percentage division by zero is unavailable and valid ratios are bounded', () => {
    expect(calculatePercentage(1, 0)).toBeNull()
    expect(calculatePercentage(1, 4)).toBe(25)
    expect(calculatePercentage(5, 4)).toBe(100)
  })
  test('invalid generated timestamp degrades to null', () =>
    expect(
      mapAnalyticsResponse({ summary: {}, generated_at: 'bad' }).generatedAt,
    ).toBeNull())
})
