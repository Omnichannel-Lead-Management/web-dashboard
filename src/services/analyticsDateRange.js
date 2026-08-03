const iso = (value) => value.toISOString().slice(0, 10)
export const normalizeAnalyticsTimezone = (value) => {
  if (typeof value !== 'string' || !value.trim()) return ''
  const timezone = value.trim()
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
    return timezone
  } catch {
    return ''
  }
}
const calendarDateInTimezone = (now, timezone) => {
  if (!timezone) {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  }

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    )
    return new Date(
      Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
      ),
    )
  } catch {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  }
}
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}
export function getAnalyticsPresetRange(
  preset = '30d',
  now = new Date(),
  timezone = '',
) {
  const end = calendarDateInTimezone(now, timezone)
  const start = new Date(end)
  if (preset === 'month') start.setUTCDate(1)
  else
    start.setUTCDate(
      start.getUTCDate() - ({ '7d': 6, '90d': 89 }[preset] ?? 29),
    )
  return { preset, from: iso(start), to: iso(end), timezone }
}
export const createAnalyticsDateRange = (timezone = '', now = new Date()) =>
  getAnalyticsPresetRange('30d', now, timezone)
export function rebaseAnalyticsRangeTimezone(
  range,
  timezone,
  now = new Date(),
) {
  if (range?.preset === 'custom') return { ...range, timezone }
  return getAnalyticsPresetRange(range?.preset || '30d', now, timezone)
}
export function normalizeAnalyticsDateRange(source, fallbackTimezone = '') {
  const preset = ['7d', '30d', '90d', 'month', 'custom'].includes(
    source?.preset,
  )
    ? source.preset
    : '30d'
  return {
    preset,
    from: validDate(source?.from) ? source.from : '',
    to: validDate(source?.to) ? source.to : '',
    timezone:
      typeof source?.timezone === 'string' && source.timezone.trim()
        ? source.timezone.trim()
        : fallbackTimezone,
  }
}
export const isValidAnalyticsDateRange = (range) =>
  validDate(range?.from) && validDate(range?.to) && range.from <= range.to
export const analyticsRangeKey = (range) =>
  `${range?.from || ''}|${range?.to || ''}|${range?.timezone || ''}`
