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

  test('getAvailability sends an encoded GET request without a body', async () => {
    const calls = []
    const backendResponse = {
      success: true,
      data: {
        businessId: 'biz/a & b',
        date: '2026-08-05',
        slots: [],
      },
    }
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options })
      return Response.json(backendResponse)
    }

    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 4}`)
    const result = await gatewayApi.getAvailability({
      businessId: 'biz/a & b',
      date: '2026-08-05',
    })

    const requestUrl = new URL(calls[0].url)
    expect(requestUrl.pathname).toBe('/api/appointments/availability')
    expect(requestUrl.searchParams.get('businessId')).toBe('biz/a & b')
    expect(requestUrl.searchParams.get('date')).toBe('2026-08-05')
    expect(calls[0].url).toContain('businessId=biz%2Fa+%26+b')
    expect(calls[0].options.method || 'GET').toBe('GET')
    expect(calls[0].options.body).toBeUndefined()
    expect(result).toEqual(backendResponse)
  })

  test('appointment conflicts retain their HTTP 409 status', async () => {
    const conflictBody = {
      success: false,
      message: 'The requested appointment time is not available.',
    }
    globalThis.fetch = async () =>
      Response.json(conflictBody, { status: 409 })

    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 5}`)
    try {
      await gatewayApi.createAppointment({})
      throw new Error('Expected appointment creation to fail')
    } catch (error) {
      expect(error.status).toBe(409)
      expect(error.message).toBe(
        'The requested appointment time is not available.',
      )
      expect(error.body).toEqual(conflictBody)
    }
  })
})
