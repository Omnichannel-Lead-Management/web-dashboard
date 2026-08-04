import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { leadService } from '../services/leadService.js'
import { useAppStore } from './app.js'

const storage = new Map()
globalThis.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
  removeItem(key) {
    storage.delete(key)
  },
  clear() {
    storage.clear()
  },
}

let store

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_1'
  store.agentId = 'agent_current'
  store.agentName = 'Current Agent'
  store.leads = [{ id: 'lead_1', status: 'new', notes: '', tags: [] }]
  leadService.get = async () => ({
    lead: {
      id: 'lead_1',
      status: 'contacted',
      notes: 'Call tomorrow',
      tags: [],
    },
    activities: [{ id: 'activity_1', type: 'notes_updated' }],
  })
})

describe('lead store mutations', () => {
  test('audited update waits, merges, refreshes detail/activity, then succeeds', async () => {
    let resolveUpdate
    let received
    leadService.update = (id, businessId, payload) => {
      received = { id, businessId, payload }
      return new Promise((resolve) => {
        resolveUpdate = resolve
      })
    }

    const request = store.updateLead('lead_1', { notes: 'Call tomorrow' })
    expect(received.payload.performed_by).toBe('agent_current')
    expect(store.toast).toBeNull()

    resolveUpdate({
      id: 'lead_1',
      status: 'new',
      notes: 'Call tomorrow',
      tags: [],
    })
    await request

    expect(store.leads[0].notes).toBe('Call tomorrow')
    expect(store.leadDetail.status).toBe('contacted')
    expect(store.leadActivities).toEqual([
      { id: 'activity_1', type: 'notes_updated' },
    ])
    expect(store.toast).toEqual({
      message: 'Lead notes updated',
      type: 'success',
    })
  })

  test('failed update reports the API error and never shows success', async () => {
    leadService.update = async () => {
      throw new Error('Lead update rejected')
    }

    await expect(store.updateLead('lead_1', { tags: ['vip'] })).rejects.toThrow(
      'Lead update rejected',
    )
    expect(store.toast).toEqual({
      message: 'Lead update rejected',
      type: 'error',
    })
  })

  test('successful update stays fulfilled and merged when detail refresh fails', async () => {
    leadService.update = async () => ({
      id: 'lead_1',
      status: 'new',
      notes: 'Persisted note',
      tags: [],
    })
    leadService.get = async () => {
      throw new Error('Timeline unavailable')
    }

    const result = await store.updateLead('lead_1', { notes: 'Persisted note' })

    expect(result.notes).toBe('Persisted note')
    expect(store.leads[0].notes).toBe('Persisted note')
    expect(store.toast).toEqual({
      message: 'Lead updated, but the latest activity could not be loaded.',
      type: 'error',
    })
    const settled = await Promise.allSettled([
      store.updateLead(
        'lead_1',
        { notes: 'Persisted again' },
        { silent: true },
      ),
    ])
    expect(settled[0].status).toBe('fulfilled')
  })

  test('explicit assignment includes agent_id and performed_by', async () => {
    let payload
    leadService.assign = async (_id, _businessId, incoming) => {
      payload = incoming
      return { id: 'lead_1', assignedAgentId: 'agent_target' }
    }

    await store.assignLead('lead_1', 'agent_target')
    expect(payload).toEqual({
      agent_id: 'agent_target',
      performed_by: 'agent_current',
    })
    expect(store.leadActivities).toHaveLength(1)
  })

  test('auto-assignment omits agent_id but includes performed_by', async () => {
    let payload
    leadService.assign = async (_id, _businessId, incoming) => {
      payload = incoming
      return { id: 'lead_1', assignedAgentId: 'agent_round_robin' }
    }

    await store.autoAssignLead('lead_1')
    expect(payload).toEqual({ performed_by: 'agent_current' })
  })

  test('successful assignment stays fulfilled and merged when detail refresh fails', async () => {
    leadService.assign = async () => ({
      id: 'lead_1',
      assignedAgentId: 'agent_target',
    })
    leadService.get = async () => {
      throw new Error('Timeline unavailable')
    }

    const result = await store.assignLead('lead_1', 'agent_target')

    expect(result.assignedAgentId).toBe('agent_target')
    expect(store.leads[0].assignedAgentId).toBe('agent_target')
    expect(store.toast).toEqual({
      message: 'Lead assigned, but the latest activity could not be loaded.',
      type: 'error',
    })
  })
})

