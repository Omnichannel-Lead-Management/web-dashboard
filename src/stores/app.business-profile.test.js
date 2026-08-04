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
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let store
beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_a'
  store.business = {
    id: 'biz_a',
    name: 'Original',
    sector: 'Salon',
    whatsapp_connected: true,
  }
  store.toast = null
})

describe('business profile store save', () => {
  test('same-business success updates confirmed state only after response', async () => {
    const pending = deferred()
    gatewayApi.updateBusiness = () => pending.promise
    const request = store.saveBusinessProfile({
      name: 'Updated',
      sector: 'Healthcare',
    })
    expect(store.business.name).toBe('Original')
    pending.resolve({
      business: { id: 'biz_a', name: 'Updated', sector: 'Healthcare' },
    })
    const result = await request
    expect(result.name).toBe('Updated')
    expect(store.business.name).toBe('Updated')
    expect(store.business.sector).toBe('Healthcare')
    expect(store.business.whatsapp_connected).toBe(true)
    expect(store.toast).toEqual({
      message: 'Business profile saved',
      type: 'success',
    })
  })

  test('failure preserves confirmed state and remains retryable', async () => {
    let calls = 0
    gatewayApi.updateBusiness = async () => {
      calls += 1
      if (calls === 1) throw new Error('Save failed')
      return { business: { id: 'biz_a', name: 'Retried' } }
    }
    await expect(store.saveBusinessProfile({ name: 'Failed' })).rejects.toThrow(
      'Save failed',
    )
    expect(store.business.name).toBe('Original')
    expect(store.business.sector).toBe('Salon')
    expect(store.businessProfileError).toBe('Save failed')
    await store.saveBusinessProfile({ name: 'Retried' })
    expect(store.business.name).toBe('Retried')
  })

  test('Business A stale response cannot update or notify Business B', async () => {
    const pending = deferred()
    gatewayApi.updateBusiness = () => pending.promise
    const request = store.saveBusinessProfile({ name: 'A updated' })
    store.businessId = 'biz_b'
    store.business = { id: 'biz_b', name: 'Business B' }
    store.toast = null
    pending.resolve({ business: { id: 'biz_a', name: 'A updated' } })
    expect(await request).toBeNull()
    expect(store.business).toEqual({ id: 'biz_b', name: 'Business B' })
    expect(store.toast).toBeNull()
  })

  test('mismatched returned ID is ignored without success', async () => {
    gatewayApi.updateBusiness = async () => ({
      business: { id: 'biz_b', name: 'Wrong' },
    })
    expect(await store.saveBusinessProfile({ name: 'Updated' })).toBeNull()
    expect(store.business.name).toBe('Original')
    expect(store.toast).toBeNull()
  })

  test('logout invalidates a pending save', async () => {
    const pending = deferred()
    gatewayApi.updateBusiness = () => pending.promise
    const request = store.saveBusinessProfile({ name: 'Updated' })
    store.logout()
    pending.resolve({ business: { id: 'biz_a', name: 'Updated' } })
    expect(await request).toBeNull()
    expect(store.business).toBeNull()
    expect(store.toast).toBeNull()
  })

  test('empty patch is rejected before submission', async () => {
    let called = false
    gatewayApi.updateBusiness = async () => {
      called = true
    }
    await expect(store.saveBusinessProfile({})).rejects.toThrow(
      'No business profile changes',
    )
    expect(called).toBe(false)
  })

  test('backend 404 is preserved without optimistic mutation', async () => {
    const error = Object.assign(
      new Error('Business update endpoint not found'),
      { status: 404 },
    )
    gatewayApi.updateBusiness = async () => {
      throw error
    }
    await expect(store.saveBusinessProfile({ name: 'Updated' })).rejects.toBe(
      error,
    )
    expect(store.business.name).toBe('Original')
    // The rejection keeps the platform detail; the owner sees plain language.
    expect(store.businessProfileError).not.toContain('endpoint')
    expect(store.businessProfileError).toBe(
      'We could not find what you were looking for.',
    )
  })
})
