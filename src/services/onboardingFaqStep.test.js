import { describe, expect, test } from 'bun:test'
import {
  createOnboardingFaqStepLoader,
  hasConfirmedFaqForBusiness,
} from './onboardingFaqStep.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function makeStore(refreshFaqs) {
  return { businessId: 'biz_a', faqs: [], refreshFaqs }
}

describe('onboarding FAQ step loader', () => {
  test('entering the step uses the existing refresh action and confirms existing FAQs', async () => {
    let calls = 0
    const store = makeStore(async () => {
      calls += 1
      store.faqs = [{ id: 'faq_1', businessId: 'biz_a' }]
      return store.faqs
    })
    const loader = createOnboardingFaqStepLoader(store)

    const result = await loader.enter('biz_a')

    expect(calls).toBe(1)
    expect(result.status).toBe('loaded')
    expect(hasConfirmedFaqForBusiness(result.faqs, 'biz_a')).toBe(true)
  })

  test('an empty successful response remains loaded but incomplete', async () => {
    const store = makeStore(async () => [])
    const result = await createOnboardingFaqStepLoader(store).enter('biz_a')

    expect(result).toEqual({ status: 'loaded', businessId: 'biz_a', faqs: [] })
    expect(hasConfirmedFaqForBusiness(result.faqs, 'biz_a')).toBe(false)
  })

  test('a backend failure remains failed and can be retried', async () => {
    let calls = 0
    const error = Object.assign(new Error('Gateway proxy unavailable'), {
      status: 404,
    })
    const store = makeStore(async () => {
      calls += 1
      throw error
    })
    const loader = createOnboardingFaqStepLoader(store)

    expect((await loader.enter('biz_a')).status).toBe('failed')
    expect((await loader.enter('biz_a')).status).toBe('failed')
    expect(calls).toBe(2)
  })

  test('a stale Business A response cannot complete Business B', async () => {
    const pendingA = deferred()
    const store = makeStore(() => pendingA.promise)
    const loader = createOnboardingFaqStepLoader(store)
    const requestA = loader.enter('biz_a')

    store.businessId = 'biz_b'
    loader.invalidate()
    pendingA.resolve([{ id: 'faq_a', businessId: 'biz_a' }])

    expect((await requestA).status).toBe('stale')
  })

  test('does not refresh the same successfully loaded business repeatedly', async () => {
    let calls = 0
    const store = makeStore(async () => {
      calls += 1
      return []
    })
    const loader = createOnboardingFaqStepLoader(store)

    await loader.enter('biz_a')
    await loader.enter('biz_a')

    expect(calls).toBe(1)
  })
})
