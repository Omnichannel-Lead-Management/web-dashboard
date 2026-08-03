import { beforeEach, describe, expect, test } from 'bun:test'
import {
  WEB_CHAT_SESSION_KEY,
  clearWebChatSession,
  loadWebChatSession,
  saveWebChatSession,
} from './webChatSession.js'

const storage = new Map()
const local = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
}
beforeEach(() => storage.clear())

describe('web chat session persistence', () => {
  test('loads a valid sanitized session', () => {
    storage.set(
      WEB_CHAT_SESSION_KEY,
      JSON.stringify({
        version: 1,
        sessionId: ' web_1 ',
        firstName: ' Ana ',
        lastName: ' Silva ',
        language: 'Tamil',
        updatedAt: 4,
      }),
    )
    expect(loadWebChatSession(local)).toEqual({
      version: 1,
      sessionId: 'web_1',
      firstName: 'Ana',
      lastName: 'Silva',
      language: 'ta',
      updatedAt: 4,
    })
  })
  test('discards malformed JSON and wrong versions', () => {
    storage.set(WEB_CHAT_SESSION_KEY, '{bad')
    expect(loadWebChatSession(local).sessionId).toBe('')
    storage.set(
      WEB_CHAT_SESSION_KEY,
      JSON.stringify({ version: 2, sessionId: 'old' }),
    )
    expect(loadWebChatSession(local).sessionId).toBe('')
  })
  test('persists only allowed identity fields, never history or arbitrary payloads', () => {
    const saved = saveWebChatSession(
      {
        sessionId: 'web_1',
        firstName: ' Ana ',
        language: 'Sinhala',
        messages: [{ text: 'secret' }],
        token: 'nope',
        businessId: 'fake',
      },
      local,
    )
    expect(Object.keys(saved).sort()).toEqual(
      [
        'firstName',
        'language',
        'lastName',
        'sessionId',
        'updatedAt',
        'version',
      ].sort(),
    )
    expect(JSON.stringify(saved)).not.toMatch(/secret|token|businessId/)
  })
  test('new conversation clears only the web chat key', () => {
    storage.set(WEB_CHAT_SESSION_KEY, '{}')
    storage.set('other', 'keep')
    clearWebChatSession(local)
    expect(storage.has(WEB_CHAT_SESSION_KEY)).toBe(false)
    expect(storage.get('other')).toBe('keep')
  })

  test('storage write failure still returns a sanitized in-memory session', () => {
    const denied = {
      setItem() {
        throw new Error('Storage denied')
      },
    }
    const saved = saveWebChatSession(
      { firstName: ' Ana ', language: 'Tamil', messages: ['private'] },
      denied,
    )

    expect(saved).toMatchObject({ firstName: 'Ana', language: 'ta' })
    expect(saved).not.toHaveProperty('messages')
  })

  test('storage removal failure is contained when starting a new conversation', () => {
    const denied = {
      removeItem() {
        throw new Error('Storage denied')
      },
    }

    expect(() => clearWebChatSession(denied)).not.toThrow()
    expect(clearWebChatSession(denied)).toBe(false)
  })

  test('default browser storage access remains safely contained', () => {
    const saved = saveWebChatSession({ firstName: 'Ana' })

    expect(loadWebChatSession()).toEqual(
      expect.objectContaining({ version: 1 }),
    )
    expect(saved).toMatchObject({ firstName: 'Ana', version: 1 })
    expect(() => clearWebChatSession()).not.toThrow()
  })
})
