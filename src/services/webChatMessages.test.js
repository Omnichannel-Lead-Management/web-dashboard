import { describe, expect, test } from 'bun:test'
import {
  canSendWebChatQuickReply,
  createOutgoingWebChatMessage,
  createOutgoingWebChatImageMessage,
  getWebChatMessageWireValue,
  isRecognizedWebChatServerFrame,
  mapQuickReplies,
  mapWebChatServerFrame,
  withWebChatMessageStatus,
} from './webChatMessages.js'

describe('web chat message mapping', () => {
  test('maps connected frames without inventing a message', () => {
    expect(
      mapWebChatServerFrame({ type: 'connected', session_id: 'web_1' }),
    ).toEqual({ sessionId: 'web_1', messages: [] })
  })
  test('maps text, response, arrays and multiple messages', () => {
    expect(mapWebChatServerFrame({ message: 'Hello' }).messages[0].text).toBe(
      'Hello',
    )
    const mapped = mapWebChatServerFrame({
      messages: [{ text: 'One' }, { response: 'Two' }, 'Three'],
    })
    expect(mapped.messages.map((item) => item.text)).toEqual([
      'One',
      'Two',
      'Three',
    ])
  })
  test('maps interactive replies with safe visible fallbacks', () => {
    const frame = {
      type: 'interactive',
      text: 'Choose',
      quick_replies: [{ title: 'Book', value: 'book_now' }, 'Later'],
    }
    const snapshot = structuredClone(frame)
    const mapped = mapWebChatServerFrame(frame).messages[0]
    expect(mapped.type).toBe('interactive')
    expect(mapped.quickReplies).toEqual([
      { label: 'Book', value: 'book_now' },
      { label: 'Later', value: 'Later' },
    ])
    expect(frame).toEqual(snapshot)
    expect(
      mapQuickReplies([{ title: 'Visible', id: 'unverified-id' }]),
    ).toEqual([{ label: 'Visible', value: 'Visible' }])
  })
  test('maps errors and safely ignores unknown frames', () => {
    expect(
      mapWebChatServerFrame({ error: 'Try later' }).messages[0],
    ).toMatchObject({ type: 'error', text: 'Try later' })
    expect(
      mapWebChatServerFrame({ type: 'mystery', data: { safe: true } }).messages,
    ).toEqual([])
    expect(mapQuickReplies('bad')).toEqual([])
  })

  test('maps safe image frames and rejects unsafe image URLs', () => {
    const source = {
      type: 'image',
      image_url: 'https://cdn.example.com/photo.jpg',
      message: 'A photo',
    }
    const snapshot = structuredClone(source)
    expect(mapWebChatServerFrame(source).messages[0]).toMatchObject({
      type: 'image',
      imageUrl: source.image_url,
      text: 'A photo',
    })
    expect(source).toEqual(snapshot)
    expect(
      mapWebChatServerFrame({ type: 'image', url: 'data:image/png,x' })
        .messages,
    ).toEqual([])
    expect(
      createOutgoingWebChatImageMessage({
        caption: ' Caption ',
        previewUrl: 'blob:local-only',
        attachmentId: 'a1',
      }),
    ).toMatchObject({
      type: 'image',
      text: 'Caption',
      imageUrl: 'blob:local-only',
      status: 'uploading',
    })
  })

  test('recognizes only supported gateway protocol frames', () => {
    expect(
      isRecognizedWebChatServerFrame({
        type: 'connected',
        session_id: 'web_1',
      }),
    ).toBe(true)
    expect(isRecognizedWebChatServerFrame({ text: 'Hello' })).toBe(true)
    expect(isRecognizedWebChatServerFrame({ error: 'Try later' })).toBe(true)
    expect(
      isRecognizedWebChatServerFrame({
        type: 'interactive',
        quick_replies: ['Book'],
      }),
    ).toBe(true)
    expect(
      isRecognizedWebChatServerFrame({ messages: [{ response: 'One' }] }),
    ).toBe(true)

    expect(isRecognizedWebChatServerFrame({})).toBe(false)
    expect(isRecognizedWebChatServerFrame({ foo: 'bar' })).toBe(false)
    expect(isRecognizedWebChatServerFrame([])).toBe(false)
    expect(isRecognizedWebChatServerFrame(null)).toBe(false)
    expect(isRecognizedWebChatServerFrame({ messages: [] })).toBe(false)
  })
  test('typed messages use their display text as the retry-safe wire value', () => {
    const outgoing = createOutgoingWebChatMessage('  Hi  ')
    expect(outgoing).toMatchObject({
      role: 'customer',
      text: 'Hi',
      wireValue: 'Hi',
      status: 'sending',
    })
    expect(getWebChatMessageWireValue(outgoing)).toBe('Hi')
    expect(withWebChatMessageStatus(outgoing, 'sent')).toMatchObject({
      status: 'sent',
    })
    expect(withWebChatMessageStatus(outgoing, 'failed')).toMatchObject({
      status: 'failed',
    })
    expect(outgoing.status).toBe('sending')
  })

  test('quick-reply messages preserve different display and wire values', () => {
    const outgoing = createOutgoingWebChatMessage('  Book  ', '  book_now  ')
    const failed = withWebChatMessageStatus(outgoing, 'failed')

    expect(failed).toMatchObject({
      text: 'Book',
      wireValue: 'book_now',
      status: 'failed',
    })
    expect(getWebChatMessageWireValue(failed)).toBe('book_now')
    expect(getWebChatMessageWireValue(failed)).not.toBe(failed.text)
    expect(withWebChatMessageStatus(failed, 'sending').id).toBe(outgoing.id)
  })

  test('empty or missing wire values safely fall back to display text', () => {
    expect(createOutgoingWebChatMessage('Later', '   ').wireValue).toBe('Later')
    expect(getWebChatMessageWireValue({ text: ' Retry ', wireValue: '' })).toBe(
      'Retry',
    )
  })

  test('quick replies require a connected send state and no active send', () => {
    expect(canSendWebChatQuickReply(true, false)).toBe(true)
    expect(canSendWebChatQuickReply(false, false)).toBe(false)
    expect(canSendWebChatQuickReply(true, true)).toBe(false)
    expect(canSendWebChatQuickReply(false, true)).toBe(false)
  })
})
