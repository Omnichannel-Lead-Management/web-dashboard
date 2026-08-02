import { describe, expect, test } from 'bun:test'

/**
 * Integration-style contract checks for the dashboard ↔ gateway API helpers.
 * These do not require a live server; they verify request shaping/error handling
 * against a local mock fetch.
 */
describe('gatewayApi integration (mock fetch)', () => {
  test('Telegram connect uses encoded gateway URL and body-only token', async () => {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options })
      return Response.json({ success: true, ok: true, bot_username: 'test_bot' })
    }
    const { gatewayApi } = await import(`./gatewayApi.js?t=tg-${Date.now()}`)
    const token = '123456:sample-token'
    await gatewayApi.connectTelegram('biz/a & b', token)

    expect(new URL(calls[0].url).pathname).toBe(
      '/api/businesses/biz%2Fa%20%26%20b/channels/telegram',
    )
    expect(calls[0].options.method).toBe('POST')
    expect(JSON.parse(calls[0].options.body)).toEqual({ bot_token: token })
    expect(calls[0].url.includes(token)).toBe(false)
    expect(Object.keys(JSON.parse(calls[0].options.body))).toEqual(['bot_token'])
  })

  test('Telegram errors preserve backend message, status and body', async () => {
    const body = { success: false, error: 'Invalid Telegram bot token' }
    globalThis.fetch = async () => Response.json(body, { status: 400 })
    const { gatewayApi } = await import(`./gatewayApi.js?t=tg-error-${Date.now()}`)
    try {
      await gatewayApi.connectTelegram('biz_1', 'invalid-token')
      throw new Error('Expected Telegram connection to fail')
    } catch (error) {
      expect(error.message).toBe('Invalid Telegram bot token')
      expect(error.status).toBe(400)
      expect(error.body).toEqual(body)
    }
  })

  test('WhatsApp methods use encoded gateway URLs and the correct methods', async () => {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options })
      return Response.json({ success: true })
    }

    const { gatewayApi } = await import(`./gatewayApi.js?t=wa-${Date.now()}`)
    await gatewayApi.connectWhatsApp('biz/a & b')
    await gatewayApi.getWhatsAppQr('biz/a & b')
    await gatewayApi.getWhatsAppStatus('biz/a & b')

    expect(calls.map((call) => call.options.method || 'GET')).toEqual([
      'POST',
      'GET',
      'GET',
    ])
    expect(calls[0].url).toContain(
      '/api/businesses/biz%2Fa%20%26%20b/channels/whatsapp-evolution',
    )
    expect(calls[1].url).toContain(
      '/api/businesses/biz%2Fa%20%26%20b/channels/whatsapp-evolution/qrcode',
    )
    expect(calls[2].url).toContain(
      '/api/businesses/biz%2Fa%20%26%20b/channels/whatsapp-evolution/status',
    )
    expect(calls.every((call) => call.options.body === undefined)).toBe(true)
  })

  test('WhatsApp errors preserve backend message, status and body', async () => {
    const responseBody = { success: false, error: 'Evolution unavailable' }
    globalThis.fetch = async () => Response.json(responseBody, { status: 502 })
    const { gatewayApi } = await import(
      `./gatewayApi.js?t=wa-error-${Date.now()}`
    )

    try {
      await gatewayApi.connectWhatsApp('biz_1')
      throw new Error('Expected WhatsApp connection to fail')
    } catch (error) {
      expect(error.message).toBe('Evolution unavailable')
      expect(error.status).toBe(502)
      expect(error.body).toEqual(responseBody)
    }
  })

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
    expect(JSON.parse(calls[2].options.body)).toEqual({
      items: [
        {
          question: 'Location?',
          answer: 'Colombo.',
          keywords: ['location'],
          enabled: true,
        },
      ],
    })
    expect(JSON.parse(calls[3].options.body).enabled).toBe(false)
    expect(calls[4].options.body).toBeUndefined()
  })

  test('FAQ mutation errors are surfaced instead of returning mock success', async () => {
    const responseBody = {
      success: false,
      message: 'FAQ endpoint unavailable',
    }
    globalThis.fetch = async () =>
      new Response(JSON.stringify(responseBody), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })

    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 3}`)
    try {
      await gatewayApi.createFaq('biz_1', {
        question: 'Question',
        answer: 'Answer',
        keywords: [],
        enabled: true,
      })
      throw new Error('Expected FAQ creation to fail')
    } catch (error) {
      expect(error.message).toBe('FAQ endpoint unavailable')
      expect(error.status).toBe(503)
      expect(error.body).toEqual(responseBody)
    }
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
    globalThis.fetch = async () => Response.json(conflictBody, { status: 409 })

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

  test('lead update and assignment forward audited payloads', async () => {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options })
      return Response.json({ success: true, lead: { id: 'lead/1' } })
    }

    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 6}`)
    await gatewayApi.listLeads('biz_1', { status: 'qualified' })
    await gatewayApi.updateLead('lead/1', 'biz_1', {
      notes: 'Follow up tomorrow',
      performed_by: 'agent_2',
    })
    await gatewayApi.assignLead('lead/1', 'biz_1', {
      agent_id: 'agent_1',
      performed_by: 'agent_2',
    })
    await gatewayApi.assignLead('lead/1', 'biz_1', {
      performed_by: 'agent_2',
    })

    expect(new URL(calls[0].url).searchParams.get('businessId')).toBe('biz_1')
    expect(new URL(calls[0].url).searchParams.get('status')).toBe('qualified')
    expect(new URL(calls[1].url).pathname).toBe('/api/leads/lead%2F1')
    expect(calls[1].options.method).toBe('PATCH')
    expect(JSON.parse(calls[1].options.body)).toEqual({
      business_id: 'biz_1',
      notes: 'Follow up tomorrow',
      performed_by: 'agent_2',
    })
    expect(new URL(calls[2].url).pathname).toBe('/api/leads/lead%2F1/assign')
    expect(calls[2].options.method).toBe('POST')
    expect(JSON.parse(calls[2].options.body)).toEqual({
      business_id: 'biz_1',
      agent_id: 'agent_1',
      performed_by: 'agent_2',
    })
    expect(JSON.parse(calls[3].options.body)).toEqual({
      business_id: 'biz_1',
      performed_by: 'agent_2',
    })
  })

  test('lead mutation errors preserve backend message and status', async () => {
    globalThis.fetch = async () =>
      Response.json(
        { success: false, message: 'Invalid lead transition' },
        { status: 400 },
      )
    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 7}`)

    try {
      await gatewayApi.updateLead('lead_1', 'biz_1', {
        status: 'new',
        performed_by: 'agent_1',
      })
      throw new Error('Expected lead update to fail')
    } catch (error) {
      expect(error.message).toBe('Invalid lead transition')
      expect(error.status).toBe(400)
    }
  })

  test('chatbot config methods use encoded gateway paths and partial bodies', async () => {
    const calls = []
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options })
      return Response.json({
        success: true,
        config: { business_id: 'biz/a', chatbot_enabled: false },
      })
    }
    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 8}`)

    await gatewayApi.getChatbotConfig('biz/a')
    await gatewayApi.updateChatbotConfig('biz/a', {
      chatbot_enabled: false,
    })
    await gatewayApi.updateChatbotConfig('biz/a', {
      welcome_message: 'Hello',
      escalation_message: 'Please wait',
    })

    expect(new URL(calls[0].url).pathname).toBe(
      '/api/businesses/biz%2Fa/config',
    )
    expect(calls[0].options.method || 'GET').toBe('GET')
    expect(calls[0].options.body).toBeUndefined()
    expect(calls[1].options.method).toBe('PATCH')
    expect(JSON.parse(calls[1].options.body)).toEqual({
      chatbot_enabled: false,
    })
    expect(JSON.parse(calls[2].options.body)).toEqual({
      welcome_message: 'Hello',
      escalation_message: 'Please wait',
    })
  })

  test('chatbot config errors preserve message, status and body', async () => {
    const responseBody = { success: false, message: 'Config proxy unavailable' }
    globalThis.fetch = async () => Response.json(responseBody, { status: 503 })
    const { gatewayApi } = await import(`./gatewayApi.js?t=${Date.now() + 9}`)

    try {
      await gatewayApi.getChatbotConfig('biz_1')
      throw new Error('Expected config request to fail')
    } catch (error) {
      expect(error.message).toBe('Config proxy unavailable')
      expect(error.status).toBe(503)
      expect(error.body).toEqual(responseBody)
    }
  })
})
