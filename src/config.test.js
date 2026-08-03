import { describe, expect, test } from 'bun:test'
import {
  businessProfileUpdateEnabled,
  explicitTrue,
  notificationCenterEnabled,
  webChatEnabled,
} from './config.js'

describe('business profile update capability', () => {
  test('missing capability defaults to disabled', () => {
    expect(businessProfileUpdateEnabled).toBe(false)
    expect(explicitTrue(undefined)).toBe(false)
  })

  test('false disables and only the exact true value enables', () => {
    expect(explicitTrue('false')).toBe(false)
    expect(explicitTrue('TRUE')).toBe(false)
    expect(explicitTrue('true')).toBe(true)
  })

  test('example environment documents disabled deployment default', async () => {
    const example = await Bun.file(
      new URL('../.env.example', import.meta.url),
    ).text()
    expect(example).toContain('VITE_BUSINESS_PROFILE_UPDATE_ENABLED=false')
    expect(example).toContain('PATCH /api/businesses/:businessId')
  })
})

describe('notification centre capability', () => {
  test('missing flag defaults disabled and only exact true enables', () => {
    expect(notificationCenterEnabled).toBe(false)
    expect(explicitTrue(undefined)).toBe(false)
    expect(explicitTrue('false')).toBe(false)
    expect(explicitTrue('TRUE')).toBe(false)
    expect(explicitTrue('true')).toBe(true)
  })

  test('example environment documents the disabled default', async () => {
    const example = await Bun.file(
      new URL('../.env.example', import.meta.url),
    ).text()
    expect(example).toContain('VITE_NOTIFICATION_CENTER_ENABLED=false')
  })
})

describe('web chat capability', () => {
  test('missing capability defaults to disabled', () => {
    expect(webChatEnabled).toBe(false)
  })

  test('only the exact true string enables the capability', () => {
    expect(explicitTrue('false')).toBe(false)
    expect(explicitTrue('true')).toBe(true)
  })

  test('example environment documents the safe disabled default', async () => {
    const example = await Bun.file(
      new URL('../.env.example', import.meta.url),
    ).text()
    expect(example).toContain('VITE_WEB_CHAT_ENABLED=false')
    expect(example).toContain('secure tenant binding')
  })
})
