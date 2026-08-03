export const ONBOARDING_VERSION = 1
export const ONBOARDING_STEP_COUNT = 6

const KEY_PREFIX = 'omnichannel:onboarding:v1:'

export function onboardingProgressKey(businessId) {
  return `${KEY_PREFIX}${String(businessId || '').trim()}`
}

function validBusinessId(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeStep(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1
  return Math.min(ONBOARDING_STEP_COUNT, Math.max(1, Math.trunc(numeric)))
}

function normalizeSteps(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter(Number.isInteger))]
    .filter((step) => step >= 1 && step <= ONBOARDING_STEP_COUNT)
    .sort((left, right) => left - right)
}

export function createOnboardingProgress(businessId) {
  const normalizedBusinessId = String(businessId || '').trim()
  return {
    version: ONBOARDING_VERSION,
    businessId: normalizedBusinessId,
    currentStep: 1,
    completedSteps: [],
    skippedSteps: [],
    blockedSteps: [],
    locallyFinished: false,
    updatedAt: 0,
  }
}

export function sanitizeOnboardingProgress(value, businessId) {
  const expectedBusinessId = String(businessId || '').trim()
  if (!validBusinessId(expectedBusinessId)) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.version !== ONBOARDING_VERSION) return null
  if (value.businessId !== expectedBusinessId) return null

  const completedSteps = normalizeSteps(value.completedSteps)
  const skippedSteps = normalizeSteps(value.skippedSteps).filter(
    (step) => !completedSteps.includes(step),
  )
  const blockedSteps = normalizeSteps(value.blockedSteps).filter(
    (step) => !completedSteps.includes(step) && !skippedSteps.includes(step),
  )

  return {
    version: ONBOARDING_VERSION,
    businessId: expectedBusinessId,
    currentStep: normalizeStep(value.currentStep),
    completedSteps,
    skippedSteps,
    blockedSteps,
    locallyFinished: value.locallyFinished === true,
    updatedAt:
      Number.isFinite(Number(value.updatedAt)) && Number(value.updatedAt) >= 0
        ? Math.trunc(Number(value.updatedAt))
        : 0,
  }
}

export function loadOnboardingProgress(businessId, storage = localStorage) {
  const fallback = createOnboardingProgress(businessId)
  if (!validBusinessId(fallback.businessId)) return fallback
  let parsed
  try {
    const raw = storage.getItem(onboardingProgressKey(fallback.businessId))
    if (!raw) return fallback
    parsed = JSON.parse(raw)
  } catch {
    return fallback
  }
  return sanitizeOnboardingProgress(parsed, fallback.businessId) || fallback
}

export function saveOnboardingProgress(progress, storage = localStorage) {
  const sanitized = sanitizeOnboardingProgress(progress, progress?.businessId)
  if (!sanitized) return null
  const saved = { ...sanitized, updatedAt: Date.now() }
  storage.setItem(
    onboardingProgressKey(saved.businessId),
    JSON.stringify(saved),
  )
  return saved
}

export function removeOnboardingProgress(businessId, storage = localStorage) {
  const normalizedBusinessId = String(businessId || '').trim()
  if (!normalizedBusinessId) return false
  storage.removeItem(onboardingProgressKey(normalizedBusinessId))
  return true
}
