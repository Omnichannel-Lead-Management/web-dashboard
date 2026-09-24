import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { gatewayApi } from '../services/gatewayApi'
import { useAppStore } from './app'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
}

class FakeAgentSocket {
  static OPEN = 1
  constructor() {
    this.readyState = 0
  }
  addEventListener() {}
  send() {}
  close() {}
}

let store
let created
let signedIn

beforeEach(() => {
  storage.clear()
  globalThis.WebSocket = FakeAgentSocket
  setActivePinia(createPinia())
  store = useAppStore()
  created = []
  signedIn = []
  // Registration now exchanges the new credentials for a session token.
  gatewayApi.login = async (payload) => {
    signedIn.push(payload)
    return { token: 'test-token', business: { id: 'biz_new', name: 'stub' } }
  }
  gatewayApi.createBusiness = async (payload) => {
    created.push(payload)
    return {
      business: {
        id: 'biz_new',
        name: payload.name,
        sector: payload.sector,
        owner_email: payload.owner_email,
        owner_name: payload.owner_name || null,
      },
    }
  }
})

const registrationForm = (changes = {}) => ({
  business: "Chanul's Salon",
  sector: 'salon',
  owner: 'Chanul Pathirana',
  email: 'chanul@salon.lk',
  password: 'a-good-password',
  ...changes,
})

describe('signed-in identity', () => {
  test('registration stores the owner name on the business', async () => {
    await store.registerBusiness(registrationForm())
    expect(created[0]).toMatchObject({
      name: "Chanul's Salon",
      owner_email: 'chanul@salon.lk',
      owner_name: 'Chanul Pathirana',
    })
    expect(store.agentName).toBe('Chanul Pathirana')
  })

  test('registration signs the new owner in with the password it just set', async () => {
    await store.registerBusiness(registrationForm())
    expect(created[0]).toMatchObject({ password: 'a-good-password' })
    expect(signedIn[0]).toEqual({
      owner_email: 'chanul@salon.lk',
      password: 'a-good-password',
    })
  })

  test('two businesses registering never share one identity', async () => {
    await store.registerBusiness(registrationForm())
    const first = { name: store.agentName, id: store.agentId }

    storage.clear()
    setActivePinia(createPinia())
    store = useAppStore()
    await store.registerBusiness(
      registrationForm({ business: 'Nimali Spa', owner: 'Nimali Silva' }),
    )

    expect(store.agentName).toBe('Nimali Silva')
    expect(store.agentName).not.toBe(first.name)
    // A shared agent id would make the hub treat both tenants as one agent and
    // disconnect whichever signed in first.
    expect(store.agentId).not.toBe(first.id)
  })

  test('an account that stored no owner name falls back to its address', async () => {
    gatewayApi.createBusiness = async (payload) => ({
      // An account created before the gateway stored owner names.
      business: {
        id: 'biz_old',
        name: payload.name,
        owner_email: payload.owner_email,
      },
    })
    await store.registerBusiness(registrationForm({ owner: '' }))
    expect(store.agentName).toBe('Chanul')
  })
})
