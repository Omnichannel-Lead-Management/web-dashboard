import { beforeEach, describe, expect, test } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'
import { appointmentService } from '../services/appointmentService.js'
import { useAppStore } from './app.js'

const storage = new Map()
globalThis.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
  removeItem(key) {
    storage.delete(key)
  },
  clear() {
    storage.clear()
  },
}

let store

beforeEach(() => {
  storage.clear()
  setActivePinia(createPinia())
  store = useAppStore()
  store.businessId = 'biz_1'
  store.appointments = [
    {
      id: 'appt_1',
      status: 'pending',
      customer: 'Customer',
      startTime: '2026-08-03T09:00:00.000Z',
      endTime: '2026-08-03T10:00:00.000Z',
    },
  ]
})

describe('appointment status store action', () => {
  test('optimistically confirms and keeps the confirmed server response', async () => {
    let resolveRequest
    appointmentService.updateStatus = () =>
      new Promise((resolve) => {
        resolveRequest = resolve
      })

    const request = store.updateAppointmentStatus('appt_1', 'confirmed')
    expect(store.appointments[0].status).toBe('confirmed')
    expect(store.toast).toBeNull()

    resolveRequest({
      ...store.appointments[0],
      status: 'confirmed',
      staff: 'Agent 1',
    })
    await request

    expect(store.appointments[0].status).toBe('confirmed')
    expect(store.appointments[0].staff).toBe('Agent 1')
    expect(store.toast).toEqual({
      message: 'Appointment confirmed',
      type: 'success',
    })
  })

  test('restores the original status and shows an error toast on failure', async () => {
    appointmentService.updateStatus = async () => {
      throw new Error('Status transition rejected')
    }

    const request = store.updateAppointmentStatus('appt_1', 'cancelled')
    expect(store.appointments[0].status).toBe('cancelled')

    await expect(request).rejects.toThrow('Status transition rejected')
    expect(store.appointments[0].status).toBe('pending')
    expect(store.toast).toEqual({
      message: 'Status transition rejected',
      type: 'error',
    })
  })

  test('handles an unknown appointment without calling the API', async () => {
    let calls = 0
    appointmentService.updateStatus = async () => {
      calls += 1
      return null
    }

    const result = await store.updateAppointmentStatus('missing', 'confirmed')
    expect(result).toBeNull()
    expect(calls).toBe(0)
    expect(store.toast).toEqual({
      message: 'Appointment not found',
      type: 'error',
    })
  })
})
