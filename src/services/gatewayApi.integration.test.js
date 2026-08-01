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

  test('FAQ methods use the chatbot-builder paths and documented payloads', async () => {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options })
      const method = options.method || 'GET'
      if (method === 'DELETE') return new Response(null, { status: 204 })
      return new Response(
        JSON.stringify({
          success: true,
          faqs: [],
          faq: {
            id: 'faq/1',
            question: 'Hours?',
            answer: 'Nine to five.',
            keywords: ['hours'],
            enabled: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 2}`)
    await gatewayApi.listFaqs('biz/a')
    await gatewayApi.createFaq('biz/a', {
      question: 'Hours?',
      answer: 'Nine to five.',
      keywords: ['hours'],
      enabled: true,
    })
    await gatewayApi.replaceFaqs('biz/a', [
      {
        question: 'Location?',
        answer: 'Colombo.',
        keywords: ['location'],
        enabled: true,
      },
    ])
    await gatewayApi.updateFaq('faq/1', {
      question: 'Hours?',
      answer: 'Nine to five.',
      keywords: ['hours'],
      enabled: false,
    })
    await gatewayApi.deleteFaq('faq/1')

    expect(calls.map((call) => call.options.method || 'GET')).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
    ])
    expect(calls[0].url).toContain('/api/businesses/biz%2Fa/faqs')
    expect(calls[2].url).toContain('/api/businesses/biz%2Fa/faqs')
    expect(calls[3].url).toContain('/api/faqs/faq%2F1')
    expect(calls[4].url).toContain('/api/faqs/faq%2F1')
    expect(JSON.parse(calls[1].options.body)).toEqual({
      question: 'Hours?',
      answer: 'Nine to five.',
      keywords: ['hours'],
      enabled: true,
    })
    expect(JSON.parse(calls[2].options.body).items).toHaveLength(1)
    expect(JSON.parse(calls[3].options.body).enabled).toBe(false)
  })

  test('FAQ mutation errors are surfaced instead of returning mock success', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'FAQ endpoint unavailable' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })

    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 3}`)
    await expect(
      gatewayApi.createFaq('biz_1', {
        question: 'Question',
        answer: 'Answer',
        keywords: [],
        enabled: true,
      }),
    ).rejects.toThrow('FAQ endpoint unavailable')
  })
})
