const number = (value, { count = false, percent = false } = {}) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (
    !Number.isFinite(parsed) ||
    (count && (parsed < 0 || !Number.isInteger(parsed)))
  )
    return null
  if (percent && (parsed < 0 || parsed > 100)) return null
  return parsed
}
const date = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value))
    return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}
export const normalizeAnalyticsNumber = number
export const normalizeAnalyticsDate = date
export const calculatePercentage = (part, total) => {
  const a = number(part)
  const b = number(total)
  return a === null || b === null || b <= 0
    ? null
    : Math.min(100, Math.max(0, (a / b) * 100))
}
const valueFrom = (source, snake, camel) => source?.[snake] ?? source?.[camel]
const mapSummary = (source = {}) => ({
  conversations: number(valueFrom(source, 'conversations', 'conversations'), {
    count: true,
  }),
  leads: number(valueFrom(source, 'leads', 'leads'), { count: true }),
  convertedLeads: number(
    valueFrom(source, 'converted_leads', 'convertedLeads'),
    { count: true },
  ),
  conversionRate: number(
    valueFrom(source, 'conversion_rate', 'conversionRate'),
    { percent: true },
  ),
  appointments: number(valueFrom(source, 'appointments', 'appointments'), {
    count: true,
  }),
  completedAppointments: number(
    valueFrom(source, 'completed_appointments', 'completedAppointments'),
    { count: true },
  ),
  cancelledAppointments: number(
    valueFrom(source, 'cancelled_appointments', 'cancelledAppointments'),
    { count: true },
  ),
  conversionValue: number(
    valueFrom(source, 'conversion_value', 'conversionValue'),
  ),
  currency: typeof source.currency === 'string' ? source.currency.trim() : '',
  escalations: number(valueFrom(source, 'escalations', 'escalations'), {
    count: true,
  }),
})
const mapTrend = (rows) => {
  const points = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const day =
      typeof row?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
        ? row.date
        : ''
    const value = number(row?.value ?? row?.count, { count: true })
    if (day && value !== null) points.set(day, { date: day, value })
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date))
}
const mapDistribution = (rows) =>
  (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const value = number(row?.value ?? row?.count, { count: true })
    if (value === null) return []
    const raw = row?.category ?? row?.status ?? row?.channel
    const category =
      typeof raw === 'string' && raw.trim() ? raw.trim() : 'Other'
    return [{ category, value }]
  })
export function mapAnalyticsResponse(source) {
  if (!source || typeof source !== 'object') return null
  const payload =
    source.analytics && typeof source.analytics === 'object'
      ? source.analytics
      : source
  const recognized = [
    'summary',
    'trends',
    'channels',
    'lead_statuses',
    'leadStatuses',
    'appointment_statuses',
    'appointmentStatuses',
    'escalation_statuses',
    'escalationStatuses',
  ].some((key) => Object.prototype.hasOwnProperty.call(payload, key))
  if (!recognized) return null
  const summary = mapSummary(payload.summary)
  const trends = payload.trends || {}
  return {
    range: {
      from: payload.range?.from || '',
      to: payload.range?.to || '',
      timezone: payload.range?.timezone || '',
    },
    summary,
    trends: {
      conversations: mapTrend(trends.conversations),
      leads: mapTrend(trends.leads),
      appointments: mapTrend(trends.appointments),
      conversions: mapTrend(trends.conversions),
    },
    channels: mapDistribution(payload.channels),
    leadStatuses: mapDistribution(
      payload.lead_statuses ?? payload.leadStatuses,
    ),
    appointmentStatuses: mapDistribution(
      payload.appointment_statuses ?? payload.appointmentStatuses,
    ),
    escalationStatuses: mapDistribution(
      payload.escalation_statuses ?? payload.escalationStatuses,
    ),
    generatedAt: date(payload.generated_at ?? payload.generatedAt),
  }
}
