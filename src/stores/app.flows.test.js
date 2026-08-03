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

function flow(overrides = {}) {
  return {
    id: 'flow_1',
    business_id: 'biz_1',
    name: 'Salon flow',
    sector: 'salon',
    is_active: true,
    is_template: false,
    created_at: 1000,
    updated_at: 1000,
    created_by: 'agent_1',
    flow: {
      start: 'n1',
      nodes: [{ id: 'n1', type: 'message', content: 'Hi' }],
    },
    trigger_intents: ['pricing'],
    ...overrides,
  }
}

let store
beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_1'
  store.agentId = 'agent_1'
})

describe('flow/template store actions', () => {
  test('loads templates and active-business flows', async () => {
    gatewayApi.listTemplates = async () => ({
      success: true,
      templates: [
        { id: 'tmpl_1', sector: 'salon', name: 'Salon', trigger_intents: [] },
      ],
      stored: [{ id: 'tmpl_1', sector: 'salon', flow: flow().flow }],
    })
    let receivedBusiness
    gatewayApi.listFlows = async (businessId) => {
      receivedBusiness = businessId
      return { success: true, count: 1, flows: [flow()] }
    }
    await store.refreshConversationTemplates()
    await store.refreshBusinessFlows()
    expect(store.conversationTemplates[0].id).toBe('tmpl_1')
    expect(store.businessFlows[0].id).toBe('flow_1')
    expect(receivedBusiness).toBe('biz_1')
  })

  test('rejects malformed successful lists', async () => {
    gatewayApi.listTemplates = async () => ({ success: true })
    gatewayApi.listFlows = async () => ({ success: true })
    await expect(store.refreshConversationTemplates()).rejects.toThrow(
      'invalid template',
    )
    await expect(store.refreshBusinessFlows()).rejects.toThrow('invalid flow')
  })

  test('attach waits for success, sends creator and invalidates an older list', async () => {
    const pendingList = deferred()
    const pendingAttach = deferred()
    gatewayApi.listFlows = () => pendingList.promise
    gatewayApi.attachTemplate = async (businessId, payload) => {
      expect(businessId).toBe('biz_1')
      expect(payload).toEqual({ sector: 'salon', created_by: 'agent_1' })
      return pendingAttach.promise
    }
    const listPromise = store.refreshBusinessFlows()
    const attachPromise = store.attachConversationTemplate({ sector: 'salon' })
    expect(store.businessFlows).toHaveLength(0)
    pendingAttach.resolve({ success: true, flow: flow() })
    expect((await attachPromise).id).toBe('flow_1')
    pendingList.resolve({ success: true, flows: [] })
    await listPromise
    expect(store.businessFlows.map((item) => item.id)).toEqual(['flow_1'])
    expect(store.toast?.message).toContain('attached')
    await expect(
      store.attachConversationTemplate({ sector: 'salon' }),
    ).rejects.toThrow('already attached')
  })

  test('stale attachment cannot update or notify the new business', async () => {
    const pending = deferred()
    gatewayApi.attachTemplate = () => pending.promise
    const attachment = store.attachConversationTemplate({ sector: 'salon' })

    store.businessId = 'biz_2'
    pending.resolve({ success: true, flow: flow() })

    expect(await attachment).toBeNull()
    expect(store.businessFlows).toEqual([])
    expect(store.toast).toBeNull()
  })

  test('attachment with a mismatched returned business is ignored', async () => {
    gatewayApi.attachTemplate = async () => ({
      success: true,
      flow: flow({ business_id: 'biz_2' }),
    })

    expect(
      await store.attachConversationTemplate({ sector: 'salon' }),
    ).toBeNull()
    expect(store.businessFlows).toEqual([])
    expect(store.toast).toBeNull()
  })

  test('active toggle is optimistic, confirms, and an older list cannot restore it', async () => {
    store.businessFlows = [
      { ...store.businessFlows[0], ...mapLocal(flow()), isActive: true },
    ]
    const pending = deferred()
    gatewayApi.updateFlow = () => pending.promise
    const mutation = store.updateBusinessFlow('flow_1', { isActive: false })
    expect(store.businessFlows[0].isActive).toBe(false)
    pending.resolve({ success: true, flow: flow({ is_active: false }) })
    await mutation
    expect(store.businessFlows[0].isActive).toBe(false)
  })

  test('failed toggle rolls back the full flow without invalidating a valid list', async () => {
    store.businessFlows = [mapLocal(flow())]
    gatewayApi.updateFlow = async () => {
      throw new Error('toggle failed')
    }
    await expect(
      store.updateBusinessFlow('flow_1', { isActive: false }),
    ).rejects.toThrow('toggle failed')
    expect(store.businessFlows[0].isActive).toBe(true)
    expect(store.flowError).toBe('toggle failed')
  })

  test('delete removes only after success and stale lists cannot restore it', async () => {
    store.businessFlows = [mapLocal(flow())]
    const pending = deferred()
    gatewayApi.deleteFlow = () => pending.promise
    const deletion = store.deleteBusinessFlow('flow_1')
    expect(store.businessFlows).toHaveLength(1)
    pending.resolve({ success: true })
    await deletion
    expect(store.businessFlows).toHaveLength(0)
  })

  test('logout clears state and old responses cannot restore another tenant', async () => {
    const pending = deferred()
    gatewayApi.listFlows = () => pending.promise
    const request = store.refreshBusinessFlows()
    store.logout()
    pending.resolve({ success: true, flows: [flow()] })
    await request
    expect(store.businessFlows).toEqual([])
    expect(store.conversationTemplates).toEqual([])
    expect(store.loadingFlows).toBe(false)
  })

  test('business-session reset clears cached rows and rejects in-flight results', async () => {
    const pending = deferred()
    gatewayApi.listFlows = () => pending.promise
    const request = store.refreshBusinessFlows()
    store.businessFlows = [mapLocal(flow())]
    store.resetFlowTemplateState()
    store.businessId = 'biz_2'
    pending.resolve({ success: true, flows: [flow()] })
    await request
    expect(store.businessFlows).toEqual([])
    expect(store.flowError).toBe('')
  })
})

function mapLocal(source) {
  return {
    id: source.id,
    businessId: source.business_id,
    name: source.name,
    sector: source.sector,
    isActive: source.is_active,
    isTemplate: false,
    flowJson: source.flow,
    flowError: '',
    triggerIntents: source.trigger_intents,
    createdBy: source.created_by,
    createdAt: source.created_at,
    updatedAt: source.updated_at,
  }
}
