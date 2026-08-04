import { agentEscalationQueueEnabled, gatewayWsUrl } from '../config'

export function createAgentSocket({
  onEvent,
  onOpen,
  onClose,
  onError,
  onStateChange,
  WebSocketImpl = globalThis.WebSocket,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  maxReconnectAttempts = 5,
  onlineTarget = globalThis.window,
  isOnline = () => globalThis.navigator?.onLine !== false,
} = {}) {
  let socket = null
  let shouldReconnect = true
  let reconnectTimer = null
  let reconnectAttempts = 0
  let listenersAttached = false

  function setState(state) {
    onStateChange?.(state)
  }

  function clearReconnect() {
    if (reconnectTimer !== null) clearTimer(reconnectTimer)
    reconnectTimer = null
  }

  function scheduleReconnect() {
    if (
      !shouldReconnect ||
      !isOnline() ||
      reconnectAttempts >= maxReconnectAttempts
    ) {
      if (!isOnline()) setState('offline')
      else if (shouldReconnect) setState('error')
      return false
    }
    reconnectAttempts += 1
    setState('reconnecting')
    reconnectTimer = setTimer(
      connect,
      Math.min(500 * 2 ** (reconnectAttempts - 1), 4000),
    )
    return true
  }

  function markHealthy(current, event) {
    if (
      socket === current &&
      (event?.type === 'registered' || event?.type === 'queue_snapshot')
    ) {
      reconnectAttempts = 0
      setState('connected')
    }
  }

  function connect() {
    if (
      !shouldReconnect ||
      !isOnline() ||
      (socket &&
        [WebSocketImpl.CONNECTING ?? 0, WebSocketImpl.OPEN ?? 1].includes(
          socket.readyState,
        ))
    ) {
      if (!isOnline()) setState('offline')
      return false
    }
    clearReconnect()
    setState(reconnectAttempts ? 'reconnecting' : 'connecting')
    let current
    try {
      current = new WebSocketImpl(gatewayWsUrl('/ws/agents'))
    } catch (error) {
      socket = null
      setState('error')
      onError?.(error)
      return false
    }
    socket = current
    current.addEventListener('open', () => {
      if (socket === current) onOpen?.()
    })
    current.addEventListener('message', (messageEvent) => {
      if (socket !== current || typeof messageEvent.data !== 'string') return
      try {
        const event = JSON.parse(messageEvent.data)
        markHealthy(current, event)
        onEvent?.(event)
      } catch {
        // Ignore malformed events without marking the connection healthy.
      }
    })
    current.addEventListener('close', () => {
      if (socket !== current) return
      socket = null
      onClose?.()
      scheduleReconnect()
    })
    current.addEventListener('error', () => {
      if (socket === current) onError?.(new Error('Agent channel error'))
    })
    return true
  }

  function handleOffline() {
    clearReconnect()
    const current = socket
    socket = null
    try {
      current?.close()
    } catch {
      // The browser may already have closed the transport.
    }
    setState('offline')
  }

  function handleOnline() {
    if (
      !shouldReconnect ||
      socket ||
      reconnectTimer !== null ||
      reconnectAttempts >= maxReconnectAttempts
    )
      return
    connect()
  }

  function attachNetworkListeners() {
    if (listenersAttached || !onlineTarget?.addEventListener) return
    onlineTarget.addEventListener('offline', handleOffline)
    onlineTarget.addEventListener('online', handleOnline)
    listenersAttached = true
  }

  function removeNetworkListeners() {
    if (!listenersAttached || !onlineTarget?.removeEventListener) return
    onlineTarget.removeEventListener('offline', handleOffline)
    onlineTarget.removeEventListener('online', handleOnline)
    listenersAttached = false
  }

  function send(payload) {
    if (!socket || socket.readyState !== (WebSocketImpl.OPEN ?? 1)) return false
    try {
      socket.send(JSON.stringify(payload))
      return true
    } catch (error) {
      onError?.(error)
      return false
    }
  }

  function sendClaim({ platform, messengerId, businessId } = {}) {
    if (!agentEscalationQueueEnabled) return false
    return send({
      type: 'claim_chat',
      platform,
      messenger_id: messengerId,
      business_id: businessId,
    })
  }

  function sendRelease({ platform, messengerId, businessId } = {}) {
    if (!agentEscalationQueueEnabled) return false
    return send({
      type: 'release_chat',
      platform,
      messenger_id: messengerId,
      business_id: businessId,
    })
  }

  function close() {
    shouldReconnect = false
    clearReconnect()
    removeNetworkListeners()
    const current = socket
    socket = null
    setState('closed')
    try {
      current?.close()
    } catch {
      // The transport is already closed.
    }
  }

  function reconnect() {
    if (!shouldReconnect || !isOnline()) {
      if (!isOnline()) setState('offline')
      return false
    }
    reconnectAttempts = 0
    clearReconnect()
    return connect()
  }

  attachNetworkListeners()
  connect()
  return { send, sendClaim, sendRelease, close, reconnect }
}
