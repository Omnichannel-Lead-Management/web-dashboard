import { describe, expect, test } from 'bun:test'
import {
  conversationId,
  mapConversation,
  mapHistoryMessage,
  mapLead,
  mapLeadActivity,
  mapAppointment,
  mapAvailability,
  selectAppointmentSlot,
  clearAppointmentSlot,
  isAvailabilityRequestCurrent,
  isAppointmentSubmissionReady,
  isAvailabilityFullyBooked,
  appointmentStatusActions,
  filterAppointmentsByStatus,
  splitAppointmentsByTime,
  toAppointmentPayload,
  parseConversationId,
  mapFaq,
  toFaqPayload,
} from './mappers.js'
import { gatewayWsUrl } from '../config.js'

describe('mappers unit', () => {
  test('mapFaq normalizes the chatbot-builder record format', () => {
    expect(
      mapFaq({
        id: 27,
        business_id: 'biz_1',
        question: 'When are you open?',
        answer: 'Monday to Saturday.',
        keywords: '["hours","opening times"]',
        enabled: 1,
        created_at: 1754042400,
        updated_at: 1754046000000,
      }),
    ).toEqual({
      id: 27,
      businessId: 'biz_1',
      question: 'When are you open?',
      answer: 'Monday to Saturday.',
      keywords: ['hours', 'opening times'],
      enabled: true,
      createdAt: 1754042400000,
      updatedAt: 1754046000000,
    })
  })

  test('mapFaq accepts arrays and comma-separated keyword fallbacks', () => {
    expect(mapFaq({ keywords: ['hours', ' booking '] }).keywords).toEqual([
      'hours',
      'booking',
    ])
    expect(mapFaq({ keywords: 'hours, booking' }).keywords).toEqual([
      'hours',
      'booking',
    ])
    expect(mapFaq({ keywords: '{bad json' }).keywords).toEqual(['{bad json'])
  })

  test('mapFaq coerces chatbot-builder boolean representations', () => {
    expect(mapFaq({ enabled: 0 }).enabled).toBe(false)
    expect(mapFaq({ enabled: 1 }).enabled).toBe(true)
    expect(mapFaq({ enabled: 'false' }).enabled).toBe(false)
    expect(mapFaq({ enabled: 'true' }).enabled).toBe(true)
  })

  test('toFaqPayload trims values and removes duplicate or blank keywords', () => {
    expect(
      toFaqPayload({
        question: '  Where are you? ',
        answer: ' Colombo.  ',
        keywords: [' location ', '', 'location'],
        enabled: true,
      }),
    ).toEqual({
      question: 'Where are you?',
      answer: 'Colombo.',
      keywords: ['location'],
      enabled: true,
    })
  })

  test('conversationId and parseConversationId round-trip', () => {
    const id = conversationId('telegram', '12345')
    expect(id).toBe('telegram:12345')
    expect(parseConversationId(id)).toEqual({
      platform: 'telegram',
      messenger_id: '12345',
    })
  })

  test('mapConversation marks escalated queued chats unread', () => {
    const mapped = mapConversation({
      platform: 'telegram',
      messenger_id: '99',
      display_name: 'Kasun Perera',
      is_escalated: true,
      escalation_status: 'queued',
      claimed_by_agent_id: null,
      last_message: {
        text: 'Need help',
        is_from_user: true,
        created_at: '2026-07-25T10:00:00Z',
      },
      updated_at: '2026-07-25T10:00:00Z',
    })
    expect(mapped.id).toBe('telegram:99')
    expect(mapped.channel).toBe('Telegram')
    expect(mapped.initials).toBe('KP')
    expect(mapped.escalated).toBe(true)
    expect(mapped.claimed).toBe(false)
    expect(mapped.unread).toBe(true)
    expect(mapped.preview).toBe('Need help')
  })

  test('mapHistoryMessage maps sender roles', () => {
    expect(
      mapHistoryMessage({
        id: 1,
        from: 'user',
        text: 'hi',
        timestamp: '2026-07-25T10:00:00Z',
      }).sender,
    ).toBe('customer')
    expect(
      mapHistoryMessage({
        id: 2,
        from: 'agent',
        text: 'hello',
        timestamp: '2026-07-25T10:00:00Z',
      }).sender,
    ).toBe('agent')
    expect(
      mapHistoryMessage({
        id: 3,
        from: 'ai',
        text: 'bot',
        timestamp: '2026-07-25T10:00:00Z',
      }).sender,
    ).toBe('bot')
  })
})

