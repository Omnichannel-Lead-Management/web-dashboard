import { describe, expect, test } from 'bun:test'
import {
  IMAGE_ATTACHMENT_MAX_BYTES,
  createImageAttachmentDraft,
  isSafeRemoteImageUrl,
  mapUploadedImageResponse,
  revokeImageAttachmentPreview,
  validateImageAttachment,
} from './imageAttachments'

const file = (type, size = 10, name = 'photo.jpg') => ({ type, size, name })

describe('image attachment helpers', () => {
  test('accepts JPEG, PNG and WebP only', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp'])
      expect(validateImageAttachment(file(type))).toBe(true)
    for (const type of ['image/svg+xml', 'image/gif', 'text/plain'])
      expect(() => validateImageAttachment(file(type))).toThrow()
  })

  test('rejects empty, oversized, malformed and extension-only files', () => {
    expect(() => validateImageAttachment(file('image/png', 0))).toThrow('empty')
    expect(() =>
      validateImageAttachment(
        file('image/png', IMAGE_ATTACHMENT_MAX_BYTES + 1),
      ),
    ).toThrow('5 MB')
    expect(() => validateImageAttachment(null)).toThrow()
    expect(() =>
      validateImageAttachment(file('text/plain', 10, 'fake.png')),
    ).toThrow()
  })

  test('accepts only positive integer byte sizes within the limit', () => {
    for (const size of [NaN, Infinity, -Infinity, 1.5])
      expect(() => validateImageAttachment(file('image/png', size))).toThrow(
        'invalid file size',
      )
    for (const size of [-1, 0])
      expect(() => validateImageAttachment(file('image/png', size))).toThrow()
    for (const size of [undefined, null, '1000'])
      expect(() =>
        validateImageAttachment({ type: 'image/png', size, name: 'photo.png' }),
      ).toThrow('valid image file')

    expect(validateImageAttachment(file('image/png', 1))).toBe(true)
    expect(
      validateImageAttachment(file('image/png', IMAGE_ATTACHMENT_MAX_BYTES)),
    ).toBe(true)
    expect(() =>
      validateImageAttachment(
        file('image/png', IMAGE_ATTACHMENT_MAX_BYTES + 1),
      ),
    ).toThrow('5 MB')
  })

  test('file-size validation does not mutate the supplied file-like value', () => {
    const source = file('image/png', NaN, 'photo.png')
    const before = { ...source }
    expect(() => validateImageAttachment(source)).toThrow()
    expect(source).toEqual(before)
  })

  test('accepts secure remote and explicit local-development URLs only', () => {
    expect(isSafeRemoteImageUrl('https://cdn.example.com/a.jpg')).toBe(true)
    expect(isSafeRemoteImageUrl('http://localhost:8090/a.jpg')).toBe(true)
    expect(isSafeRemoteImageUrl('http://127.0.0.1:8090/a.jpg')).toBe(true)
    for (const value of [
      'http://example.com/a.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,x',
      'blob:https://example.com/x',
      '//example.com/a.jpg',
      ' https://example.com/a.jpg ',
      'java\nscript:alert(1)',
    ])
      expect(isSafeRemoteImageUrl(value)).toBe(false)
  })

  test('creates and revokes one object URL exactly once without mutating the file', () => {
    const source = file('image/png', 20, ' x.png ')
    const before = { ...source }
    let created = 0
    let revoked = 0
    const draft = createImageAttachmentDraft(source, {
      createObjectURL: () => {
        created += 1
        return 'blob:test-preview'
      },
    })
    expect(created).toBe(1)
    expect(source).toEqual(before)
    expect(draft.fileName).toBe('x.png')
    expect(draft.messageId).toBe('')
    expect(
      revokeImageAttachmentPreview(draft, {
        revokeObjectURL: () => (revoked += 1),
      }),
    ).toBe(true)
    expect(revokeImageAttachmentPreview(draft)).toBe(false)
    expect(revoked).toBe(1)
  })

  test('normalizes only confirmed uploads with safe URLs', () => {
    expect(
      mapUploadedImageResponse({
        success: true,
        url: 'https://cdn.example.com/a.png',
        request_id: 'req_1',
      }),
    ).toEqual({
      url: 'https://cdn.example.com/a.png',
      mediaId: 'req_1',
      mimeType: '',
      size: 0,
    })
    expect(() => mapUploadedImageResponse({ success: true })).toThrow()
    expect(() =>
      mapUploadedImageResponse({ success: true, url: 'data:image/png,x' }),
    ).toThrow('unsafe')
  })
})
