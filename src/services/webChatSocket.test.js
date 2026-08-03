import { beforeEach, describe, expect, test } from 'bun:test'
import { createWebChatSocket } from './webChatSocket.js'

class FakeWebSocket {
  static OPEN = 1
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.listeners = {}
    this.sent = []
    FakeWebSocket.instances.push(this)
  }
  addEventListener(type, callback) {
    ;(this.listeners[type] ||= []).push(callback)
  }
  emit(type, payload = {}) {
    for (const callback of this.listeners[type] || []) callback(payload)
  }
  open() {
    this.readyState = 1
    this.emit('open')
  }
  send(value) {
    if (this.readyState !== 1) throw new Error('closed')
    this.sent.push(value)
  }
  close() {
    this.readyState = 3
    this.emit('close')
  }
}

function target() {
  const listeners = {}
  return {
    addEventListener(type, fn) {
      ;(listeners[type] ||= new Set()).add(fn)
    },
    removeEventListener(type, fn) {
      listeners[type]?.delete(fn)
    },
    emit(type) {
      for (const fn of listeners[type] || []) fn()
    },
    count(type) {
      return listeners[type]?.size || 0
    },
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
})

describe('web chat socket', () => {
  test('invalid gateway URLs fail synchronously without escaping connect', () => {
    const states = [],
      errors = [],
      timers = []
    const socket = createWebChatSocket({
      enabled: true,
      gatewayUrl: 'not a valid URL',
      WebSocketImpl: FakeWebSocket,
      onState: (state) => states.push(state),
      onError: (error) => errors.push(error),
      setTimer: (callback) => {
        timers.push(callback)
        return timers.length
      },
    })

    expect(() => socket.connect()).not.toThrow()
    expect(socket.connect()).toBe(false)
    expect(socket.getState()).toBe('error')
    expect(states.at(-1)).toBe('error')
    expect(errors.at(-1)).toBeInstanceOf(Error)
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(timers).toHaveLength(0)
  })

  test('constructor failures report error and remain manually retryable', () => {
    let shouldThrow = true
    const errors = [],
      timers = []
    function SwitchableWebSocket(url) {
      if (shouldThrow) throw new Error('Construction failed')
      return new FakeWebSocket(url)
    }
    SwitchableWebSocket.OPEN = FakeWebSocket.OPEN
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: SwitchableWebSocket,
      onError: (error) => errors.push(error),
      setTimer: (callback) => {
        timers.push(callback)
        return timers.length
      },
    })

    expect(socket.connect()).toBe(false)
    expect(socket.getState()).toBe('error')
    expect(errors[0].message).toBe('Construction failed')
    expect(timers).toHaveLength(0)

    shouldThrow = false
    expect(socket.connect()).toBe(true)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  test('builds ws and wss /ws/chat URLs through configured gateway conversion', () => {
    const http = createWebChatSocket({
      enabled: true,
      gatewayUrl: 'http://gateway.test/api',
      WebSocketImpl: FakeWebSocket,
    })
    http.connect()
    expect(FakeWebSocket.instances[0].url).toBe('ws://gateway.test/ws/chat')
    http.destroy()
    const https = createWebChatSocket({
      enabled: true,
      gatewayUrl: 'https://gateway.test/api/',
      WebSocketImpl: FakeWebSocket,
    })
    https.connect()
    expect(FakeWebSocket.instances[1].url).toBe('wss://gateway.test/ws/chat')
    https.destroy()
  })
  test('opens no socket while capability is disabled', () => {
    const socket = createWebChatSocket({
      enabled: false,
      WebSocketImpl: FakeWebSocket,
    })
    expect(socket.connect()).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })
  test('transitions, parses JSON/non-JSON, restores and extracts session IDs', () => {
    const states = [],
      frames = [],
      sessions = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      getSessionId: () => 'web_old',
      onState: (v) => states.push(v),
      onFrame: (v) => frames.push(v),
      onSessionId: (v) => sessions.push(v),
    })
    socket.connect()
    const ws = FakeWebSocket.instances[0]
    ws.open()
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'handshake',
      session_id: 'web_old',
    })
    ws.emit('message', {
      data: JSON.stringify({ type: 'connected', session_id: 'web_new' }),
    })
    expect(sessions).toEqual([])
    ws.emit('message', {
      data: JSON.stringify({
        type: 'connected',
        session_id: 'web_old',
        resumed: true,
      }),
    })
    ws.emit('message', { data: 'plain frame' })
    expect(sessions).toEqual(['web_old'])
    expect(frames.at(-1)).toEqual({ type: 'raw', data: 'plain frame' })
    expect(states).toContain('connected')
  })
  test('sends only while connected and reports unavailable sends', () => {
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
    })
    socket.connect()
    expect(() => socket.sendText({ message: 'Hi' })).toThrow('not connected')
    const ws = FakeWebSocket.instances[0]
    ws.open()
    expect(
      socket.sendText({
        message: 'Hi',
        sessionId: 'web_1',
        firstName: 'Ana',
        language: 'en',
      }),
    ).toBe(true)
    expect(JSON.parse(ws.sent[0])).toEqual({
      message: 'Hi',
      session_id: 'web_1',
      first_name: 'Ana',
      language: 'en',
    })
  })
  test('avoids duplicate sockets and explicit disconnect prevents reconnect', () => {
    const timers = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      setTimer: (fn) => {
        timers.push(fn)
        return timers.length
      },
    })
    socket.connect()
    socket.connect()
    expect(FakeWebSocket.instances).toHaveLength(1)
    FakeWebSocket.instances[0].open()
    socket.disconnect()
    expect(timers).toHaveLength(0)
    expect(socket.getState()).toBe('closed')
  })
  test('bounds reconnect attempts and handles offline/online without listener leaks', () => {
    const events = target(),
      navigatorRef = { onLine: true },
      timers = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      eventTarget: events,
      navigatorRef,
      maxReconnectAttempts: 2,
      setTimer: (fn) => {
        timers.push(fn)
        return timers.length
      },
      clearTimer: () => {},
    })
    socket.connect()
    FakeWebSocket.instances[0].close()
    timers.shift()()
    FakeWebSocket.instances[1].close()
    timers.shift()()
    FakeWebSocket.instances[2].close()
    expect(socket.getState()).toBe('error')
    navigatorRef.onLine = false
    events.emit('offline')
    expect(socket.getState()).toBe('offline')
    navigatorRef.onLine = true
    events.emit('online')
    expect(FakeWebSocket.instances.length).toBeGreaterThan(3)
    socket.destroy()
    expect(events.count('online')).toBe(0)
    expect(events.count('offline')).toBe(0)
  })

  test('open-then-close instability cannot reset the bounded retry budget', () => {
    const timers = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      maxReconnectAttempts: 2,
      setTimer: (fn) => {
        timers.push(fn)
        return timers.length
      },
      clearTimer: () => {},
    })

    socket.connect()
    FakeWebSocket.instances[0].open()
    FakeWebSocket.instances[0].close()
    timers.shift()()
    FakeWebSocket.instances[1].open()
    FakeWebSocket.instances[1].close()
    timers.shift()()
    FakeWebSocket.instances[2].open()
    FakeWebSocket.instances[2].close()

    expect(FakeWebSocket.instances).toHaveLength(3)
    expect(timers).toHaveLength(0)
    expect(socket.getState()).toBe('error')
  })

  test('a server frame restores the reconnect budget after a healthy exchange', () => {
    const timers = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      maxReconnectAttempts: 1,
      setTimer: (fn) => {
        timers.push(fn)
        return timers.length
      },
      clearTimer: () => {},
    })

    socket.connect()
    FakeWebSocket.instances[0].close()
    timers.shift()()
    const reconnected = FakeWebSocket.instances[1]
    reconnected.open()
    reconnected.emit('message', {
      data: JSON.stringify({ type: 'connected', session_id: 'web_healthy' }),
    })
    reconnected.close()

    expect(socket.getState()).toBe('reconnecting')
    expect(timers).toHaveLength(1)
  })

  test.each([
    ['connected', { type: 'connected', session_id: 'web_healthy' }],
    ['text', { type: 'message', text: 'Hello' }],
    ['gateway error', { type: 'error', message: 'Rate limited' }],
  ])('a valid %s frame restores the reconnect budget', (_name, frame) => {
    const timers = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      maxReconnectAttempts: 1,
      setTimer: (callback) => {
        timers.push(callback)
        return timers.length
      },
      clearTimer: () => {},
    })

    socket.connect()
    FakeWebSocket.instances.at(-1).close()
    timers.shift()()
    const reconnected = FakeWebSocket.instances.at(-1)
    reconnected.open()
    reconnected.emit('message', { data: JSON.stringify(frame) })
    reconnected.close()

    expect(socket.getState()).toBe('reconnecting')
    expect(timers).toHaveLength(1)
  })

  test.each([
    ['malformed JSON', '{bad'],
    ['binary data', new Uint8Array([1, 2])],
    ['empty object', JSON.stringify({})],
    ['unknown object', JSON.stringify({ foo: 'bar' })],
  ])('%s does not extend the bounded retry loop', (_name, data) => {
    const timers = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      maxReconnectAttempts: 1,
      setTimer: (callback) => {
        timers.push(callback)
        return timers.length
      },
      clearTimer: () => {},
    })

    socket.connect()
    const first = FakeWebSocket.instances.at(-1)
    first.open()
    first.emit('message', { data })
    first.close()
    timers.shift()()
    const retried = FakeWebSocket.instances.at(-1)
    retried.open()
    retried.emit('message', { data })
    retried.close()

    expect(socket.getState()).toBe('error')
    expect(timers).toHaveLength(0)
  })

  test('a stale socket frame cannot reset the active retry budget', () => {
    const timers = []
    const socket = createWebChatSocket({
      enabled: true,
      WebSocketImpl: FakeWebSocket,
      maxReconnectAttempts: 1,
      setTimer: (callback) => {
        timers.push(callback)
        return timers.length
      },
      clearTimer: () => {},
    })

    socket.connect()
    const stale = FakeWebSocket.instances[0]
    stale.close()
    timers.shift()()
    const active = FakeWebSocket.instances[1]
    active.open()
    stale.emit('message', {
      data: JSON.stringify({ type: 'connected', session_id: 'web_stale' }),
    })
    active.close()

    expect(socket.getState()).toBe('error')
    expect(timers).toHaveLength(0)
  })
})
