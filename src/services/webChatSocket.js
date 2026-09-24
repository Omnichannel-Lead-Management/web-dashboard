import {
  GATEWAY_URL,
  gatewayWsUrl,
  imageAttachmentsEnabled,
  webChatEnabled,
} from '../config'
import { normalizeRemoteImageUrl } from './imageAttachments'
import { isRecognizedWebChatServerFrame } from './webChatMessages'

export function createWebChatSocket({
  enabled = webChatEnabled,
  imagesEnabled = imageAttachmentsEnabled,
  gatewayUrl = GATEWAY_URL,
  WebSocketImpl = globalThis.WebSocket,
  eventTarget = globalThis,
  navigatorRef = globalThis.navigator,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  maxReconnectAttempts = 4,
  reconnectDelays = [500, 1000, 2000, 4000],
  getSessionId = () => '',
  getBusinessId = () => '',
  onFrame,
  onSessionId,
  onState,
  onError,
} = {}) {
  let socket = null
  let reconnectTimer = null
  let reconnectAttempts = 0
  let explicitlyClosed = false
  let state = 'idle'
  let awaitingRestore = false

  const setState = (next) => {
    state = next
    onState?.(next)
  }
  const clearReconnect = () => {
    if (reconnectTimer !== null) clearTimer(reconnectTimer)
    reconnectTimer = null
  }
  const isOffline = () => navigatorRef?.onLine === false

  function scheduleReconnect() {
    if (explicitlyClosed || isOffline()) {
      if (isOffline()) setState('offline')
      return
    }
    if (reconnectAttempts >= maxReconnectAttempts) {
      setState('error')
      return
    }
    const delay =
      reconnectDelays[Math.min(reconnectAttempts, reconnectDelays.length - 1)]
    reconnectAttempts += 1
    setState('reconnecting')
    clearReconnect()
    reconnectTimer = setTimer(connect, delay)
  }

  function connect() {
    if (!enabled) {
      setState('idle')
      return false
    }
    if (explicitlyClosed) explicitlyClosed = false
    if (isOffline()) {
      setState('offline')
      return false
    }
    if (socket && [0, 1].includes(socket.readyState)) return false
    clearReconnect()
    setState(reconnectAttempts ? 'reconnecting' : 'connecting')
    let current
    try {
      // The tenant has to ride on the URL: a browser WebSocket cannot send
      // headers, and without it the gateway files the conversation under
      // biz_default instead of the business the customer is talking to.
      const businessId = String(getBusinessId() || '').trim()
      const base = gatewayWsUrl('/ws/chat', gatewayUrl)
      const url = businessId
        ? `${base}?business_id=${encodeURIComponent(businessId)}`
        : base
      current = new WebSocketImpl(url)
    } catch (error) {
      socket = null
      awaitingRestore = false
      clearReconnect()
      setState('error')
      onError?.(
        error instanceof Error
          ? error
          : new Error('Web chat connection could not be created'),
      )
      return false
    }
    socket = current

    current.addEventListener('open', () => {
      if (socket !== current) return
      setState('connected')
      const sessionId = String(getSessionId() || '').trim()
      awaitingRestore = Boolean(sessionId)
      // The gateway's registered restoration contract is a post-open handshake;
      // session IDs are otherwise included with the next customer message.
      if (sessionId)
        current.send(
          JSON.stringify({ type: 'handshake', session_id: sessionId }),
        )
    })
    current.addEventListener('message', (event) => {
      if (socket !== current) return
      let frame
      if (typeof event.data === 'string') {
        try {
          frame = JSON.parse(event.data)
        } catch {
          frame = { type: 'raw', data: event.data }
        }
      } else frame = { type: 'raw', data: '' }
      if (isRecognizedWebChatServerFrame(frame)) reconnectAttempts = 0
      const sessionId =
        typeof frame?.session_id === 'string' ? frame.session_id.trim() : ''
      const resumed = frame?.resumed === true
      if (sessionId && (!awaitingRestore || resumed)) {
        awaitingRestore = false
        onSessionId?.(sessionId)
      }
      onFrame?.(frame)
    })
    current.addEventListener('error', () => {
      if (socket !== current) return
      setState('error')
      onError?.(new Error('Web chat connection error'))
    })
    current.addEventListener('close', () => {
      if (socket !== current) return
      socket = null
      awaitingRestore = false
      if (explicitlyClosed) setState('closed')
      else scheduleReconnect()
    })
    return true
  }

  function sendText({
    message,
    sessionId,
    firstName,
    lastName,
    language,
  } = {}) {
    if (!socket || socket.readyState !== WebSocketImpl.OPEN)
      throw new Error('Web chat is not connected')
    const payload = { message: String(message || '').trim() }
    if (!payload.message) throw new Error('Message is required')
    if (sessionId) payload.session_id = sessionId
    if (firstName) payload.first_name = firstName
    if (lastName) payload.last_name = lastName
    if (language) payload.language = language
    socket.send(JSON.stringify(payload))
    return true
  }

  function sendImage({
    url,
    message,
    sessionId,
    firstName,
    lastName,
    language,
  } = {}) {
    if (!imagesEnabled) throw new Error('Image attachments are not enabled')
    if (!socket || socket.readyState !== WebSocketImpl.OPEN)
      throw new Error('Web chat is not connected')
    const safeUrl = normalizeRemoteImageUrl(url)
    if (!safeUrl) throw new Error('A safe uploaded image URL is required')
    const payload = { type: 'image', url: safeUrl }
    const caption = String(message || '').trim()
    if (caption) payload.message = caption
    if (sessionId) payload.session_id = sessionId
    if (firstName) payload.first_name = firstName
    if (lastName) payload.last_name = lastName
    if (language) payload.language = language
    socket.send(JSON.stringify(payload))
    return true
  }

  function disconnect() {
    explicitlyClosed = true
    clearReconnect()
    const current = socket
    socket = null
    try {
      current?.close()
    } catch {
      /* already closed */
    }
    setState('closed')
  }

  function handleOffline() {
    clearReconnect()
    setState('offline')
    try {
      socket?.close()
    } catch {
      /* already closed */
    }
  }
  function handleOnline() {
    if (!explicitlyClosed && enabled) connect()
  }
  eventTarget?.addEventListener?.('offline', handleOffline)
  eventTarget?.addEventListener?.('online', handleOnline)

  function destroy() {
    disconnect()
    eventTarget?.removeEventListener?.('offline', handleOffline)
    eventTarget?.removeEventListener?.('online', handleOnline)
  }

  return {
    connect,
    disconnect,
    destroy,
    sendText,
    sendImage,
    getState: () => state,
  }
}
