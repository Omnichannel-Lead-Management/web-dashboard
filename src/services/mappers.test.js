import { describe, expect, test } from 'bun:test'
import {
  conversationId,
  mapConversation,
  mapHistoryMessage,
  parseConversationId,
} from './mappers.js'
import { gatewayWsUrl } from '../config.js'

describe('mappers unit', () => {
  test('conversationId and parseConversationId round-trip', () => {
    const id = conversationId('telegram', '12345')
    expect(id).toBe('telegram:12345')
    expect(parseConversationId(id)).toEqual({
      platform: 'telegram',
      messenger_id: '12345',
    })
  })

  test('mapConversation marks escalated queued chats unread', () => {
    const mapped = mapConversation({
      platform: 'telegram',
      messenger_id: '99',
      display_name: 'Kasun Perera',
      is_escalated: true,
      escalation_status: 'queued',
      claimed_by_agent_id: null,
      last_message: { text: 'Need help', is_from_user: true, created_at: '2026-07-25T10:00:00Z' },
      updated_at: '2026-07-25T10:00:00Z',
    })
    expect(mapped.id).toBe('telegram:99')
    expect(mapped.channel).toBe('Telegram')
    expect(mapped.initials).toBe('KP')
    expect(mapped.escalated).toBe(true)
    expect(mapped.claimed).toBe(false)
    expect(mapped.unread).toBe(true)
    expect(mapped.preview).toBe('Need help')
  })

  test('mapHistoryMessage maps sender roles', () => {
    expect(mapHistoryMessage({ id: 1, from: 'user', text: 'hi', timestamp: '2026-07-25T10:00:00Z' }).sender).toBe(
      'customer',
    )
    expect(mapHistoryMessage({ id: 2, from: 'agent', text: 'hello', timestamp: '2026-07-25T10:00:00Z' }).sender).toBe(
      'agent',
    )
    expect(mapHistoryMessage({ id: 3, from: 'ai', text: 'bot', timestamp: '2026-07-25T10:00:00Z' }).sender).toBe(
      'bot',
    )
  })
})

describe('config unit', () => {
  test('gatewayWsUrl switches protocol and path', () => {
    expect(gatewayWsUrl('/ws/agents', 'http://example.com:3000')).toBe('ws://example.com:3000/ws/agents')
    expect(gatewayWsUrl('/ws/agents', 'https://cache.us.kg')).toBe('wss://cache.us.kg/ws/agents')
  })
})
