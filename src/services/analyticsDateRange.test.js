import { describe, expect, test } from 'bun:test'
import {
  createAnalyticsDateRange,
  getAnalyticsPresetRange,
  isValidAnalyticsDateRange,
  normalizeAnalyticsDateRange,
  normalizeAnalyticsTimezone,
  rebaseAnalyticsRangeTimezone,
} from './analyticsDateRange'
const now = new Date('2026-08-03T12:00:00Z')
describe('analytics date ranges', () => {
  test('uses the selected timezone calendar date', () => {
    const result = getAnalyticsPresetRange(
      '7d',
      new Date('2026-08-03T20:00:00Z'),
      'Asia/Colombo',
    )
    expect(result.to).toBe('2026-08-04')
    expect(result.from).toBe('2026-07-29')
  })
  test('creates fixed presets inclusively', () => {
    expect(getAnalyticsPresetRange('7d', now, 'Asia/Colombo')).toEqual({
      preset: '7d',
      from: '2026-07-28',
      to: '2026-08-03',
      timezone: 'Asia/Colombo',
    })
    expect(createAnalyticsDateRange('UTC', now).from).toBe('2026-07-05')
    expect(getAnalyticsPresetRange('90d', now).from).toBe('2026-05-06')
    expect(getAnalyticsPresetRange('month', now).from).toBe('2026-08-01')
  })
  test('validates custom order and real calendar dates', () => {
    expect(
      isValidAnalyticsDateRange({ from: '2026-08-01', to: '2026-08-03' }),
    ).toBe(true)
    expect(
      isValidAnalyticsDateRange({ from: '2026-08-04', to: '2026-08-03' }),
    ).toBe(false)
    expect(
      isValidAnalyticsDateRange({ from: '2026-02-31', to: '2026-03-01' }),
    ).toBe(false)
  })
  test('normalizes without mutating and retains timezone', () => {
    const source = {
      preset: 'custom',
      from: '2026-08-01',
      to: '2026-08-02',
      timezone: 'Asia/Colombo',
    }
    expect(normalizeAnalyticsDateRange(source)).toEqual(source)
    expect(source.timezone).toBe('Asia/Colombo')
  })
  test('validates configured timezone names with a safe fallback signal', () => {
    expect(normalizeAnalyticsTimezone(' Asia/Colombo ')).toBe('Asia/Colombo')
    expect(normalizeAnalyticsTimezone('Not/A-Timezone')).toBe('')
    expect(normalizeAnalyticsTimezone(null)).toBe('')
  })
  test('rebases every preset using the new timezone', () => {
    const edge = new Date('2026-08-03T20:00:00Z')
    for (const preset of ['7d', '30d', '90d', 'month']) {
      const initial = getAnalyticsPresetRange(preset, edge, 'UTC')
      const rebased = rebaseAnalyticsRangeTimezone(
        initial,
        'Asia/Colombo',
        edge,
      )
      expect(rebased.preset).toBe(preset)
      expect(rebased.timezone).toBe('Asia/Colombo')
      expect(rebased.to).toBe('2026-08-04')
    }
  })
  test('custom dates remain fixed while their timezone changes', () => {
    const source = {
      preset: 'custom',
      from: '2026-07-01',
      to: '2026-07-12',
      timezone: 'UTC',
    }
    expect(rebaseAnalyticsRangeTimezone(source, 'Asia/Colombo', now)).toEqual({
      ...source,
      timezone: 'Asia/Colombo',
    })
    expect(source.timezone).toBe('UTC')
  })
})
