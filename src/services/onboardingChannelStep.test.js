import { describe, expect, test } from 'bun:test'
import { isOnboardingChannelConfirmed } from './onboardingChannelStep.js'

function confirmed(business, businessId = 'biz_a', live = false) {
  return isOnboardingChannelConfirmed({
    business,
    businessId,
    channelConfirmedThisSession: live,
  })
}

describe('onboarding channel completion', () => {
  test('persisted WhatsApp metadata completes without a live event', () => {
    expect(confirmed({ id: 'biz_a', whatsapp_connected: true })).toBe(true)
  })

  test('a failed or absent live result does not undo persisted WhatsApp metadata', () => {
    expect(
      confirmed({ id: 'biz_a', whatsapp_connected: true }, 'biz_a', false),
    ).toBe(true)
  })

  test('persisted false without a live event remains incomplete', () => {
    expect(
      confirmed({ id: 'biz_a', whatsapp_connected: false }, 'biz_a', false),
    ).toBe(false)
  })

  test('a successful live event completes when persisted metadata is false', () => {
    expect(
      confirmed({ id: 'biz_a', whatsapp_connected: false }, 'biz_a', true),
    ).toBe(true)
  })

  test('switching to an unconnected business resets completion', () => {
    expect(confirmed({ id: 'biz_a', whatsapp_connected: true })).toBe(true)
    expect(
      confirmed({ id: 'biz_b', whatsapp_connected: false }, 'biz_b', false),
    ).toBe(false)
  })

  test('Business A metadata cannot complete Business B', () => {
    expect(
      confirmed({ id: 'biz_a', whatsapp_connected: true }, 'biz_b', false),
    ).toBe(false)
  })

  test('persisted Telegram completion remains unchanged', () => {
    expect(confirmed({ id: 'biz_a', telegram_connected: true })).toBe(true)
    expect(confirmed({ id: 'biz_a', telegram_connected: false })).toBe(false)
  })
})
