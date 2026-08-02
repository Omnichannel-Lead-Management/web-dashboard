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

const config = (overrides = {}) => ({
  business_id: 'biz_1',
  chatbot_enabled: true,
  welcome_message: '',
  escalation_message: '',
  updated_at: 0,
  ...overrides,
})

let store

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_1'
})

describe('chatbot config store', () => {
  test('loads and maps the active business config without success toast', async () => {
    let businessId
    gatewayApi.getChatbotConfig = async (receivedId) => {
      businessId = receivedId
      return {
        config: config({
          welcome_message: 'Hello',
          escalation_message: null,
        }),
      }
    }

    await store.refreshChatbotConfig()

    expect(businessId).toBe('biz_1')
    expect(store.chatbotConfig).toMatchObject({
      businessId: 'biz_1',
      chatbotEnabled: true,
      welcomeMessage: 'Hello',
      escalationMessage: '',
      updatedAt: 0,
    })
    expect(store.toast).toBeNull()
    expect(localStorage.getItem('loop-chatbot')).toBe('true')
  })

  test('rejects malformed successful config responses', async () => {
    gatewayApi.getChatbotConfig = async () => ({ success: true })

    await expect(store.refreshChatbotConfig()).rejects.toThrow(
      'invalid chatbot config response',
    )
    expect(store.chatbotConfigError).toContain('invalid chatbot config response')
    expect(store.toast.type).toBe('error')
  })

  test('toggle is optimistic, sends only false, then confirms after success', async () => {
    store.chatbotConfig = {
      businessId: 'biz_1',
      chatbotEnabled: true,
      welcomeMessage: 'Hello',
      escalationMessage: 'Wait',
      updatedAt: 0,
    }
    localStorage.setItem('loop-chatbot', 'true')
    const pending = deferred()
    let payload
    gatewayApi.updateChatbotConfig = (_businessId, changes) => {
      payload = changes
      return pending.promise
    }

    const request = store.updateChatbotEnabled(false)
    expect(store.chatbotConfig.chatbotEnabled).toBe(false)
    expect(localStorage.getItem('loop-chatbot')).toBe('false')
    expect(payload).toEqual({ chatbot_enabled: false })
    expect(store.toast).toBeNull()
    pending.resolve({ config: config({ chatbot_enabled: false }) })
    await request

    expect(store.chatbotConfig.chatbotEnabled).toBe(false)
    expect(store.toast).toEqual({ message: 'Chatbot disabled', type: 'success' })
  })

  test('toggle failure rolls back UI and localStorage cache', async () => {
    store.chatbotConfig = {
      businessId: 'biz_1',
      chatbotEnabled: true,
      welcomeMessage: '',
      escalationMessage: '',
      updatedAt: 0,
    }
    localStorage.setItem('loop-chatbot', 'true')
    gatewayApi.updateChatbotConfig = async () => {
      throw new Error('Toggle rejected')
    }

    await expect(store.updateChatbotEnabled(false)).rejects.toThrow(
      'Toggle rejected',
    )
    expect(store.chatbotConfig.chatbotEnabled).toBe(true)
    expect(localStorage.getItem('loop-chatbot')).toBe('true')
    expect(store.toast).toEqual({ message: 'Toggle rejected', type: 'error' })
  })

  test('message save keeps confirmed state until the PATCH succeeds', async () => {
    store.chatbotConfig = {
      businessId: 'biz_1',
      chatbotEnabled: true,
      welcomeMessage: 'Old hello',
      escalationMessage: 'Old wait',
      updatedAt: 0,
    }
    const pending = deferred()
    let payload
    gatewayApi.updateChatbotConfig = (_businessId, changes) => {
      payload = changes
      return pending.promise
    }

    const request = store.saveChatbotMessages({
      welcomeMessage: '  New hello  ',
      escalationMessage: ' New wait ',
    })
    expect(payload).toEqual({
      welcome_message: 'New hello',
      escalation_message: 'New wait',
    })
    expect(store.chatbotConfig.welcomeMessage).toBe('Old hello')
    expect(store.toast).toBeNull()
    pending.resolve({
      config: config({
        welcome_message: 'New hello',
        escalation_message: 'New wait',
      }),
    })
    await request

    expect(store.chatbotConfig.welcomeMessage).toBe('New hello')
    expect(store.toast.message).toBe('Chatbot messages saved')
  })

  test('failed message save leaves confirmed state and never reports success', async () => {
    store.chatbotConfig = {
      businessId: 'biz_1',
      chatbotEnabled: true,
      welcomeMessage: 'Confirmed',
      escalationMessage: '',
      updatedAt: 0,
    }
    gatewayApi.updateChatbotConfig = async () => {
      throw new Error('Save rejected')
    }

    await expect(
      store.saveChatbotMessages({
        welcomeMessage: 'Draft',
        escalationMessage: '',
      }),
    ).rejects.toThrow('Save rejected')
    expect(store.chatbotConfig.welcomeMessage).toBe('Confirmed')
    expect(store.toast).toEqual({ message: 'Save rejected', type: 'error' })
  })

  test('successful PATCH invalidates an older GET response', async () => {
    const oldGet = deferred()
    gatewayApi.getChatbotConfig = () => oldGet.promise
    gatewayApi.updateChatbotConfig = async () => ({
      config: config({ chatbot_enabled: false }),
    })

    const getRequest = store.refreshChatbotConfig()
    await store.updateChatbotEnabled(false)
    oldGet.resolve({ config: config({ chatbot_enabled: true }) })
    await getRequest

    expect(store.chatbotConfig.chatbotEnabled).toBe(false)
    expect(store.loadingChatbotConfig).toBe(false)
  })

  test('logout invalidates old GET data and clears config state', async () => {
    const oldGet = deferred()
    gatewayApi.getChatbotConfig = () => oldGet.promise

    const request = store.refreshChatbotConfig()
    store.logout()
    oldGet.resolve({ config: config({ welcome_message: 'Old tenant' }) })
    await request

    expect(store.chatbotConfig).toEqual({
      businessId: '',
      chatbotEnabled: true,
      welcomeMessage: '',
      escalationMessage: '',
      updatedAt: null,
    })
    expect(store.chatbotConfigError).toBe('')
    expect(store.loadingChatbotConfig).toBe(false)
    expect(localStorage.getItem('loop-chatbot')).toBeNull()
  })

  test('old business response cannot overwrite newer business config', async () => {
    const oldGet = deferred()
    const newGet = deferred()
    gatewayApi.getChatbotConfig = (businessId) =>
      businessId === 'biz_1' ? oldGet.promise : newGet.promise

    const requestA = store.refreshChatbotConfig()
    store.businessId = 'biz_2'
    const requestB = store.refreshChatbotConfig()
    newGet.resolve({ config: config({ business_id: 'biz_2', welcome_message: 'B' }) })
    await requestB
    oldGet.resolve({ config: config({ welcome_message: 'A' }) })
    await requestA

    expect(store.chatbotConfig.businessId).toBe('biz_2')
    expect(store.chatbotConfig.welcomeMessage).toBe('B')
  })

  test('stale mutation after logout cannot notify or alter new-session state', async () => {
    const oldPatch = deferred()
    gatewayApi.updateChatbotConfig = () => oldPatch.promise

    const request = store.updateChatbotEnabled(false)
    store.logout()
    store.businessId = 'biz_2'
    store.authenticated = true
    store.chatbotConfig = {
      businessId: 'biz_2',
      chatbotEnabled: true,
      welcomeMessage: 'Business B',
      escalationMessage: '',
      updatedAt: 0,
    }
    oldPatch.resolve({ config: config({ chatbot_enabled: false }) })
    await request

    expect(store.chatbotConfig.businessId).toBe('biz_2')
    expect(store.chatbotConfig.chatbotEnabled).toBe(true)
    expect(store.toast).toBeNull()
    expect(store.savingChatbotConfig).toBe(false)
  })
})
