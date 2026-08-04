import { beforeEach, describe, expect, test } from 'bun:test'
import { createAgentSocket } from './agentSocket'
class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.listeners = {}
    this.sent = []
    FakeSocket.instances.push(this)
  }
  addEventListener(t, f) {
    ;(this.listeners[t] ??= []).push(f)
  }
  emit(t, p = {}) {
    for (const f of this.listeners[t] || []) f(p)
  }
  open() {
    this.readyState = 1
    this.emit('open')
  }
  send(v) {
    this.sent.push(v)
  }
  close() {
    this.readyState = 3
    this.emit('close')
  }
}
class FakeNetwork {
  constructor() {
    this.listeners = { online: new Set(), offline: new Set() }
  }
  addEventListener(t, f) {
    this.listeners[t].add(f)
  }
  removeEventListener(t, f) {
    this.listeners[t].delete(f)
  }
  emit(t) {
    for (const f of this.listeners[t]) f()
  }
}
beforeEach(() => {
  FakeSocket.instances = []
})
describe('agent socket', () => {
  test('uses one socket, parses verified events and ignores malformed frames', () => {
    const events = []
    const socket = createAgentSocket({
      WebSocketImpl: FakeSocket,
      onEvent: (e) => events.push(e),
    })
    expect(socket.reconnect()).toBe(false)
    const ws = FakeSocket.instances[0]
    ws.open()
    ws.emit('message', { data: 'bad' })
    ws.emit('message', {
      data: JSON.stringify({ type: 'queue_snapshot', chats: [] }),
    })
    expect(events).toEqual([{ type: 'queue_snapshot', chats: [] }])
    socket.close()
  })
  test('sends exact registration and generic claim/release payloads', () => {
    const socket = createAgentSocket({ WebSocketImpl: FakeSocket })
    const ws = FakeSocket.instances[0]
    ws.open()
    expect(
      socket.send({
        type: 'register',
        agent_id: 'a1',
        agent_name: 'Ana',
        business_id: 'b1',
      }),
    ).toBe(true)
    expect(
      socket.send({
        type: 'claim_chat',
        platform: 'web',
        messenger_id: 'm1',
        business_id: 'b1',
      }),
    ).toBe(true)
    expect(
      socket.send({
        type: 'release_chat',
        platform: 'web',
        messenger_id: 'm1',
        business_id: 'b1',
      }),
    ).toBe(true)
    expect(ws.sent.map(JSON.parse)).toEqual([
      {
        type: 'register',
        agent_id: 'a1',
        agent_name: 'Ana',
        business_id: 'b1',
      },
      {
        type: 'claim_chat',
        platform: 'web',
        messenger_id: 'm1',
        business_id: 'b1',
      },
      {
        type: 'release_chat',
        platform: 'web',
        messenger_id: 'm1',
        business_id: 'b1',
      },
    ])
    socket.close()
  })
  test('explicit close prevents reconnect and stale socket events are ignored', () => {
    const timers = []
    const events = []
    const socket = createAgentSocket({
      WebSocketImpl: FakeSocket,
      onEvent: (e) => events.push(e),
      setTimer: (f) => (timers.push(f), timers.length),
      clearTimer: () => {},
    })
    const old = FakeSocket.instances[0]
    old.open()
    socket.close()
    old.emit('message', { data: JSON.stringify({ type: 'queue_snapshot' }) })
    expect(events).toEqual([])
    expect(timers).toHaveLength(0)
  })
  test('bounds reconnect attempts', () => {
    const timers = []
    createAgentSocket({
      WebSocketImpl: FakeSocket,
      maxReconnectAttempts: 2,
      setTimer: (f) => (timers.push(f), timers.length),
      clearTimer: () => {},
    })
    FakeSocket.instances[0].close()
    timers.shift()()
    FakeSocket.instances[1].close()
    timers.shift()()
    FakeSocket.instances[2].close()
    expect(timers).toHaveLength(0)
  })
  test('offline pauses reconnect and online resumes without consuming the budget', () => {
    const timers = []
    const network = new FakeNetwork()
    let online = true
    createAgentSocket({
      WebSocketImpl: FakeSocket,
      onlineTarget: network,
      isOnline: () => online,
      setTimer: (f) => (timers.push(f), timers.length),
      clearTimer: () => {
        timers.length = 0
      },
    })
    FakeSocket.instances[0].close()
    expect(timers).toHaveLength(1)
    online = false
    network.emit('offline')
    expect(timers).toHaveLength(0)
    network.emit('online')
    expect(FakeSocket.instances).toHaveLength(1)
    online = true
    network.emit('online')
    expect(FakeSocket.instances).toHaveLength(2)
  })
  test('raw open does not reset retries but registered protocol traffic restores the budget', () => {
    const timers = []
    const socket = createAgentSocket({
      WebSocketImpl: FakeSocket,
      maxReconnectAttempts: 1,
      setTimer: (f) => (timers.push(f), timers.length),
      clearTimer: () => {},
    })
    FakeSocket.instances[0].close()
    timers.shift()()
    const retry = FakeSocket.instances[1]
    retry.open()
    retry.close()
    expect(timers).toHaveLength(0)
    expect(socket.reconnect()).toBe(true)
    const manual = FakeSocket.instances[2]
    manual.open()
    manual.emit('message', {
      data: JSON.stringify({ type: 'registered', agent_id: 'a' }),
    })
    manual.close()
    expect(timers).toHaveLength(1)
  })
  test('explicit close removes network listeners and prevents online reconnect', () => {
    const network = new FakeNetwork()
    const socket = createAgentSocket({
      WebSocketImpl: FakeSocket,
      onlineTarget: network,
    })
    expect(network.listeners.online.size).toBe(1)
    socket.close()
    expect(network.listeners.online.size).toBe(0)
    network.emit('online')
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
