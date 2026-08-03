const KEY = 'omnichannel:web-chat:v1'
const VERSION = 1
const LANGUAGES = new Set(['en', 'si', 'ta'])

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function normalizeWebChatLanguage(value) {
  const language = cleanText(value, 8).toLowerCase()
  const aliases = { english: 'en', sinhala: 'si', tamil: 'ta' }
  const normalized = aliases[language] || language
  return LANGUAGES.has(normalized) ? normalized : 'en'
}

export function sanitizeWebChatSession(value) {
  if (!value || typeof value !== 'object' || value.version !== VERSION)
    return null
  return {
    version: VERSION,
    sessionId: cleanText(value.sessionId, 160),
    firstName: cleanText(value.firstName, 80),
    lastName: cleanText(value.lastName, 80),
    language: normalizeWebChatLanguage(value.language),
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
  }
}

export function emptyWebChatSession() {
  return {
    version: VERSION,
    sessionId: '',
    firstName: '',
    lastName: '',
    language: 'en',
    updatedAt: 0,
  }
}

export function loadWebChatSession(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(KEY)
    if (!raw) return emptyWebChatSession()
    return sanitizeWebChatSession(JSON.parse(raw)) || emptyWebChatSession()
  } catch {
    return emptyWebChatSession()
  }
}

export function saveWebChatSession(value, storage) {
  const sanitized = sanitizeWebChatSession({
    ...value,
    version: VERSION,
    updatedAt: Date.now(),
  })
  if (!sanitized) return null
  try {
    ;(storage ?? globalThis.localStorage).setItem(
      KEY,
      JSON.stringify(sanitized),
    )
  } catch {
    // The caller can continue with this sanitized in-memory session when
    // browser storage is disabled, unavailable, or over quota.
  }
  return sanitized
}

export function clearWebChatSession(storage) {
  try {
    ;(storage ?? globalThis.localStorage).removeItem(KEY)
    return true
  } catch {
    return false
  }
}

export const WEB_CHAT_SESSION_KEY = KEY
