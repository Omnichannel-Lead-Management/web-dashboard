import { gatewayWsUrl } from '../config'

export function createAgentSocket({
  onEvent,
  onOpen,
  onClose,
  onError,
} = {}) {
  let socket = null
  let shouldReconnect = true
  let reconnectTimer = null

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function connect() {
    clearReconnect()
    socket = new WebSocket(gatewayWsUrl('/ws/agents'))

    socket.addEventListener('open', () => {
      onOpen?.()
    })

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return
      try {
        onEvent?.(JSON.parse(event.data))
      } catch {
        // ignore malformed events
      }
    })

    socket.addEventListener('close', () => {
      onClose?.()
      if (!shouldReconnect) return
      reconnectTimer = setTimeout(connect, 2000)
    })

    socket.addEventListener('error', () => {
      onError?.()
    })
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false
    }
    socket.send(JSON.stringify(payload))
    return true
  }

  function close() {
    shouldReconnect = false
    clearReconnect()
    try {
      socket?.close()
    } catch {
      // ignore
    }
    socket = null
  }

  connect()

  return { send, close, reconnect: connect }
}
