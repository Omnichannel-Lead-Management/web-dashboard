import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'

/**
 * The gateway rejects any request naming a business other than the session's.
 * The build-time pin (VITE_BUSINESS_ID) used to overwrite the stored business
 * id on every store init, so a browser signed in as one tenant kept asking for
 * the pinned tenant and got 403 on everything — "you have no permission",
 * intermittently, because a fresh login worked until the next page load.
 */

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
}

class FakeSocket {
  static OPEN = 1
  constructor() {
    this.readyState = 0
  }
  addEventListener() {}
  send() {}
  close() {}
}

async function freshStore() {
  setActivePinia(createPinia())
  const { useAppStore } = await import('./app')
  return useAppStore()
}

beforeEach(() => {
  storage.clear()
  globalThis.WebSocket = FakeSocket
})

describe('tenant pinning vs the signed-in session', () => {
  test('a signed-in session keeps its own business, not the pinned one', async () => {
    storage.set('loop-auth', 'true')
    storage.set('loop-session-token', 'a-token')
    storage.set('loop-business-id', 'biz_signed_in')

    const store = await freshStore()

    expect(store.businessId).toBe('biz_signed_in')
    expect(localStorage.getItem('loop-business-id')).toBe('biz_signed_in')
  })

  test('a token without the auth flag is not treated as a session', async () => {
    storage.set('loop-session-token', 'a-token')
    storage.set('loop-business-id', 'biz_stale')

    const store = await freshStore()

    // Not authenticated, so the stored id carries no authority of its own.
    expect(store.authenticated).toBe(false)
  })

  test('a browser that has never signed in still gets a business id', async () => {
    const store = await freshStore()

    // Either the pin (when the build sets one) or empty — never a crash, and
    // never another tenant's id.
    expect(typeof store.businessId).toBe('string')
  })
})
