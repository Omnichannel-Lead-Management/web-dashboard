import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { onboardingProgressKey } from '../services/onboardingProgress.js'
import { useAppStore } from './app.js'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
}

let store

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_a'
})

describe('onboarding store', () => {
  test('loads current-business progress and changes steps', () => {
    localStorage.setItem(
      onboardingProgressKey('biz_a'),
      JSON.stringify({
        version: 1,
        businessId: 'biz_a',
        currentStep: 3,
        completedSteps: [1],
        skippedSteps: [],
        blockedSteps: [],
        locallyFinished: false,
        updatedAt: 1,
      }),
    )
    store.loadOnboardingProgress()
    expect(store.onboardingProgress.currentStep).toBe(3)
    store.setOnboardingStep(5)
    expect(store.onboardingProgress.currentStep).toBe(5)
  })

  test('completes, blocks, and skips steps as exclusive states', () => {
    store.markOnboardingStepBlocked(3)
    expect(store.onboardingProgress.blockedSteps).toEqual([3])
    store.skipOnboardingStep(3)
    expect(store.onboardingProgress.blockedSteps).toEqual([])
    expect(store.onboardingProgress.skippedSteps).toEqual([3])
    store.markOnboardingStepComplete(3)
    expect(store.onboardingProgress.completedSteps).toEqual([3])
    expect(store.onboardingProgress.skippedSteps).toEqual([])
  })

  test('finishes locally and stores only the allowed schema', () => {
    store.finishOnboardingLocally()
    expect(store.onboardingProgress.locallyFinished).toBe(true)
    const persisted = JSON.parse(
      localStorage.getItem(onboardingProgressKey('biz_a')),
    )
    expect(Object.keys(persisted).sort()).toEqual(
      [
        'blockedSteps',
        'businessId',
        'completedSteps',
        'currentStep',
        'locallyFinished',
        'skippedSteps',
        'updatedAt',
        'version',
      ].sort(),
    )
    expect(JSON.stringify(store.onboardingProgress)).not.toMatch(
      /bot_token|telegramToken|qrcode|qrImage|faqDraft|welcomeDraft/,
    )
  })

  test('logout clears in-memory state but keeps business-scoped saved progress', () => {
    store.markOnboardingStepComplete(1)
    store.logout()
    expect(store.onboardingLoaded).toBe(false)
    expect(store.onboardingProgress.businessId).toBe('')
    expect(localStorage.getItem(onboardingProgressKey('biz_a'))).not.toBeNull()
  })

  test('business switching loads isolated progress', () => {
    store.markOnboardingStepComplete(1)
    store.businessId = 'biz_b'
    expect(store.onboardingProgress.businessId).toBe('biz_b')
    expect(store.onboardingProgress.completedSteps).toEqual([])
    store.skipOnboardingStep(2)
    store.businessId = 'biz_a'
    expect(store.onboardingProgress.completedSteps).toEqual([1])
    expect(store.onboardingProgress.skippedSteps).toEqual([])
  })

  test('an old business progress reference cannot overwrite the new business', () => {
    store.markOnboardingStepComplete(1)
    const oldProgress = store.onboardingProgress
    store.businessId = 'biz_b'
    oldProgress.completedSteps.push(6)
    store.markOnboardingStepComplete(2)
    expect(store.onboardingProgress.businessId).toBe('biz_b')
    expect(store.onboardingProgress.completedSteps).toEqual([2])
  })

  test('reset removes only active-business progress', () => {
    store.markOnboardingStepComplete(1)
    store.businessId = 'biz_b'
    store.skipOnboardingStep(2)
    store.resetOnboardingProgress()
    expect(localStorage.getItem(onboardingProgressKey('biz_b'))).toBeNull()
    expect(localStorage.getItem(onboardingProgressKey('biz_a'))).not.toBeNull()
    expect(store.onboardingProgress.currentStep).toBe(1)
  })
})

describe('onboarding routing contract', () => {
  test('route exists, uses the shared auth guard, and finishes at an existing inbox route', async () => {
    const routerSource = await Bun.file(
      new URL('../router/index.js', import.meta.url),
    ).text()
    const viewSource = await Bun.file(
      new URL('../views/OnboardingView.vue', import.meta.url),
    ).text()
    expect(routerSource).toContain("path: '/onboarding'")
    expect(routerSource).toContain(
      'if (!to.meta.guest && !store.authenticated)',
    )
    expect(routerSource).toContain("return '/login'")
    expect(routerSource).toContain("path: '/inbox'")
    expect(viewSource).toContain("router.push('/inbox')")
  })
})
