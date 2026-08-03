import { beforeEach, describe, expect, test } from 'bun:test'
import {
  createOnboardingProgress,
  loadOnboardingProgress,
  onboardingProgressKey,
  removeOnboardingProgress,
  sanitizeOnboardingProgress,
  saveOnboardingProgress,
} from './onboardingProgress.js'

const values = new Map()
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
}

beforeEach(() => values.clear())

describe('onboarding progress persistence', () => {
  test('uses a versioned business-scoped key', () => {
    expect(onboardingProgressKey('biz_a')).toBe(
      'omnichannel:onboarding:v1:biz_a',
    )
    expect(onboardingProgressKey('biz_b')).not.toBe(
      onboardingProgressKey('biz_a'),
    )
  })

  test('saves and loads valid progress', () => {
    const saved = saveOnboardingProgress(
      {
        ...createOnboardingProgress('biz_a'),
        currentStep: 4,
        completedSteps: [1, 2],
      },
      storage,
    )
    expect(saved.updatedAt).toBeGreaterThan(0)
    expect(loadOnboardingProgress('biz_a', storage)).toEqual(saved)
  })

  test('rejects malformed JSON, wrong versions, and wrong business IDs', () => {
    values.set(onboardingProgressKey('biz_a'), '{not json')
    expect(loadOnboardingProgress('biz_a', storage).currentStep).toBe(1)

    values.set(
      onboardingProgressKey('biz_a'),
      JSON.stringify({ ...createOnboardingProgress('biz_a'), version: 2 }),
    )
    expect(loadOnboardingProgress('biz_a', storage).version).toBe(1)

    values.set(
      onboardingProgressKey('biz_a'),
      JSON.stringify(createOnboardingProgress('biz_b')),
    )
    expect(loadOnboardingProgress('biz_a', storage).businessId).toBe('biz_a')
  })

  test('clamps steps, deduplicates arrays, and removes unknown fields', () => {
    const normalized = sanitizeOnboardingProgress(
      {
        ...createOnboardingProgress('biz_a'),
        currentStep: 99,
        completedSteps: [1, 1, 7, '2'],
        skippedSteps: [2, 3, 3],
        blockedSteps: [3, 4, 4],
        telegramToken: 'must-not-survive',
        unknown: true,
      },
      'biz_a',
    )
    expect(normalized.currentStep).toBe(6)
    expect(normalized.completedSteps).toEqual([1, 2])
    expect(normalized.skippedSteps).toEqual([3])
    expect(normalized.blockedSteps).toEqual([4])
    expect(normalized).not.toHaveProperty('unknown')
    expect(normalized).not.toHaveProperty('telegramToken')
  })

  test('persists local finish without sensitive or unknown fields', () => {
    saveOnboardingProgress(
      {
        ...createOnboardingProgress('biz_a'),
        locallyFinished: true,
        bot_token: 'secret',
        qrcode: 'image',
        faqDraft: 'private draft',
      },
      storage,
    )
    const raw = values.get(onboardingProgressKey('biz_a'))
    expect(raw).not.toContain('secret')
    expect(raw).not.toContain('qrcode')
    expect(raw).not.toContain('private draft')
    expect(JSON.parse(raw).locallyFinished).toBe(true)
  })

  test('removes only the requested business progress', () => {
    saveOnboardingProgress(createOnboardingProgress('biz_a'), storage)
    saveOnboardingProgress(createOnboardingProgress('biz_b'), storage)
    removeOnboardingProgress('biz_a', storage)
    expect(values.has(onboardingProgressKey('biz_a'))).toBe(false)
    expect(values.has(onboardingProgressKey('biz_b'))).toBe(true)
  })
})
