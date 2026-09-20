import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { gatewayApi } from '../services/gatewayApi'
import { useAppStore } from './app'
const storage = new Map()
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
}
const row = (changes = {}) => ({
  messenger_id: 'm1',
  platform: 'web',
  business_id: 'biz_a',
  display_name: 'Ana',
  escalation_status: 'queued',
  escalation_requested_at: '2026-08-03T10:00:00Z',
  ...changes,
})
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
class FakeAgentSocket {
  static OPEN = 1
  static instances = []
  constructor() {
    this.readyState = 0
    this.listeners = {}
    this.sent = []
    FakeAgentSocket.instances.push(this)
  }
  addEventListener(type, fn) {
    ;(this.listeners[type] ??= []).push(fn)
  }
  emit(type, payload = {}) {
    for (const fn of this.listeners[type] || []) fn(payload)
  }
  open() {
    this.readyState = 1
    this.emit('open')
  }
  message(payload) {
    this.emit('message', { data: JSON.stringify(payload) })
  }
  send(payload) {
    this.sent.push(JSON.parse(payload))
  }
  close() {
    this.readyState = 3
    this.emit('close')
  }
}
let store
beforeEach(() => {
  storage.clear()
  FakeAgentSocket.instances = []
  globalThis.WebSocket = FakeAgentSocket
  setActivePinia(createPinia())
  store = useAppStore()
  store.authenticated = true
  store.businessId = 'biz_a'
  store.agentId = 'agent_a'
  store.escalationQueueAvailable = true
  gatewayApi.getAgentQueue = async () => ({ success: true, queue: [] })
})
const connectAgent = () => {
  store.connectAgentChannel()
  const socket = FakeAgentSocket.instances.at(-1)
  socket.open()
  socket.message({ type: 'connected' })
  socket.message({
    type: 'registered',
    agent_id: 'agent_a',
    business_id: 'biz_a',
  })
  return socket
}
describe('escalation store', () => {
  test('disabled mode makes no request', async () => {
    let calls = 0
    gatewayApi.getAgentQueue = async () => {
      calls++
      return { success: true, queue: [row()] }
    }
    store.escalationQueueAvailable = false
    expect(await store.refreshEscalations()).toBeNull()
    expect(calls).toBe(0)
    expect(store.escalations).toEqual([])
  })
  test('refresh normalizes, deduplicates and scopes queue', async () => {
    gatewayApi.getAgentQueue = async (id) => ({
      success: true,
      queue: [
        row({ business_id: id }),
        row({ business_id: id, escalation_summary: 'latest' }),
        row({ messenger_id: 'other', business_id: 'biz_b' }),
      ],
    })
    await store.refreshEscalations()
    expect(store.escalations).toHaveLength(1)
    expect(store.escalations[0]).toMatchObject({
      id: 'web:m1',
      businessId: 'biz_a',
      summary: 'latest',
    })
  })
  test('business switch clears queue and old snapshot is ignored', () => {
    store.applyEscalationSnapshot([row()], 'biz_a')
    expect(store.escalations).toHaveLength(1)
    store.businessId = 'biz_b'
    expect(store.escalations).toEqual([])
    expect(store.applyEscalationSnapshot([row()], 'biz_a')).toBe(false)
    expect(store.escalations).toEqual([])
  })
  test('logout clears queue and pending state', () => {
    store.applyEscalationSnapshot([row()], 'biz_a')
    store.logout()
    expect(store.escalations).toEqual([])
    expect(store.escalationClaimPendingIds).toEqual([])
    expect(store.escalationReleasePendingIds).toEqual([])
  })
  test('ownership guards reject another agent claim and release', async () => {
    store.connectionStatus = 'online'
    store.applyEscalationSnapshot(
      [row({ escalation_status: 'claimed', claimed_by_agent_id: 'agent_b' })],
      'biz_a',
    )
    expect(await store.claimEscalation('web:m1')).toBeNull()
    expect(await store.releaseEscalation('web:m1')).toBeNull()
  })
  test('a realtime queue update invalidates an older REST refresh', async () => {
    const pending = deferred()
    gatewayApi.getAgentQueue = () => pending.promise
    const refresh = store.refreshEscalations()
    store.applyEscalationSnapshot(
      [row({ escalation_status: 'claimed', claimed_by_agent_id: 'agent_a' })],
      'biz_a',
      { realtime: true },
    )
    pending.resolve({ success: true, queue: [row()] })
    expect(await refresh).toBeNull()
    expect(store.escalations[0]).toMatchObject({
      status: 'claimed',
      claimedByAgentId: 'agent_a',
    })
    expect(store.escalationsLoading).toBe(false)
  })
  test('a REST refresh started after realtime state may apply normally', async () => {
    store.applyEscalationSnapshot(
      [row({ escalation_status: 'claimed', claimed_by_agent_id: 'agent_a' })],
      'biz_a',
      { realtime: true },
    )
    gatewayApi.getAgentQueue = async () => ({
      success: true,
      queue: [row({ messenger_id: 'm2' })],
    })
    await store.refreshEscalations()
    expect(store.escalations.map((item) => item.id)).toEqual(['web:m2'])
  })
  test('an exact duplicate realtime snapshot is idempotent', async () => {
    const queued = [row()]
    store.applyEscalationSnapshot(queued, 'biz_a', { realtime: true })
    const pending = deferred()
    gatewayApi.getAgentQueue = () => pending.promise
    const refresh = store.refreshEscalations()
    expect(
      store.applyEscalationSnapshot(queued, 'biz_a', { realtime: true }),
    ).toBe(false)
    pending.resolve({
      success: true,
      queue: [row({ escalation_summary: 'refreshed' })],
    })
    await refresh
    expect(store.escalations[0].summary).toBe('refreshed')
  })
  test('business-mismatched realtime events mutate neither queue nor Inbox conversations', () => {
    store.applyEscalationSnapshot([row()], 'biz_a')
    const beforeQueue = JSON.stringify(store.escalations)
    const beforeConversations = JSON.stringify(store.conversations)
    store.applyEscalationEvent({
      type: 'chat_queued',
      chat: row({ business_id: 'biz_b', messenger_id: 'foreign' }),
    })
    store.applyEscalationEvent({
      type: 'chat_claimed',
      business_id: 'biz_b',
      platform: 'web',
      messenger_id: 'm1',
      claimed_by_agent_id: 'agent_b',
    })
    store.applyEscalationEvent({
      type: 'chat_released',
      business_id: 'biz_b',
      platform: 'web',
      messenger_id: 'm1',
      released_by_agent_id: 'agent_b',
    })
    expect(JSON.stringify(store.escalations)).toBe(beforeQueue)
    expect(JSON.stringify(store.conversations)).toBe(beforeConversations)
  })
  test('mixed-business snapshots retain only active-business rows', () => {
    store.applyEscalationEvent({
      type: 'queue_snapshot',
      chats: [row(), row({ business_id: 'biz_b', messenger_id: 'foreign' })],
    })
    expect(store.escalations.map((item) => item.id)).toEqual(['web:m1'])
    expect(store.conversations.some((item) => item.id === 'web:foreign')).toBe(
      false,
    )
  })
  test('matching chat_claimed settles a pending claim and late failure is harmless', async () => {
    const socket = connectAgent()
    store.applyEscalationSnapshot([row()], 'biz_a')
    const claim = store.claimEscalation('web:m1')
    expect(store.escalationClaimPendingIds).toEqual(['web:m1'])
    socket.message({
      type: 'chat_claimed',
      business_id: 'biz_a',
      platform: 'web',
      messenger_id: 'm1',
      claimed_by_agent_id: 'agent_a',
    })
    expect(await claim).toMatchObject({
      status: 'claimed',
      claimedByAgentId: 'agent_a',
    })
    expect(store.escalationClaimPendingIds).toEqual([])
    socket.message({
      type: 'claim_result',
      success: false,
      platform: 'web',
      messenger_id: 'm1',
      error: 'late failure',
    })
    expect(store.escalations[0].status).toBe('claimed')
    expect(store.escalationsError).toBe('')
  })
  test('matching chat_released queues the chat, clears ownership, and settles pending release', async () => {
    const socket = connectAgent()
    socket.message({
      type: 'queue_snapshot',
      chats: [
        row({
          escalation_status: 'claimed',
          claimed_by_agent_id: 'agent_a',
          claimed_at: '2026-08-03T10:05:00Z',
          escalation_tag: 'billing',
          escalation_summary: 'Needs help',
        }),
      ],
    })
    const release = store.releaseEscalation('web:m1')
    expect(store.escalationReleasePendingIds).toEqual(['web:m1'])
    socket.message({
      type: 'chat_released',
      business_id: 'biz_a',
      platform: 'web',
      messenger_id: 'm1',
      released_by_agent_id: 'agent_a',
    })
    expect(await release).toBe(true)
    expect(store.escalationReleasePendingIds).toEqual([])
    expect(store.escalations).toHaveLength(1)
    expect(store.escalations[0]).toMatchObject({
      status: 'queued',
      claimedByAgentId: '',
      claimedAt: null,
      tag: 'billing',
      summary: 'Needs help',
    })
    const conversation = store.conversations.find(
      (item) => item.id === 'web:m1',
    )
    expect(conversation).toMatchObject({
      claimed: false,
      claimedByAgentId: '',
      escalated: true,
    })
    socket.message({
      type: 'release_result',
      success: false,
      platform: 'web',
      messenger_id: 'm1',
      error: 'late failure',
    })
    expect(store.escalations[0].status).toBe('queued')
    expect(store.escalationsError).toBe('')
  })
  test('release_result uses the same idempotent queued transition', async () => {
    const socket = connectAgent()
    socket.message({
      type: 'queue_snapshot',
      chats: [
        row({
          escalation_status: 'claimed',
          claimed_by_agent_id: 'agent_a',
          claimed_at: '2026-08-03T10:05:00Z',
        }),
      ],
    })
    const release = store.releaseEscalation('web:m1')
    socket.message({
      type: 'release_result',
      success: true,
      platform: 'web',
      messenger_id: 'm1',
    })
    expect(await release).toBe(true)
    expect(store.escalations).toHaveLength(1)
    expect(store.escalations[0]).toMatchObject({
      status: 'queued',
      claimedByAgentId: '',
      claimedAt: null,
    })
    socket.message({
      type: 'chat_released',
      business_id: 'biz_a',
      platform: 'web',
      messenger_id: 'm1',
      released_by_agent_id: 'agent_a',
    })
    expect(store.escalations).toHaveLength(1)
    expect(store.escalations[0].status).toBe('queued')
  })
  test('only de_escalated removes a released queued item', () => {
    connectAgent()
    store.applyEscalationSnapshot([row()], 'biz_a')
    store.applyEscalationEvent({
      type: 'de_escalated',
      business_id: 'biz_a',
      platform: 'web',
      messenger_id: 'm1',
    })
    expect(store.escalations).toEqual([])
  })
  test('logout settles a pending claim with cancellation', async () => {
    const socket = connectAgent()
    store.applyEscalationSnapshot([row()], 'biz_a')
    const claim = store.claimEscalation('web:m1')
    store.logout()
    expect(await claim).toEqual({
      success: false,
      cancelled: true,
      reason: 'logout',
    })
    expect(store.escalationClaimPendingIds).toEqual([])
    socket.message({
      type: 'claim_result',
      success: true,
      platform: 'web',
      messenger_id: 'm1',
    })
    expect(store.escalations).toEqual([])
  })
  test('a live message keeps the triage metadata the snapshot established', () => {
    const socket = connectAgent()
    socket.message({
      type: 'queue_snapshot',
      chats: [
        row({
          escalation_tag: 'billing',
          escalation_summary: 'Charged twice for one booking.',
        }),
      ],
    })
    const before = store.conversations.find((item) => item.id === 'web:m1')
    expect(before).toMatchObject({
      escalationTag: 'billing',
      escalationSummary: 'Charged twice for one booking.',
      escalationRequestedAt: '2026-08-03T10:00:00Z',
    })

    // chat_message events carry no triage fields; merging one must not blank
    // out the queue card.
    socket.message({
      type: 'chat_message',
      platform: 'web',
      messenger_id: 'm1',
      business_id: 'biz_a',
      from: 'user',
      text: 'still waiting',
      escalation_status: 'queued',
      timestamp: '2026-08-03T10:05:00Z',
    })
    expect(
      store.conversations.find((item) => item.id === 'web:m1'),
    ).toMatchObject({
      escalationTag: 'billing',
      escalationSummary: 'Charged twice for one booking.',
      escalationRequestedAt: '2026-08-03T10:00:00Z',
      preview: 'still waiting',
    })
  })
  test("an agent's own reply survives the gateway echo as one bubble", () => {
    const socket = connectAgent()
    store.sendMessage('web:m1', 'hi how can help you')
    expect(store.messages['web:m1']).toHaveLength(1)

    // The hub broadcasts a claimed chat's agent reply to every dashboard on
    // the business, the sender included, under its own server-side id.
    socket.message({
      type: 'chat_message',
      platform: 'web',
      messenger_id: 'm1',
      business_id: 'biz_a',
      from: 'agent',
      agent_id: 'agent_a',
      text: 'hi how can help you',
      escalation_status: 'claimed',
      timestamp: '2026-08-03T10:06:00Z',
    })
    expect(store.messages['web:m1']).toHaveLength(1)
    expect(store.messages['web:m1'][0]).toMatchObject({
      sender: 'agent',
      text: 'hi how can help you',
    })
    expect(store.messages['web:m1'][0].pending).toBeUndefined()
  })
  test("a teammate's identical reply still shows as its own message", () => {
    const socket = connectAgent()
    store.sendMessage('web:m1', 'on my way')
    socket.message({
      type: 'chat_message',
      platform: 'web',
      messenger_id: 'm1',
      business_id: 'biz_a',
      from: 'agent',
      agent_id: 'agent_b',
      text: 'on my way',
      escalation_status: 'claimed',
      timestamp: '2026-08-03T10:07:00Z',
    })
    expect(store.messages['web:m1']).toHaveLength(2)
  })
  test("another business's message never reaches this inbox", () => {
    const socket = connectAgent()
    socket.message({
      type: 'chat_message',
      platform: 'web',
      messenger_id: 'foreign',
      business_id: 'biz_b',
      from: 'user',
      text: 'wrong tenant',
      timestamp: '2026-08-03T10:05:00Z',
    })
    expect(store.conversations.some((item) => item.id === 'web:foreign')).toBe(
      false,
    )
  })
  test('a refused claim explains itself instead of doing nothing', async () => {
    gatewayApi.listConversations = async () => ({ conversations: [] })
    connectAgent()
    // Escalated in the inbox but absent from the queue: the old code resolved
    // null and the button looked broken.
    expect(await store.claimEscalation('web:missing')).toBeNull()
    expect(store.toast).toMatchObject({ type: 'error' })
    expect(store.toast.message).toContain('not waiting in the queue')
  })
  test('a snapshot without the chat clears its escalated tag in the inbox', () => {
    const socket = connectAgent()
    socket.message({ type: 'queue_snapshot', chats: [row()] })
    expect(
      store.conversations.find((item) => item.id === 'web:m1'),
    ).toMatchObject({ escalated: true })

    // Releasing de-escalates server-side, so the next snapshot omits the chat.
    socket.message({ type: 'queue_snapshot', chats: [] })
    expect(
      store.conversations.find((item) => item.id === 'web:m1'),
    ).toMatchObject({ escalated: false, claimed: false, claimedByAgentId: '' })
  })
  test('a snapshot never replaces a real preview with the empty placeholder', () => {
    const socket = connectAgent()
    socket.message({
      type: 'chat_message',
      platform: 'web',
      messenger_id: 'm1',
      business_id: 'biz_a',
      from: 'user',
      text: 'are you open today?',
      escalation_status: 'queued',
      timestamp: '2026-08-03T10:05:00Z',
    })
    socket.message({ type: 'queue_snapshot', chats: [row()] })
    expect(store.conversations.find((item) => item.id === 'web:m1').preview).toBe(
      'are you open today?',
    )
  })
  test('business switch settles a pending release with cancellation', async () => {
    connectAgent()
    store.applyEscalationSnapshot(
      [row({ escalation_status: 'claimed', claimed_by_agent_id: 'agent_a' })],
      'biz_a',
    )
    const release = store.releaseEscalation('web:m1')
    store.businessId = 'biz_b'
    expect(await release).toEqual({
      success: false,
      cancelled: true,
      reason: 'business_changed',
    })
    expect(store.escalationReleasePendingIds).toEqual([])
    expect(store.escalations).toEqual([])
  })
})