describe('config unit', () => {
  test('gatewayWsUrl switches protocol and path', () => {
    expect(gatewayWsUrl('/ws/agents', 'http://example.com:3000')).toBe(
      'ws://example.com:3000/ws/agents',
    )
    expect(gatewayWsUrl('/ws/agents', 'https://cache.us.kg')).toBe(
      'wss://cache.us.kg/ws/agents',
    )
  })
})

describe('mapLead unit', () => {
  const row = {
    id: 'lead_abc',
    business_id: 'biz_1',
    messenger_id: '9876',
    platform: 'telegram',
    status: 'qualified',
    score: 65,
    source: 'chatbot',
    assigned_agent_id: 'agent_2',
    service_interest: 'premium package',
    notes: 'Wants a Saturday slot',
    tags: ['vip'],
    created_at: Date.now() - 3 * 3600 * 1000,
  }

  test('maps lead-manager fields onto the table shape', () => {
    const lead = mapLead(row)
    expect(lead.id).toBe('lead_abc')
    expect(lead.channel).toBe('Telegram')
    expect(lead.score).toBe(65)
    expect(lead.interest).toBe('premium package')
    expect(lead.agent).toBe('agent_2')
    expect(lead.age).toBe('3h')
  })

  test('unassigned and missing interest read as placeholders, not blanks', () => {
    const lead = mapLead({
      ...row,
      assigned_agent_id: null,
      service_interest: null,
    })
    expect(lead.agent).toBe('Unassigned')
    expect(lead.interest).toBe('Not specified')
  })

  test('contact details are never invented — lead-manager does not store them', () => {
    const lead = mapLead(row)
    expect(lead.email).toBe('Not provided')
    expect(lead.phone).toBe('Not provided')
  })

  test('mapLeadActivity keeps the audit description verbatim', () => {
    const activity = mapLeadActivity({
      id: 4,
      activity_type: 'status_changed',
      description: "Status changed from 'new' to 'contacted'",
      performed_by: 'agent_2',
      created_at: Date.now() - 90 * 1000,
    })
    expect(activity.type).toBe('status_changed')
    expect(activity.description).toBe(
      "Status changed from 'new' to 'contacted'",
    )
    expect(activity.by).toBe('agent_2')
    expect(activity.age).toBe('1m')
  })
})

describe('mapAppointment unit', () => {
  // Shape copied from a live GET /api/appointments response — the service
  // serialises camelCase, which an earlier snake_case-only mapper silently
  // rendered as "Unknown / Unscheduled".
  test('reads the service camelCase shape', () => {
    const mapped = mapAppointment({
      id: '851f98c4-35fb-42ee-9683-49e0bc272a17',
      businessId: 'biz_1',
      customerName: 'Kalana',
      service: 'haircut',
      startTime: '2026-07-31T09:30:00.000Z',
      endTime: '2026-07-31T10:00:00.000Z',
      status: 'pending',
    })
    expect(mapped.customer).toBe('Kalana')
    expect(mapped.service).toBe('haircut')
    expect(mapped.duration).toBe('30 min')
    expect(mapped.day).not.toBe('Unscheduled')
    expect(mapped.startTime).toBe('2026-07-31T09:30:00.000Z')
    expect(mapped.endTime).toBe('2026-07-31T10:00:00.000Z')
  })

  test('splits an ISO slot into day, 12-hour time and duration', () => {
    const mapped = mapAppointment({
      id: 'appt_1',
      customer_name: 'Kasun Perera',
      service: 'Premium package',
      start_time: '2026-08-04T14:00:00.000Z',
      end_time: '2026-08-04T15:00:00.000Z',
      status: 'confirmed',
    })
    expect(mapped.customer).toBe('Kasun Perera')
    expect(mapped.ampm).toMatch(/AM|PM/)
    expect(mapped.duration).toBe('1 hr')
    expect(mapped.status).toBe('confirmed')
  })

  test('a bad start_time degrades instead of throwing', () => {
    const mapped = mapAppointment({
      id: 'x',
      start_time: 'nope',
      end_time: 'nope',
    })
    expect(mapped.day).toBe('Unscheduled')
    expect(mapped.duration).toBe('—')
  })
})

