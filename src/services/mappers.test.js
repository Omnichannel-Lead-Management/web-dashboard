import { describe, expect, test } from 'bun:test'
import {
  conversationId,
  mapConversation,
  mapHistoryMessage,
  mapLead,
  mapLeadActivity,
  filterVisibleLeads,
  retainVisibleLeadSelection,
  summarizeBulkLeadResults,
  isLeadListRequestCurrent,
  buildLeadStatusPatch,
  hasConversionValueChanged,
  leadStatusDrafts,
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
  faqEditorDraft,
  faqPayloadWithPendingKeyword,
  mapChatbotConfig,
  toChatbotConfigPatch,
  mapWhatsAppConnection,
  mapWhatsAppQr,
  mapWhatsAppStatus,
  mapBusinessProfile,
  toBusinessProfilePatch,
  mapTelegramConnection,
  mapConversationTemplate,
  mapConversationFlow,
  mapFlowSteps,
} from './mappers.js'
import { gatewayWsUrl } from '../config.js'

describe('business profile mappers', () => {
  test('normalizes known sector casing and preserves unknown values', () => {
    const lower = { id: 'biz_1', sector: 'salon', name: 'Salon' }
    const unknown = { id: 'biz_2', sector: ' Food Service ', name: 'Cafe' }
    const lowerCopy = structuredClone(lower)
    const unknownCopy = structuredClone(unknown)
    expect(mapBusinessProfile(lower).sector).toBe('Salon')
    expect(mapBusinessProfile({ sector: 'PHOTOGRAPHY' }).sector).toBe(
      'Photography',
    )
    expect(mapBusinessProfile(unknown).sector).toBe('Food Service')
    expect(mapBusinessProfile({ sector: '' }).sector).toBe('')
    expect(mapBusinessProfile({ sector: null }).sector).toBe('')
    expect(lower).toEqual(lowerCopy)
    expect(unknown).toEqual(unknownCopy)
  })
  test('maps current and future fields without mutating source', () => {
    const source = {
      id: ' biz_1 ',
      name: ' Loop Salon ',
      sector: ' Salon ',
      owner_email: ' owner@example.com ',
      timezone: ' Asia/Colombo ',
      contact_phone: ' +94 77 123 4567 ',
      address: ' 1 Main Street ',
      business_hours: {
        monday: { enabled: true, open: ' 09:00 ', close: '17:00' },
        tuesday: { enabled: false, open: null, close: null },
      },
      updated_at: 123,
    }
    const snapshot = structuredClone(source)
    const mapped = mapBusinessProfile(source)

    expect(mapped).toMatchObject({
      id: 'biz_1',
      name: 'Loop Salon',
      sector: 'Salon',
      ownerEmail: 'owner@example.com',
      timezone: 'Asia/Colombo',
      contactPhone: '+94 77 123 4567',
      address: '1 Main Street',
      updatedAt: 123,
    })
    expect(mapped.businessHours.monday).toEqual({
      enabled: true,
      open: '09:00',
      close: '17:00',
    })
    expect(mapped.businessHours.tuesday.enabled).toBe(false)
    expect(source).toEqual(snapshot)
  })

  test('normalizes missing and malformed optional fields and preserves false', () => {
    const mapped = mapBusinessProfile({
      id: 'biz_1',
      ownerEmail: null,
      businessHours: { monday: 'bad', tuesday: { enabled: false } },
    })
    expect(mapped.ownerEmail).toBe('')
    expect(mapped.timezone).toBe('')
    expect(mapped.businessHours.monday).toEqual({
      enabled: false,
      open: '',
      close: '',
    })
    expect(mapped.businessHours.tuesday.enabled).toBe(false)
    expect(Object.keys(mapped.businessHours)).toHaveLength(7)
  })

  test('creates a trimmed minimal patch, supports clearing, and excludes unchanged fields', () => {
    const original = mapBusinessProfile({
      id: 'biz_1',
      name: 'Old',
      sector: 'Salon',
      owner_email: 'owner@example.com',
      address: 'Old address',
    })
    const draft = structuredClone(original)
    draft.name = '  New name  '
    draft.address = '   '
    draft.businessHours.monday = {
      enabled: true,
      open: '09:00',
      close: '17:00',
    }

    expect(toBusinessProfilePatch(original, draft)).toEqual({
      name: 'New name',
      address: '',
      business_hours: {
        monday: { enabled: true, open: '09:00', close: '17:00' },
        tuesday: { enabled: false },
        wednesday: { enabled: false },
        thursday: { enabled: false },
        friday: { enabled: false },
        saturday: { enabled: false },
        sunday: { enabled: false },
      },
    })
    expect(toBusinessProfilePatch(original, structuredClone(original))).toEqual(
      {},
    )
  })
})

