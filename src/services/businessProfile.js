export const BUSINESS_TIMEZONES = [
  'Asia/Colombo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
]

export const BUSINESS_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export function isValidBusinessEmail(value) {
  const email = String(value ?? '').trim()
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidBusinessPhone(value) {
  const phone = String(value ?? '').trim()
  if (!phone) return true
  if (!/^\+?[\d\s().-]+$/.test(phone)) return false
  return phone.replace(/\D/g, '').length >= 7
}

export function validateBusinessHours(hours) {
  const errors = {}
  for (const day of BUSINESS_DAYS) {
    const value = hours?.[day]
    if (!value?.enabled) continue
    if (!value.open || !value.close) {
      errors[day] = 'Open and close times are required.'
    } else if (value.close <= value.open) {
      errors[day] = 'Close time must be after open time.'
    }
  }
  return errors
}

export function optionsWithCurrent(options, current) {
  const value = String(current ?? '').trim()
  return value && !options.includes(value) ? [value, ...options] : options
}

export function cloneBusinessProfileDraft(profile) {
  return structuredClone(profile)
}

export function hasBusinessProfileChanges(patch) {
  return Boolean(patch && Object.keys(patch).length)
}

export function canSubmitBusinessProfile({
  capabilityEnabled,
  hasConfirmedBusiness,
  valid,
  changed,
  saving,
}) {
  return Boolean(
    capabilityEnabled && hasConfirmedBusiness && valid && changed && !saving,
  )
}

export function activeBusinessForTenant(business, businessId) {
  return businessId && business?.id === businessId ? business : null
}

export function reconcileBusinessProfileDraft({
  confirmed,
  baseline,
  draft,
  hasUnsavedChanges,
  force = false,
}) {
  const nextBaseline = cloneBusinessProfileDraft(confirmed)
  const replaceDraft =
    force || baseline?.id !== nextBaseline.id || !hasUnsavedChanges
  let nextDraft = nextBaseline
  if (!replaceDraft) {
    nextDraft = cloneBusinessProfileDraft(nextBaseline)
    for (const field of [
      'name',
      'sector',
      'ownerEmail',
      'timezone',
      'contactPhone',
      'address',
      'businessHours',
    ]) {
      if (
        JSON.stringify(draft?.[field]) !== JSON.stringify(baseline?.[field])
      ) {
        nextDraft[field] = cloneBusinessProfileDraft(draft[field])
      }
    }
  }
  return {
    baseline: nextBaseline,
    draft: cloneBusinessProfileDraft(nextDraft),
    preservedDraft: !replaceDraft,
  }
}