describe('lead detail request sequencing', () => {
  test('stale success cannot replace the newest lead or activities', async () => {
    const a = deferred()
    const b = deferred()
    leadService.get = (id) => (id === 'lead_a' ? a.promise : b.promise)

    const requestA = store.refreshLeadDetail('lead_a')
    const requestB = store.refreshLeadDetail('lead_b')
    b.resolve({ lead: { id: 'lead_b' }, activities: [{ id: 'b_activity' }] })
    await requestB
    a.resolve({ lead: { id: 'lead_a' }, activities: [{ id: 'a_activity' }] })
    await requestA

    expect(store.leadDetail.id).toBe('lead_b')
    expect(store.leadActivities).toEqual([{ id: 'b_activity' }])
  })

  test('stale failure does not replace the latest success with an error', async () => {
    const a = deferred()
    const b = deferred()
    leadService.get = (id) => (id === 'lead_a' ? a.promise : b.promise)

    const requestA = store.refreshLeadDetail('lead_a')
    const requestB = store.refreshLeadDetail('lead_b')
    b.resolve({ lead: { id: 'lead_b' }, activities: [] })
    await requestB
    a.reject(new Error('Old lead failed'))
    await requestA

    expect(store.leadDetail.id).toBe('lead_b')
    expect(store.leadDetailError).toBe('')
  })

  test('stale completion cannot clear loading for the current request', async () => {
    const a = deferred()
    const b = deferred()
    leadService.get = (id) => (id === 'lead_a' ? a.promise : b.promise)

    const requestA = store.refreshLeadDetail('lead_a')
    const requestB = store.refreshLeadDetail('lead_b')
    a.resolve({ lead: { id: 'lead_a' }, activities: [] })
    await requestA
    expect(store.loadingLeadDetail).toBe(true)
    b.resolve({ lead: { id: 'lead_b' }, activities: [] })
    await requestB
    expect(store.loadingLeadDetail).toBe(false)
  })

  test('logout clears all cached lead-detail session state', () => {
    store.leadDetail = { id: 'old_lead', notes: 'Previous tenant data' }
    store.leadActivities = [{ id: 'old_activity' }]
    store.leadDetailError = 'Old error'
    store.loadingLeadDetail = true

    store.logout()

    expect(store.leadDetail).toBeNull()
    expect(store.leadActivities).toEqual([])
    expect(store.leadDetailError).toBe('')
    expect(store.loadingLeadDetail).toBe(false)
  })

  test('a request started before logout cannot restore old lead data', async () => {
    const oldRequest = deferred()
    leadService.get = () => oldRequest.promise

    const request = store.refreshLeadDetail('old_lead')
    store.logout()
    oldRequest.resolve({
      lead: { id: 'old_lead', notes: 'Previous tenant data' },
      activities: [{ id: 'old_activity' }],
    })
    await request

    expect(store.leadDetail).toBeNull()
    expect(store.leadActivities).toEqual([])
    expect(store.leadDetailError).toBe('')
    expect(store.loadingLeadDetail).toBe(false)
  })

  test('a new-session failure cannot expose previous-session lead data', async () => {
    store.leadDetail = { id: 'shared_lead_id', notes: 'Previous tenant data' }
    store.leadActivities = [{ id: 'old_activity' }]
    store.logout()
    store.businessId = 'biz_2'
    store.authenticated = true
    leadService.get = async () => {
      throw new Error('Lead not found')
    }

    await expect(store.refreshLeadDetail('shared_lead_id')).rejects.toThrow(
      'Lead not found',
    )

    expect(store.leadDetail).toBeNull()
    expect(store.leadActivities).toEqual([])
    expect(store.leadDetailError).toBe('Lead not found')
  })
})