describe('appointment presentation helpers', () => {
  test('returns only valid actions for each appointment status', () => {
    expect(appointmentStatusActions('pending')).toEqual([
      'confirmed',
      'cancelled',
    ])
    expect(appointmentStatusActions('confirmed')).toEqual([
      'completed',
      'cancelled',
    ])
    expect(appointmentStatusActions('completed')).toEqual([])
    expect(appointmentStatusActions('cancelled')).toEqual([])
  })

  test('filters without mutating the source appointments', () => {
    const appointments = [
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'confirmed' },
    ]
    expect(filterAppointmentsByStatus(appointments, 'pending')).toEqual([
      appointments[0],
    ])
    expect(filterAppointmentsByStatus(appointments, 'all')).not.toBe(
      appointments,
    )
    expect(appointments).toHaveLength(2)
  })

  test('splits by end time and sorts upcoming earliest and past newest', () => {
    const now = new Date('2026-08-02T12:00:00.000Z').getTime()
    const appointments = [
      { id: 'future-later', endTime: '2026-08-04T12:00:00.000Z' },
      { id: 'past-older', endTime: '2026-07-30T12:00:00.000Z' },
      { id: 'future-sooner', endTime: '2026-08-03T12:00:00.000Z' },
      { id: 'past-newer', endTime: '2026-08-01T12:00:00.000Z' },
      { id: 'invalid', endTime: 'not-a-date' },
    ]

    const result = splitAppointmentsByTime(appointments, now)
    expect(result.upcoming.map((item) => item.id)).toEqual([
      'future-sooner',
      'future-later',
      'invalid',
    ])
    expect(result.past.map((item) => item.id)).toEqual([
      'past-newer',
      'past-older',
    ])
    expect(appointments[0].id).toBe('future-later')
  })
})

describe('toAppointmentPayload unit', () => {
  test('preserves the exact backend-selected slot times', () => {
    const payload = toAppointmentPayload(
      {
        customer: 'Customer',
        service: 'Service',
        date: '2026-08-05',
        startTime: '2026-08-05T09:00:00.000Z',
        endTime: '2026-08-05T09:30:00.000Z',
        notes: 'Prepare room 2',
      },
      'biz_1',
    )
    expect(payload.startTime).toBe('2026-08-05T09:00:00.000Z')
    expect(payload.endTime).toBe('2026-08-05T09:30:00.000Z')
  })

  test('converts the form 12-hour time and duration into an ISO range', () => {
    const payload = toAppointmentPayload(
      {
        customer: 'Kasun Perera',
        service: 'Premium package',
        date: '2026-08-04',
        time: '2:30',
        ampm: 'PM',
        duration: '90 min',
        notes: 'Regular',
      },
      'biz_1',
    )

    expect(payload.businessId).toBe('biz_1')
    expect(payload.customerName).toBe('Kasun Perera')

    const start = new Date(payload.startTime)
    const end = new Date(payload.endTime)
    expect(start.getHours()).toBe(14)
    expect(start.getMinutes()).toBe(30)
    expect((end - start) / 60000).toBe(90)
  })

  test('12 AM is midnight, not noon', () => {
    const payload = toAppointmentPayload(
      {
        customer: 'X',
        service: 'S',
        date: '2026-08-04',
        time: '12:00',
        ampm: 'AM',
        duration: '60 min',
      },
      'biz_1',
    )
    expect(new Date(payload.startTime).getHours()).toBe(0)
  })

  test('12 PM stays noon', () => {
    const payload = toAppointmentPayload(
      {
        customer: 'X',
        service: 'S',
        date: '2026-08-04',
        time: '12:00',
        ampm: 'PM',
        duration: '60 min',
      },
      'biz_1',
    )
    expect(new Date(payload.startTime).getHours()).toBe(12)
  })
})

