let messageSequence = 0

function id(prefix = 'web') {
  messageSequence += 1
  return `${prefix}-${Date.now()}-${messageSequence}`
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function mapQuickReplies(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string')
        return { label: text(item), value: text(item) }
      if (!item || typeof item !== 'object') return null
      const label = text(item.title || item.label || item.text || item.value)
      const safeValue = text(item.value || label)
      return label ? { label, value: safeValue || label } : null
    })
    .filter(Boolean)
}

function displayMessage(frame) {
  if (typeof frame === 'string') {
    const content = text(frame)
    return content
      ? {
          id: id('received'),
          role: 'bot',
          type: 'text',
          text: content,
          quickReplies: [],
          status: 'received',
          createdAt: Date.now(),
        }
      : null
  }
  if (!frame || typeof frame !== 'object') return null
  const error =
    text(frame.error) || (frame.type === 'error' ? text(frame.message) : '')
  if (error) {
    return {
      id: id('error'),
      role: 'system',
      type: 'error',
      text: error,
      quickReplies: [],
      status: 'received',
      createdAt: Date.now(),
    }
  }
  if (frame.type === 'connected') return null
  const content = text(frame.text || frame.message || frame.response)
  const quickReplies = mapQuickReplies(
    frame.quick_replies || frame.quickReplies,
  )
  if (!content && !quickReplies.length) return null
  return {
    id: id('received'),
    role: 'bot',
    type:
      frame.type === 'interactive' || quickReplies.length
        ? 'interactive'
        : 'text',
    text: content,
    quickReplies,
    status: 'received',
    createdAt: Date.now(),
  }
}

export function mapWebChatServerFrame(frame) {
  if (!frame || typeof frame !== 'object')
    return { sessionId: '', messages: [] }
  const sessionId = text(frame.session_id || frame.sessionId)
  const sources = Array.isArray(frame.messages) ? frame.messages : [frame]
  return {
    sessionId,
    messages: sources.map(displayMessage).filter(Boolean),
  }
}

export function isRecognizedWebChatServerFrame(frame) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return false

  if (frame.type === 'connected') return true
  if (text(frame.session_id || frame.sessionId)) return true
  if (text(frame.error)) return true
  if (frame.type === 'error' && text(frame.message)) return true

  if (Array.isArray(frame.messages)) {
    return frame.messages.some((message) => {
      if (typeof message === 'string') return Boolean(text(message))
      return isRecognizedWebChatServerFrame(message)
    })
  }

  const content = text(frame.text || frame.message || frame.response)
  const quickReplies = mapQuickReplies(
    frame.quick_replies || frame.quickReplies,
  )
  return Boolean(content || quickReplies.length)
}

export function createOutgoingWebChatMessage(
  displayText,
  wireValue = displayText,
) {
  const normalizedText = text(displayText)
  return {
    id: id('customer'),
    role: 'customer',
    type: 'text',
    text: normalizedText,
    wireValue: text(wireValue) || normalizedText,
    quickReplies: [],
    status: 'sending',
    createdAt: Date.now(),
  }
}

export function getWebChatMessageWireValue(message) {
  return text(message?.wireValue) || text(message?.text)
}

export function canSendWebChatQuickReply(canSend, processing) {
  return canSend === true && processing !== true
}

export function withWebChatMessageStatus(message, status) {
  return { ...message, status }
}
