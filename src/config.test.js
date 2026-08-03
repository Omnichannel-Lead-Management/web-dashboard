import { describe, expect, test } from 'bun:test'
import { businessProfileUpdateEnabled, explicitTrue } from './config.js'

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
