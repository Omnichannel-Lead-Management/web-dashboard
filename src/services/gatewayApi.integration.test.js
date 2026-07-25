import { describe, expect, test } from 'bun:test'

/**
 * Integration-style contract checks for the dashboard ↔ gateway API helpers.
 * These do not require a live server; they verify request shaping/error handling
 * against a local mock fetch.
 */
describe('gatewayApi integration (mock fetch)', () => {
  test('listConversations hits the business conversations endpoint', async () => {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options })
      return new Response(
        JSON.stringify({
          success: true,
          conversations: [
            {
              messenger_id: '1',
              platform: 'telegram',
              display_name: 'Ada',
              is_escalated: false,
              escalation_status: 'none',
              claimed_by_agent_id: null,
              last_message: null,
              updated_at: null,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Re-import after stubbing fetch so module sees the stub.
    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now()}`)
    const result = await gatewayApi.listConversations('biz_test')
    expect(result.success).toBe(true)
    expect(result.conversations).toHaveLength(1)
    expect(calls[0].url).toContain('/api/businesses/biz_test/conversations')
  })

  test('createBusiness surfaces API errors', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false, error: 'name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })

    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 1}`)
    await expect(
      gatewayApi.createBusiness({ name: '', sector: 'Salon' }),
    ).rejects.toThrow(/name required|Request failed/i)
  })
})
