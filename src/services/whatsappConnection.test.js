import { describe, expect, test } from 'bun:test'
import {
  isWhatsAppRequestCurrent,
  refreshWhatsAppBusinessBestEffort,
  resolveWhatsAppInitialState,
  shouldPollWhatsApp,
} from './whatsappConnection.js'

describe('WhatsApp connection lifecycle helpers', () => {
  test('polling continues only while mounted and awaiting scan', () => {
    expect(shouldPollWhatsApp('awaiting-scan', true)).toBe(true)
    expect(shouldPollWhatsApp('connected', true)).toBe(false)
    expect(shouldPollWhatsApp('error', true)).toBe(false)
    expect(shouldPollWhatsApp('awaiting-scan', false)).toBe(false)
  })

  test('old generation, tenant and unmounted responses are rejected', () => {
    expect(isWhatsAppRequestCurrent(2, 2, 'biz_1', 'biz_1', true)).toBe(true)
    expect(isWhatsAppRequestCurrent(1, 2, 'biz_1', 'biz_1', true)).toBe(false)
    expect(isWhatsAppRequestCurrent(2, 2, 'biz_1', 'biz_2', true)).toBe(false)
    expect(isWhatsAppRequestCurrent(2, 2, 'biz_1', 'biz_1', false)).toBe(false)
  })

  test('live connected status allows connected regardless of business flag', () => {
    expect(
      resolveWhatsAppInitialState(
        { whatsapp_connected: true, whatsapp_instance_name: 'stored' },
        { connected: true, status: 'open' },
      ),
    ).toEqual({ state: 'connected', instanceName: 'stored' })
    expect(
      resolveWhatsAppInitialState(
        { whatsapp_connected: false },
        { connected: true, instanceName: 'live' },
      ),
    ).toEqual({ state: 'connected', instanceName: 'live' })
  })

  test('live disconnected or closed status never trusts the business flag', () => {
    expect(
      resolveWhatsAppInitialState(
        { whatsapp_connected: true, whatsapp_instance_name: 'stored' },
        { connected: false, status: 'close' },
      ),
    ).toEqual({ state: 'idle', instanceName: 'stored' })
  })

  test('an existing closed instance remains idle so reconnect is available', () => {
    const initial = resolveWhatsAppInitialState(
      { whatsapp_connected: true, whatsapp_instance_name: 'existing' },
      { connected: false, status: 'close' },
    )
    expect(initial.state).toBe('idle')
    expect(initial.instanceName).toBe('existing')
  })

  test('status failure resolves to error instead of trusting the business row', () => {
    expect(
      resolveWhatsAppInitialState(
        { whatsapp_connected: true, whatsapp_instance_name: 'stored' },
        {},
        new Error('status unavailable'),
      ),
    ).toEqual({ state: 'error', instanceName: 'stored' })
  })

  test('business refresh metadata does not change a resolved live state', () => {
    const liveStatus = { connected: true, status: 'open' }
    expect(
      resolveWhatsAppInitialState(
        { whatsapp_connected: false, whatsapp_instance_name: 'before' },
        liveStatus,
      ).state,
    ).toBe('connected')
    expect(
      resolveWhatsAppInitialState(
        { whatsapp_connected: true, whatsapp_instance_name: 'after' },
        liveStatus,
      ).state,
    ).toBe('connected')
  })

  test('successful metadata refresh completes without changing confirmed state', async () => {
    const connection = { state: 'connected', status: 'open' }
    let refreshCalls = 0
    const refreshed = await refreshWhatsAppBusinessBestEffort(async () => {
      refreshCalls += 1
    })
    expect(refreshed).toBe(true)
    expect(refreshCalls).toBe(1)
    expect(connection).toEqual({ state: 'connected', status: 'open' })
  })

  test('rejected metadata refresh is contained after live confirmation', async () => {
    const connection = { state: 'connected', status: 'open' }
    const refreshed = await refreshWhatsAppBusinessBestEffort(async () => {
      throw new Error('business metadata unavailable')
    })
    expect(refreshed).toBe(false)
    expect(connection).toEqual({ state: 'connected', status: 'open' })
    expect(shouldPollWhatsApp(connection.state)).toBe(false)
  })
})
