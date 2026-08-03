import { expect, test } from 'bun:test'
import { gatewayApi } from './gatewayApi.js'
import { appointmentService } from './appointmentService.js'

test('appointmentService normalizes gateway availability', async () => {
  const originalGetAvailability = gatewayApi.getAvailability
  let received
  gatewayApi.getAvailability = async (query) => {
    received = query
    return {
      success: true,
      data: {
        businessId: query.businessId,
        date: query.date,
        slots: [
          {
            startTime: '2026-08-05T09:00:00.000Z',
            endTime: '2026-08-05T09:30:00.000Z',
          },
        ],
      },
    }
  }

  try {
    const result = await appointmentService.getAvailability({
      businessId: 'biz_x',
      date: '2026-08-05',
    })
    expect(received).toEqual({ businessId: 'biz_x', date: '2026-08-05' })
    expect(result.slots).toHaveLength(1)
    expect(result.slots[0].startTime).toBe('2026-08-05T09:00:00.000Z')
  } finally {
    gatewayApi.getAvailability = originalGetAvailability
  }
})