describe('lead session isolation', () => {
  test('pending list success after logout cannot restore data or loading', async () => {
    const oldList = deferred()
    leadService.list = () => oldList.promise

    const request = store.refreshLeads()
    expect(store.loadingLeads).toBe(true)
    store.logout()
    oldList.resolve([{ id: 'old_lead', businessId: 'biz_1' }])
    await request

    expect(store.leads).toEqual([])
    expect(store.leadListError).toBe('')
    expect(store.loadingLeads).toBe(false)
  })

  test('pending list failure after logout cannot write an error', async () => {
    const oldList = deferred()
    leadService.list = () => oldList.promise

    const request = store.refreshLeads()
    store.logout()
    oldList.reject(new Error('Old tenant list failed'))
    await request

    expect(store.leads).toEqual([])
    expect(store.leadListError).toBe('')
    expect(store.loadingLeads).toBe(false)
    expect(store.toast).toBeNull()
  })

  test('old list response cannot replace a newer business result', async () => {
    const oldList = deferred()
    const newList = deferred()
    leadService.list = (businessId) =>
      businessId === 'biz_1' ? oldList.promise : newList.promise

    const requestA = store.refreshLeads()
    store.logout()
    store.businessId = 'biz_2'
    store.authenticated = true
    const requestB = store.refreshLeads()
    newList.resolve([{ id: 'new_lead', businessId: 'biz_2' }])
    await requestB
    oldList.resolve([{ id: 'old_lead', businessId: 'biz_1' }])
    await requestA

    expect(store.leads).toEqual([{ id: 'new_lead', businessId: 'biz_2' }])
    expect(store.loadingLeads).toBe(false)
  })

  test('update success after logout has no local or notification effects', async () => {
    const oldUpdate = deferred()
    let detailCalls = 0
    leadService.update = () => oldUpdate.promise
    leadService.get = async () => {
      detailCalls += 1
      return { lead: { id: 'lead_1' }, activities: [] }
    }

    const request = store.updateLead('lead_1', { notes: 'Old tenant note' })
    store.logout()
    oldUpdate.resolve({ id: 'lead_1', notes: 'Old tenant note' })
    const result = await request

    expect(result.notes).toBe('Old tenant note')
    expect(store.leads).toEqual([])
    expect(store.leadDetail).toBeNull()
    expect(detailCalls).toBe(0)
    expect(store.toast).toBeNull()
  })

  test('update failure after logout rejects without writing an old error toast', async () => {
    const oldUpdate = deferred()
    leadService.update = () => oldUpdate.promise

    const request = store.updateLead('lead_1', { notes: 'Old tenant note' })
    store.logout()
    oldUpdate.reject(new Error('Old mutation failed'))

    await expect(request).rejects.toThrow('Old mutation failed')
    expect(store.leads).toEqual([])
    expect(store.leadDetailError).toBe('')
    expect(store.toast).toBeNull()
  })

  test('assignment success after session change is ignored locally', async () => {
    const oldAssignment = deferred()
    let detailCalls = 0
    leadService.assign = () => oldAssignment.promise
    leadService.get = async () => {
      detailCalls += 1
      return { lead: { id: 'lead_1' }, activities: [] }
    }

    const request = store.assignLead('lead_1', 'agent_old')
    store.logout()
    store.businessId = 'biz_2'
    store.authenticated = true
    oldAssignment.resolve({ id: 'lead_1', assignedAgentId: 'agent_old' })
    await request

    expect(store.leads).toEqual([])
    expect(store.leadDetail).toBeNull()
    expect(detailCalls).toBe(0)
    expect(store.toast).toBeNull()
  })

  test('old mutation completion cannot interfere with the new session lock', async () => {
    const oldUpdate = deferred()
    const newUpdate = deferred()
    let call = 0
    leadService.update = () => {
      call += 1
      return call === 1 ? oldUpdate.promise : newUpdate.promise
    }
    leadService.get = async (id) => ({ lead: { id }, activities: [] })

    const requestA = store.updateLead('lead_1', { notes: 'Old' })
    store.logout()
    store.businessId = 'biz_2'
    store.authenticated = true
    store.leads = [{ id: 'lead_1', notes: '' }]
    const requestB = store.updateLead('lead_1', { notes: 'New' })
    oldUpdate.resolve({ id: 'lead_1', notes: 'Old' })
    await requestA
    newUpdate.resolve({ id: 'lead_1', notes: 'New' })
    await requestB

    expect(call).toBe(2)
    expect(store.businessId).toBe('biz_2')
    expect(store.leads[0].id).toBe('lead_1')
  })
})
