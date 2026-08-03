import { describe, expect, test } from 'bun:test'
import { uploadChatImage } from './chatMediaUpload'

const image = { type: 'image/png', size: 12, name: 'photo.png' }
class FormDataFake {
  entries = []
  append(...args) {
    this.entries.push(args)
  }
}

describe('chat media upload adapter', () => {
  test('disabled capability performs no request', async () => {
    let calls = 0
    await expect(
      uploadChatImage({
        file: image,
        enabled: false,
        fetchImpl: () => (calls += 1),
      }),
    ).rejects.toThrow('not enabled')
    expect(calls).toBe(0)
  })

  test('uses gateway multipart contract, signal and no manual content type', async () => {
    const signal = new AbortController().signal
    let captured
    const result = await uploadChatImage({
      file: image,
      enabled: true,
      gatewayUrl: 'https://gateway.example/',
      signal,
      FormDataImpl: FormDataFake,
      fetchImpl: async (url, options) => {
        captured = { url, options }
        return {
          ok: true,
          json: async () => ({
            success: true,
            url: 'https://cdn.example/a.png',
          }),
        }
      },
    })
    expect(captured.url).toBe('https://gateway.example/api/upload-image')
    expect(captured.options.method).toBe('POST')
    expect(captured.options.signal).toBe(signal)
    expect(captured.options.headers).toBeUndefined()
    expect(captured.options.body.entries).toEqual([['file', image]])
    expect(result.url).toBe('https://cdn.example/a.png')
  })

  test('rejects malformed, unsafe and HTTP-error responses', async () => {
    const base = { file: image, enabled: true, FormDataImpl: FormDataFake }
    await expect(
      uploadChatImage({
        ...base,
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ success: true }),
        }),
      }),
    ).rejects.toThrow()
    await expect(
      uploadChatImage({
        ...base,
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ success: true, url: 'blob:bad' }),
        }),
      }),
    ).rejects.toThrow()
    await expect(
      uploadChatImage({
        ...base,
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          json: async () => ({ error: 'Storage unavailable' }),
        }),
      }),
    ).rejects.toThrow('Storage unavailable')
  })

  test('propagates aborts without manufacturing success', async () => {
    const aborted = new Error('Aborted')
    aborted.name = 'AbortError'
    await expect(
      uploadChatImage({
        file: image,
        enabled: true,
        FormDataImpl: FormDataFake,
        fetchImpl: async () => {
          throw aborted
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
