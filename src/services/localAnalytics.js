const group = (items, pick) =>
  Object.entries(
    items.reduce((result, item) => {
      const key = pick(item) || 'Other'
      result[key] = (result[key] || 0) + 1
      return result
    }, {}),
  ).map(([category, value]) => ({ category, value }))
export const belongsToActiveBusiness = (recordBusinessId, activeBusinessId) => {
  if (!activeBusinessId) return false
  if (
    recordBusinessId === undefined ||
    recordBusinessId === null ||
    recordBusinessId === ''
  )
    return true
  return String(recordBusinessId) === String(activeBusinessId)
}

// These arrays are populated by active-business-scoped store requests. A missing
// row-level ID therefore inherits only that request scope; an explicit mismatch
// is still rejected and the source record is never modified.
const scoped = (items, businessId) =>
  (Array.isArray(items) ? items : []).filter((item) =>
    belongsToActiveBusiness(item?.businessId, businessId),
  )
export function createLocalAnalyticsSnapshot({
  businessId,
  conversations = [],
  leads = [],
  appointments = [],
  escalations = [],
} = {}) {
  const c = scoped(conversations, businessId)
  const l = scoped(leads, businessId)
  const a = scoped(appointments, businessId)
  const e = scoped(escalations, businessId)
  return {
    partial: true,
    businessId: businessId || '',
    empty: !c.length && !l.length && !a.length && !e.length,
    summary: {
      conversations: c.length,
      unreadConversations: c.filter((x) => x.unread).length,
      escalatedConversations: c.filter((x) => x.escalated).length,
      leads: l.length,
      appointments: a.length,
      escalations: e.length,
    },
    leadStatuses: group(l, (x) => x.status),
    appointmentStatuses: group(a, (x) => x.status),
    escalationStatuses: group(e, (x) => x.status),
    trends: null,
  }
}
