import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { gatewayApi } from '../services/gatewayApi.js'
import { useAppStore } from './app.js'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

let store

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_1'
  store.faqs = []
})

describe('FAQ store actions', () => {
  test('loads FAQs with the active business ID', async () => {
    let receivedBusinessId
    gatewayApi.listFaqs = async (businessId) => {
      receivedBusinessId = businessId
      return { faqs: [{ id: 'faq_1', question: 'Hours?', answer: '9–5' }] }
    }

    await store.refreshFaqs()

    expect(receivedBusinessId).toBe('biz_1')
    expect(store.faqs[0].id).toBe('faq_1')
    expect(store.faqError).toBe('')
  })

  test('create waits for a valid response before adding or notifying', async () => {
    const pending = deferred()
    gatewayApi.createFaq = () => pending.promise

    const request = store.createFaq({ question: ' Hours? ', answer: ' 9–5 ' })
    expect(store.faqs).toEqual([])
    expect(store.toast).toBeNull()
    pending.resolve({ faq: { id: 'faq_1', question: 'Hours?', answer: '9–5' } })
    await request

    expect(store.faqs[0].id).toBe('faq_1')
    expect(store.toast).toEqual({ message: 'FAQ created', type: 'success' })
  })

  test('normal update applies only after the successful response', async () => {
    store.faqs = [{ id: 'faq_1', question: 'Old?', answer: 'Old', enabled: true, keywords: [] }]
    const pending = deferred()
    gatewayApi.updateFaq = () => pending.promise

    const request = store.updateFaq('faq_1', {
      question: 'New?',
      answer: 'New',
      keywords: [],
      enabled: true,
    })
    expect(store.faqs[0].question).toBe('Old?')
    expect(store.toast).toBeNull()
    pending.resolve({ faq: { id: 'faq_1', question: 'New?', answer: 'New', enabled: true } })
    await request

    expect(store.faqs[0].question).toBe('New?')
    expect(store.toast.message).toBe('FAQ updated')
  })

  test('toggle is optimistic and rolls back with an error notification', async () => {
    store.faqs = [{ id: 'faq_1', enabled: true }]
    const pending = deferred()
    let payload
    gatewayApi.updateFaq = (_id, changes) => {
      payload = changes
      return pending.promise
    }

    const request = store.updateFaq('faq_1', { enabled: false })
    expect(payload).toEqual({ enabled: false })
    expect(store.faqs[0].enabled).toBe(false)
    pending.reject(new Error('Toggle rejected'))
    await expect(request).rejects.toThrow('Toggle rejected')

    expect(store.faqs[0].enabled).toBe(true)
    expect(store.toast).toEqual({ message: 'Toggle rejected', type: 'error' })
  })

  test('delete keeps the FAQ until confirmed success', async () => {
    store.faqs = [{ id: 'faq_1' }]
    const pending = deferred()
    gatewayApi.deleteFaq = () => pending.promise

    const request = store.deleteFaq('faq_1')
    expect(store.faqs).toHaveLength(1)
    expect(store.toast).toBeNull()
    pending.resolve(null)
    await request

    expect(store.faqs).toEqual([])
    expect(store.toast.message).toBe('FAQ deleted')
  })

  test('invalid successful mutation response does not report success', async () => {
    gatewayApi.createFaq = async () => ({ success: true })

    await expect(
      store.createFaq({ question: 'Question', answer: 'Answer' }),
    ).rejects.toThrow('invalid FAQ response')
    expect(store.faqs).toEqual([])
    expect(store.toast.type).toBe('error')
  })

  test('logout clears FAQ state and invalidates an old list response', async () => {
    store.faqs = [{ id: 'cached_faq' }]
    store.faqError = 'Old error'
    const pending = deferred()
    gatewayApi.listFaqs = () => pending.promise

    const request = store.refreshFaqs()
    store.logout()
    pending.resolve({ faqs: [{ id: 'old_tenant_faq' }] })
    await request

    expect(store.faqs).toEqual([])
    expect(store.faqError).toBe('')
    expect(store.loadingFaqs).toBe(false)
    expect(store.toast).toBeNull()
  })

  test('successful create cannot be overwritten by an older list response', async () => {
    const oldList = deferred()
    gatewayApi.listFaqs = () => oldList.promise
    gatewayApi.createFaq = async () => ({
      faq: { id: 'faq_new', question: 'New?', answer: 'New answer' },
    })

    const listRequest = store.refreshFaqs()
    await store.createFaq({ question: 'New?', answer: 'New answer' })
    oldList.resolve({ faqs: [{ id: 'faq_old', question: 'Old?' }] })
    await listRequest

    expect(store.faqs.map((faq) => faq.id)).toEqual(['faq_new'])
    expect(store.loadingFaqs).toBe(false)
    expect(store.faqError).toBe('')
  })

  test('successful edit cannot be overwritten by an older list response', async () => {
    store.faqs = [{ id: 'faq_1', question: 'Old?', answer: 'Old', keywords: [], enabled: true }]
    const oldList = deferred()
    gatewayApi.listFaqs = () => oldList.promise
    gatewayApi.updateFaq = async () => ({
      faq: { id: 'faq_1', question: 'New?', answer: 'New', enabled: true },
    })

    const listRequest = store.refreshFaqs()
    await store.updateFaq('faq_1', {
      question: 'New?',
      answer: 'New',
      keywords: [],
      enabled: true,
    })
    oldList.resolve({ faqs: [{ id: 'faq_1', question: 'Old?', answer: 'Old' }] })
    await listRequest

    expect(store.faqs[0].question).toBe('New?')
  })

  test('confirmed toggle cannot be overwritten by an older list response', async () => {
    store.faqs = [{ id: 'faq_1', enabled: true }]
    const oldList = deferred()
    gatewayApi.listFaqs = () => oldList.promise
    gatewayApi.updateFaq = async () => ({
      faq: { id: 'faq_1', enabled: false },
    })

    const listRequest = store.refreshFaqs()
    await store.updateFaq('faq_1', { enabled: false })
    oldList.resolve({ faqs: [{ id: 'faq_1', enabled: true }] })
    await listRequest

    expect(store.faqs[0].enabled).toBe(false)
  })

  test('confirmed delete cannot be undone by an older list response', async () => {
    store.faqs = [{ id: 'faq_1' }]
    const oldList = deferred()
    gatewayApi.listFaqs = () => oldList.promise
    gatewayApi.deleteFaq = async () => null

    const listRequest = store.refreshFaqs()
    await store.deleteFaq('faq_1')
    oldList.resolve({ faqs: [{ id: 'faq_1' }] })
    await listRequest

    expect(store.faqs).toEqual([])
    expect(store.loadingFaqs).toBe(false)
  })

  test('failed mutation does not invalidate a valid list request', async () => {
    const list = deferred()
    gatewayApi.listFaqs = () => list.promise
    gatewayApi.createFaq = async () => {
      throw new Error('Create rejected')
    }

    const listRequest = store.refreshFaqs()
    await expect(
      store.createFaq({ question: 'New?', answer: 'New answer' }),
    ).rejects.toThrow('Create rejected')
    list.resolve({ faqs: [{ id: 'faq_from_list' }] })
    await listRequest

    expect(store.faqs.map((faq) => faq.id)).toEqual(['faq_from_list'])
    expect(store.loadingFaqs).toBe(false)
  })

  test('stale mutation after logout cannot invalidate the new session list', async () => {
    const oldCreate = deferred()
    const newList = deferred()
    gatewayApi.createFaq = () => oldCreate.promise
    gatewayApi.listFaqs = () => newList.promise

    const createRequest = store.createFaq({ question: 'Old?', answer: 'Old' })
    store.logout()
    store.businessId = 'biz_2'
    store.authenticated = true
    const listRequest = store.refreshFaqs()
    oldCreate.resolve({ faq: { id: 'old_tenant_faq' } })
    await createRequest
    newList.resolve({ faqs: [{ id: 'new_tenant_faq' }] })
    await listRequest

    expect(store.faqs.map((faq) => faq.id)).toEqual(['new_tenant_faq'])
    expect(store.toast).toBeNull()
    expect(store.loadingFaqs).toBe(false)
  })
})
