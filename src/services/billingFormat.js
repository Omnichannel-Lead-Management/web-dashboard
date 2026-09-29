/**
 * Formatting shared by the admin console and the tenant's own billing page, so
 * an amount reads identically to the person who sent the bill and the person
 * who received it.
 */

/**
 * `Number(null)` is 0, so a value that is merely absent must be rejected
 * before it is coerced — on a bill, "we do not know" and "nothing to pay" are
 * very different statements.
 */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Currencies here are ISO codes the platform operator chooses (LKR by
 * default), which Intl may not have a symbol for. Falling back to
 * `CODE 1,234.56` is clearer than a bare number.
 */
export function formatMoney(amount, currency = 'LKR') {
  const value = toNumber(amount)
  if (value === null) return '—'

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function formatCount(value) {
  const number = toNumber(value)
  if (number === null) return '—'
  return number.toLocaleString()
}

/** `2026-09-04T…` reads as `4 Sep 2026`; a bare date string stays a date. */
export function formatDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatPeriod(from, to) {
  if (!from || !to) return '—'
  return `${formatDate(from)} – ${formatDate(to)}`
}

/** Maps an invoice status onto the tones AppBadge already knows. */
export function invoiceStatusTone(status) {
  switch (status) {
    case 'paid':
      return 'success'
    case 'sent':
      return 'warning'
    case 'void':
      return 'lost'
    default:
      return 'neutral'
  }
}

export function invoiceStatusLabel(status) {
  switch (status) {
    case 'sent':
      return 'Awaiting payment'
    case 'paid':
      return 'Paid'
    case 'void':
      return 'Void'
    default:
      return 'Draft'
  }
}

/**
 * How much of an allowance a tenant has used. Returned as a percentage capped
 * at 100 for the meter's width, alongside the uncapped figure for the label —
 * "140% of 500" is exactly what a billing admin needs to see.
 */
export function allowanceUsage(used, included) {
  const usedValue = Number(used) || 0
  const includedValue = Number(included) || 0
  if (includedValue <= 0) {
    return { percent: usedValue > 0 ? 100 : 0, exact: null, over: usedValue }
  }

  const exact = Math.round((usedValue / includedValue) * 100)
  return {
    percent: Math.min(100, exact),
    exact,
    over: Math.max(0, usedValue - includedValue),
  }
}