const salonFlow = {
  start: 'n1',
  nodes: [
    { id: 'n1', type: 'message', content: 'Welcome', next: 'n3' },
    { id: 'n3', type: 'question', content: 'Which package?', next: 'n9' },
    {
      id: 'n9',
      type: 'trigger_service',
      service: 'appointment',
      message: 'Book?',
    },
  ],
}
const tutorFlow = {
  start: 't1',
  nodes: [
    { id: 't1', type: 'message', content: 'Courses', next: 't3' },
    { id: 't3', type: 'question', content: 'Which subject?', next: 't9' },
    {
      id: 't9',
      type: 'trigger_service',
      service: 'appointment',
      message: 'Trial?',
    },
  ],
}
const photographyFlow = {
  start: 'p1',
  nodes: [
    { id: 'p1', type: 'message', content: 'Packages', next: 'p3' },
    { id: 'p3', type: 'question', content: 'Which shoot?', next: 'p9' },
    {
      id: 'p9',
      type: 'trigger_service',
      service: 'appointment',
      message: 'Availability?',
    },
  ],
}

describe('mappers unit', () => {
  test('maps templates and flows without mutating source', () => {
    const template = {
      id: 'tmpl_1',
      name: ' Salon ',
      sector: 'salon',
      trigger_intents: ['pricing'],
    }
    const flow = {
      id: 'flow_1',
      business_id: 'biz_1',
      name: 'Flow',
      sector: 'salon',
      is_active: false,
      is_template: 0,
      flow: salonFlow,
      created_by: 'agent_1',
      created_at: 1_754_042_400,
      updated_at: '2026-08-03T10:00:00.000Z',
    }
    const snapshot = structuredClone(flow)
    expect(
      mapConversationTemplate(template, { flow: salonFlow }),
    ).toMatchObject({
      id: 'tmpl_1',
      name: 'Salon',
      sector: 'salon',
      triggerIntents: ['pricing'],
    })
    expect(mapConversationFlow(flow)).toMatchObject({
      id: 'flow_1',
      businessId: 'biz_1',
      isActive: false,
      isTemplate: false,
      createdAt: 1_754_042_400_000,
      updatedAt: Date.parse('2026-08-03T10:00:00.000Z'),
    })
    expect(flow).toEqual(snapshot)
  })

  test('flow mapper handles boolean-like values and JSON forms', () => {
    expect(
      mapConversationFlow({
        is_active: 'false',
        flow_json: JSON.stringify(salonFlow),
      }),
    ).toMatchObject({
      isActive: false,
      flowJson: salonFlow,
      flowError: '',
    })
    expect(
      mapConversationFlow({ is_active: '1', flow: tutorFlow }).isActive,
    ).toBe(true)
    expect(mapConversationFlow({ flow_json: '{bad' })).toMatchObject({
      flowJson: null,
      flowError: 'This flow has malformed step data.',
    })
  })

  test('extracts salon, tutor and photography steps from their verified starts', () => {
    expect(mapFlowSteps(salonFlow)[0]).toMatchObject({
      id: 'n1',
      order: 1,
      type: 'message',
    })
    expect(
      mapFlowSteps(tutorFlow).some(
        (step) => step.id === 't3' && step.type === 'question',
      ),
    ).toBe(true)
    expect(
      mapFlowSteps(photographyFlow).some(
        (step) => step.id === 'p9' && step.type === 'trigger_service',
      ),
    ).toBe(true)
  })

  test('step extraction labels branches, prevents loops and handles missing nodes', () => {
    const branched = {
      start: 'q',
      nodes: [
        { id: 'q', type: 'question', content: 'Choose', next: 'b' },
        {
          id: 'b',
          type: 'branch',
          conditions: [
            { keyword: 'yes', next: 'yes' },
            { default: true, next: 'missing' },
          ],
        },
        { id: 'yes', type: 'message', content: 'Yes', next: 'q' },
      ],
    }
    const steps = mapFlowSteps(branched, 10)
    expect(steps.find((step) => step.id === 'yes').branchLabel).toContain('yes')
    expect(steps.find((step) => step.id === 'missing').type).toBe('missing')
    expect(steps.filter((step) => step.id === 'q')).toHaveLength(1)
    expect(() => mapFlowSteps(null)).toThrow('malformed step data')
  })

  test('maps verified Telegram success without exposing the token', () => {
    const source = {
      success: true,
      ok: true,
      bot_username: '  sample_bot  ',
      bot_token: 'must-not-leak',
    }
    const snapshot = structuredClone(source)
    expect(mapTelegramConnection(source)).toEqual({
      connected: true,
      botUsername: 'sample_bot',
    })
    expect(mapTelegramConnection(source)).not.toHaveProperty('botToken')
    expect(mapTelegramConnection(source)).not.toHaveProperty('bot_token')
    expect(source).toEqual(snapshot)
  })

  test('maps nested Telegram response wrappers', () => {
    expect(
      mapTelegramConnection({
        success: true,
        data: { ok: true, bot_username: 'nested_bot' },
      }),
    ).toEqual({ connected: true, botUsername: 'nested_bot' })
  })

  test('rejects malformed or unsuccessful Telegram responses', () => {
    expect(() => mapTelegramConnection({ success: true })).toThrow(
      'invalid Telegram connection response',
    )
    expect(() => mapTelegramConnection({ success: false, ok: true })).toThrow(
      'invalid Telegram connection response',
    )
    expect(() => mapTelegramConnection({ success: true, ok: 'true' })).toThrow(
      'invalid Telegram connection response',
    )
  })

  test('maps connected and disconnected WhatsApp responses safely', () => {
    expect(
      mapWhatsAppStatus({
        connected: 'true',
        status: 'open',
        instance_name: 'biz_1',
      }),
    ).toEqual({ connected: true, status: 'open', instanceName: 'biz_1' })
    expect(mapWhatsAppStatus({ connected: false, status: 'close' })).toEqual({
      connected: false,
      status: 'close',
      instanceName: '',
    })
    expect(mapWhatsAppStatus({ connected: '0' }).connected).toBe(false)
    expect(mapWhatsAppStatus({ connected: 1 }).connected).toBe(true)
  })

  test('maps the verified QR field and instance without mutating source', () => {
    const rawQr = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
    const source = {
      success: true,
      ok: true,
      instance_name: 'biz_1',
      qrcode: rawQr,
    }
    const snapshot = structuredClone(source)
    expect(mapWhatsAppConnection(source)).toEqual({
      connected: false,
      instanceName: 'biz_1',
      qrImage: `data:image/png;base64,${rawQr}`,
      expiresAt: null,
      status: '',
    })
    expect(
      mapWhatsAppQr({ data: { qrcode: `data:image/png;base64,${rawQr}` } }),
    ).toEqual({
      qrImage: `data:image/png;base64,${rawQr}`,
      expiresAt: null,
    })
    expect(source).toEqual(snapshot)
  })

  test('rejects malformed WhatsApp QR responses', () => {
    expect(() => mapWhatsAppQr({ qrcode: 'not a QR image' })).toThrow(
      'invalid WhatsApp QR code',
    )
    expect(() => mapWhatsAppQr({ success: true })).toThrow(
      'invalid WhatsApp QR code',
    )
    expect(() =>
      mapWhatsAppQr({ qrcode: 'data:image/png;base64,broken' }),
    ).toThrow('invalid WhatsApp QR code')
  })

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
    expect(mapFaq({ keywords: null }).keywords).toEqual([])
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
        keywords: [' location ', '', 'LOCATION', 'other'],
        enabled: true,
      }),
    ).toEqual({
      question: 'Where are you?',
      answer: 'Colombo.',
      keywords: ['location', 'other'],
      enabled: true,
    })
  })

  test('mapFaq supports ISO timestamps and does not mutate its source', () => {
    const source = {
      id: 'faq_1',
      keywords: [' hours '],
      created_at: '2026-08-03T10:00:00.000Z',
      updated_at: 1_754_046_000_000,
    }
    const snapshot = structuredClone(source)
    const mapped = mapFaq(source)
    expect(mapped.createdAt).toBe(Date.parse('2026-08-03T10:00:00.000Z'))
    expect(mapped.updatedAt).toBe(1_754_046_000_000)
    expect(source).toEqual(snapshot)
  })

  test('pending FAQ keywords participate in normalized change detection', () => {
    const original = {
      question: 'When are you open?',
      answer: 'Nine to five.',
      keywords: ['hours'],
      enabled: true,
    }
    const originalPayload = toFaqPayload(original)
    const withLocation = faqPayloadWithPendingKeyword(original, ' location ')
    expect(withLocation).toEqual({
      ...originalPayload,
      keywords: ['hours', 'location'],
    })
    expect(withLocation).not.toEqual(originalPayload)
    expect(faqPayloadWithPendingKeyword(original, 'HOURS')).toEqual(
      originalPayload,
    )
    expect(faqPayloadWithPendingKeyword(original, '   ')).toEqual(
      originalPayload,
    )
  })

  test('pending keyword normalization preserves chip removals and additions', () => {
    const originalKeywords = ['remove', 'keep']
    const edited = {
      question: 'Question',
      answer: 'Answer',
      keywords: ['keep'],
      enabled: true,
    }
    expect(faqPayloadWithPendingKeyword(edited, '  New  ')).toEqual({
      question: 'Question',
      answer: 'Answer',
      keywords: ['keep', 'New'],
      enabled: true,
    })
    expect(originalKeywords).toEqual(['remove', 'keep'])
    expect(
      faqPayloadWithPendingKeyword(
        { ...edited, keywords: ['keep', '', 'KEEP'] },
        'keep',
      ).keywords,
    ).toEqual(['keep'])
  })

  test('FAQ editor reset drafts clear pending keyword input', () => {
    const source = {
      question: 'Question',
      answer: 'Answer',
      keywords: ['hours'],
      enabled: false,
    }
    const draft = faqEditorDraft(source)
    expect(draft).toEqual({ ...source, keywordInput: '' })
    draft.keywords.push('changed')
    expect(source.keywords).toEqual(['hours'])
    expect(faqEditorDraft().keywordInput).toBe('')
  })

  test('maps chatbot config fields, false, null messages and epoch seconds', () => {
    const source = {
      success: true,
      config: {
        business_id: 'biz_1',
        chatbot_enabled: false,
        welcome_message: null,
        escalation_message: null,
        updated_at: 1_754_042_400,
      },
    }
    const snapshot = structuredClone(source)
    expect(mapChatbotConfig(source)).toEqual({
      businessId: 'biz_1',
      chatbotEnabled: false,
      welcomeMessage: '',
      escalationMessage: '',
      updatedAt: 1_754_042_400_000,
    })
    expect(source).toEqual(snapshot)
  })

  test('chatbot config supports boolean-like values and timestamp forms', () => {
    expect(
      mapChatbotConfig({ chatbot_enabled: 'false', updated_at: 0 }),
    ).toEqual({
      businessId: '',
      chatbotEnabled: false,
      welcomeMessage: '',
      escalationMessage: '',
      updatedAt: 0,
    })
    expect(
      mapChatbotConfig({ chatbot_enabled: '1', updated_at: 1_754_042_400_000 }),
    ).toMatchObject({ chatbotEnabled: true, updatedAt: 1_754_042_400_000 })
    expect(
      mapChatbotConfig({ updated_at: '2026-08-03T10:00:00.000Z' }).updatedAt,
    ).toBe(Date.parse('2026-08-03T10:00:00.000Z'))
  })

  test('chatbot config patches remain partial, trimmed and preserve false', () => {
    expect(toChatbotConfigPatch({ chatbotEnabled: false })).toEqual({
      chatbot_enabled: false,
    })
    expect(
      toChatbotConfigPatch({
        welcomeMessage: '  Hello  ',
        escalationMessage: '   ',
      }),
    ).toEqual({
      welcome_message: 'Hello',
      escalation_message: '',
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

  test('maps all editable fields, preserves zero, and does not mutate source', () => {
    const source = {
      ...row,
      notes: '',
      service_interest: 'Wedding photography',
      budget_range: 'high',
      conversion_value: 0,
      tags: ['vip', 'follow-up'],
      channel_source: 'telegram',
      updated_at: '2026-08-02T10:00:00.000Z',
      last_contact_at: null,
      converted_at: '2026-08-02T11:00:00.000Z',
    }
    const snapshot = structuredClone(source)
    const lead = mapLead(source)

    expect(lead.businessId).toBe('biz_1')
    expect(lead.notes).toBe('')
    expect(lead.serviceInterest).toBe('Wedding photography')
    expect(lead.budgetRange).toBe('high')
    expect(lead.conversionValue).toBe(0)
    expect(lead.tags).toEqual(['vip', 'follow-up'])
    expect(lead.updatedAt).toBe('2026-08-02T10:00:00.000Z')
    expect(source).toEqual(snapshot)
  })

  test('unassigned and missing interest read as placeholders, not blanks', () => {
    const lead = mapLead({
      ...row,
      assigned_agent_id: null,
      service_interest: null,
    })
    expect(lead.agent).toBe('Unassigned')
    expect(lead.interest).toBe('Not specified')
    expect(lead.serviceInterest).toBe('')
    expect(lead.notes).toBe('Wants a Saturday slot')
    expect(mapLead({ ...row, tags: null }).tags).toEqual([])
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

  test('activity preserves timestamp, metadata, and missing optional values', () => {
    const source = {
      id: 'activity_1',
      action: 'notes_updated',
      created_at: '2026-08-02T10:00:00.000Z',
      metadata: { field: 'notes' },
    }
    const snapshot = structuredClone(source)
    const activity = mapLeadActivity(source)
    expect(activity.type).toBe('notes_updated')
    expect(activity.description).toBe('')
    expect(activity.by).toBe('')
    expect(activity.createdAt).toBe('2026-08-02T10:00:00.000Z')
    expect(activity.metadata).toEqual({ field: 'notes' })
    expect(source).toEqual(snapshot)
  })

  test('bulk helpers retain visible failures and summarize settled results', () => {
    expect(retainVisibleLeadSelection(['a', 'b'], ['b', 'c'])).toEqual(['b'])
    expect(
      summarizeBulkLeadResults(
        ['a', 'b'],
        [{ status: 'fulfilled' }, { status: 'rejected' }],
      ),
    ).toEqual({ succeededIds: ['a'], failedIds: ['b'] })
    expect(isLeadListRequestCurrent(3, 3)).toBe(true)
    expect(isLeadListRequestCurrent(2, 3)).toBe(false)
  })

  test('live leads remain protected by combined status and search filtering', () => {
    const leads = [
      {
        id: 'new-match',
        name: 'Maya',
        interest: 'Wedding',
        status: 'new',
        channel: 'Telegram',
      },
      {
        id: 'qualified-stream',
        name: 'Maya',
        interest: 'Wedding',
        status: 'qualified',
        channel: 'Telegram',
      },
      {
        id: 'new-search-miss',
        name: 'Ravi',
        interest: 'Portrait',
        status: 'new',
        channel: 'Telegram',
      },
    ]

    expect(
      filterVisibleLeads(leads, { status: 'new' }).map((lead) => lead.id),
    ).toEqual(['new-match', 'new-search-miss'])
    leads[0] = { ...leads[0], status: 'contacted' }
    expect(
      filterVisibleLeads(leads, { status: 'new' }).map((lead) => lead.id),
    ).toEqual(['new-search-miss'])
    expect(filterVisibleLeads(leads, { status: '' })).toHaveLength(3)
    const visible = filterVisibleLeads(leads, {
      status: 'new',
      search: 'portrait',
    })
    expect(visible.map((lead) => lead.id)).toEqual(['new-search-miss'])
    expect(
      retainVisibleLeadSelection(
        ['new-match', 'new-search-miss'],
        visible.map((lead) => lead.id),
      ),
    ).toEqual(['new-search-miss'])
  })

  test('converted lead value changes use numeric comparison and minimal patches', () => {
    expect(hasConversionValueChanged('25000', 25000)).toBe(false)
    expect(
      buildLeadStatusPatch({
        currentStatus: 'converted',
        currentConversionValue: 25000,
        status: 'converted',
        conversionValue: '25000',
      }).patch,
    ).toBeNull()
    expect(
      buildLeadStatusPatch({
        currentStatus: 'converted',
        currentConversionValue: 25000,
        status: 'converted',
        conversionValue: '30000',
      }),
    ).toEqual({ patch: { conversion_value: 30000 }, error: '' })
    expect(hasConversionValueChanged('0', null)).toBe(true)
    expect(hasConversionValueChanged('5', 0)).toBe(true)
  })

  test('converted status validates values and status changes require a value', () => {
    const negative = buildLeadStatusPatch({
      currentStatus: 'converted',
      currentConversionValue: 10,
      status: 'converted',
      conversionValue: '-1',
    })
    expect(negative.patch).toBeNull()
    expect(negative.error).toContain('zero or more')
    const invalid = buildLeadStatusPatch({
      currentStatus: 'converted',
      currentConversionValue: 10,
      status: 'converted',
      conversionValue: 'not-a-number',
    })
    expect(invalid.patch).toBeNull()
    expect(invalid.error).toContain('zero or more')

    const missing = buildLeadStatusPatch({
      currentStatus: 'qualified',
      currentConversionValue: null,
      status: 'converted',
      conversionValue: '',
    })
    expect(missing.patch).toBeNull()
    expect(missing.error).toContain('zero or more')
    expect(
      buildLeadStatusPatch({
        currentStatus: 'qualified',
        currentConversionValue: null,
        status: 'converted',
        conversionValue: '0',
      }).patch,
    ).toEqual({ status: 'converted', conversion_value: 0 })
  })

  test('status draft reset restores status and conversion value without mutation', () => {
    const lead = { status: 'converted', conversionValue: 25000 }
    expect(leadStatusDrafts(lead)).toEqual({
      status: 'converted',
      conversionValue: '25000',
    })
    expect(lead).toEqual({ status: 'converted', conversionValue: 25000 })
    expect(
      leadStatusDrafts({ status: 'converted', conversionValue: null }),
    ).toEqual({
      status: 'converted',
      conversionValue: '',
    })
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
  test('maps only safe inbound image URLs from message metadata', () => {
    expect(
      mapHistoryMessage({
        from: 'user',
        text: 'Photo',
        metadata: JSON.stringify({
          type: 'image',
          image_url: 'https://cdn.example.com/photo.jpg',
        }),
      }).imageUrl,
    ).toBe('https://cdn.example.com/photo.jpg')
    expect(
      mapHistoryMessage({
        from: 'user',
        metadata: { type: 'image', image_url: 'data:image/png,x' },
      }).imageUrl,
    ).toBe('')
    expect(
      mapHistoryMessage({
        from: 'user',
        image_url: 'https://cdn.example.com/direct.jpg',
      }),
    ).toMatchObject({
      kind: 'photo',
      imageUrl: 'https://cdn.example.com/direct.jpg',
    })
  })
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