describe('availability mapper and form helpers', () => {
  test('normalizes valid slots without mutating the response', () => {
    const response = {
      success: true,
      data: {
        businessId: 'biz_x',
        date: '2026-08-05',
        slots: [
          {
            startTime: '2026-08-05T09:00:00.000Z',
            endTime: '2026-08-05T09:30:00.000Z',
          },
        ],
      },
    }
    const snapshot = structuredClone(response)
    const mapped = mapAvailability(response)

    expect(mapped.businessId).toBe('biz_x')
    expect(mapped.date).toBe('2026-08-05')
    expect(mapped.slots[0].startTime).toBe('2026-08-05T09:00:00.000Z')
    expect(mapped.slots[0].endTime).toBe('2026-08-05T09:30:00.000Z')
    expect(mapped.slots[0].label).toBeTruthy()
    expect(response).toEqual(snapshot)
  })

  test('handles empty, missing, and malformed availability data', () => {
    expect(
      mapAvailability({
        success: true,
        data: { businessId: 'biz_x', date: '2026-08-05', slots: [] },
      }).slots,
    ).toEqual([])
    expect(mapAvailability({ success: true })).toEqual({
      businessId: '',
      date: '',
      slots: [],
    })
    expect(mapAvailability(null)).toEqual({
      businessId: '',
      date: '',
      slots: [],
    })
  })

  test('ignores slots with invalid or missing timestamps', () => {
    const mapped = mapAvailability({
      data: {
        slots: [
          { startTime: 'bad', endTime: '2026-08-05T09:30:00.000Z' },
          { startTime: '2026-08-05T10:00:00.000Z' },
          {
            startTime: '2026-08-05T11:00:00.000Z',
            endTime: '2026-08-05T11:30:00.000Z',
          },
        ],
      },
    })
    expect(mapped.slots).toHaveLength(1)
    expect(mapped.slots[0].startTime).toBe('2026-08-05T11:00:00.000Z')
  })

  test('slot selection assigns exact times and date clearing removes them', () => {
    const form = { customer: 'Customer', date: '2026-08-05' }
    const selected = selectAppointmentSlot(form, {
      startTime: '2026-08-05T09:00:00.000Z',
      endTime: '2026-08-05T09:30:00.000Z',
    })
    expect(selected.startTime).toBe('2026-08-05T09:00:00.000Z')
    expect(selected.endTime).toBe('2026-08-05T09:30:00.000Z')
    expect(clearAppointmentSlot(selected)).toEqual({
      customer: 'Customer',
      date: '2026-08-05',
      startTime: '',
      endTime: '',
    })
  })

  test('detects stale requests, fully booked dates, and submission readiness', () => {
    expect(
      isAvailabilityRequestCurrent({
        requestDate: '2026-08-06',
        selectedDate: '2026-08-06',
        requestId: 2,
        latestRequestId: 2,
      }),
    ).toBe(true)
    expect(
      isAvailabilityRequestCurrent({
        requestDate: '2026-08-05',
        selectedDate: '2026-08-06',
        requestId: 1,
        latestRequestId: 2,
      }),
    ).toBe(false)
    expect(
      isAvailabilityFullyBooked({
        date: '2026-08-05',
        slots: [],
      }),
    ).toBe(true)
    expect(
      isAppointmentSubmissionReady({
        customer: 'Customer',
        service: 'Service',
        date: '2026-08-05',
        startTime: '',
        endTime: '',
      }),
    ).toBe(false)
    expect(
      isAppointmentSubmissionReady({
        customer: 'Customer',
        service: 'Service',
        date: '2026-08-05',
        startTime: '2026-08-05T09:00:00.000Z',
        endTime: '2026-08-05T09:30:00.000Z',
      }),
    ).toBe(true)
  })
})

describe('mapHistoryMessage media kind', () => {
  test('a voice note is badged from the stored metadata', () => {
    const m = mapHistoryMessage({
      id: 1,
      from: 'user',
      text: 'Do you have Saturday slots for colouring?',
      metadata: '{"chat_type":"private","type":"voice"}',
      timestamp: Date.now(),
    })
    expect(m.kind).toBe('voice')
    expect(m.text).toBe('Do you have Saturday slots for colouring?')
  })

  test('WhatsApp image/audio types map to the same two badges', () => {
    expect(
      mapHistoryMessage({ from: 'user', metadata: { type: 'image' } }).kind,
    ).toBe('photo')
    expect(
      mapHistoryMessage({ from: 'user', metadata: { type: 'audio' } }).kind,
    ).toBe('voice')
  })

  test('typed messages carry no badge', () => {
    expect(
      mapHistoryMessage({ from: 'user', metadata: '{"type":"text"}' }).kind,
    ).toBeNull()
    expect(mapHistoryMessage({ from: 'user' }).kind).toBeNull()
  })

  test('malformed metadata does not throw', () => {
    expect(
      mapHistoryMessage({ from: 'user', metadata: 'not json' }).kind,
    ).toBeNull()
  })
})
