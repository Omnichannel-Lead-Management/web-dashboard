import { describe, expect, test } from 'bun:test'
import {
  isTelegramRequestCurrent,
  normalizeTelegramToken,
  refreshTelegramBusinessBestEffort,
  telegramSecretReset,
  telegramSafeErrorMessage,
} from './telegramConnection.js'

describe('Telegram connection helpers', () => {
  test('rejects blank tokens', () => {
    expect(normalizeTelegramToken('  ')).toEqual({
      token: '',
      error: 'Enter a Telegram bot token',
    })
  })

  test('trims a valid token without making the format unnecessarily strict', () => {
    expect(normalizeTelegramToken(' 123456:abc_DEF-123 ')).toEqual({
      token: '123456:abc_DEF-123',
      error: '',
    })
  })

  test('rejects spaces and newlines inside a token', () => {
    expect(normalizeTelegramToken('123:abc def').error).toContain('spaces')
    expect(normalizeTelegramToken('123:abc\ndef').error).toContain('spaces')
  })

  test('business change, logout and new login reset token visibility', () => {
    const businessChange = telegramSecretReset()
    const logout = telegramSecretReset()
    const newLogin = telegramSecretReset()
    expect(businessChange).toEqual({ token: '', showToken: false })
    expect(logout).toEqual({ token: '', showToken: false })
    expect(newLogin).toEqual({ token: '', showToken: false })
  })

  test('failed same-session retry does not require a secret reset', () => {
    const draft = { token: '123:retry-token', showToken: true }
    const requestIsCurrent = isTelegramRequestCurrent(
      2,
      2,
      'biz_1',
      'biz_1',
      true,
    )
    expect(requestIsCurrent).toBe(true)
    expect(draft).toEqual({ token: '123:retry-token', showToken: true })
  })

  test('success and unmount use the secret reset shape', () => {
    expect(telegramSecretReset()).toEqual({ token: '', showToken: false })
    expect(telegramSecretReset()).toEqual({ token: '', showToken: false })
  })

  test('rejects stale generation, tenant and unmounted responses', () => {
    expect(isTelegramRequestCurrent(2, 2, 'biz_1', 'biz_1', true)).toBe(true)
    expect(isTelegramRequestCurrent(1, 2, 'biz_1', 'biz_1', true)).toBe(false)
    expect(isTelegramRequestCurrent(2, 2, 'biz_1', 'biz_2', true)).toBe(false)
    expect(isTelegramRequestCurrent(2, 2, 'biz_1', 'biz_1', false)).toBe(false)
  })

  test('redacts a token if a backend error unexpectedly contains it', () => {
    const message = telegramSafeErrorMessage(
      new Error('Token 123:secret was rejected'),
      '123:secret',
    )
    expect(message).toBe('Token [redacted] was rejected')
  })

  test('metadata refresh failure is best effort after confirmation', async () => {
    const connection = { state: 'connected', botUsername: 'sample_bot' }
    expect(
      await refreshTelegramBusinessBestEffort(async () => {
        throw new Error('metadata unavailable')
      }),
    ).toBe(false)
    expect(connection).toEqual({
      state: 'connected',
      botUsername: 'sample_bot',
    })
    expect(await refreshTelegramBusinessBestEffort(async () => {})).toBe(true)
  })
})
