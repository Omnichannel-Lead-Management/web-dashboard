import { initialAppointments } from '../data/mockData'

export const appointmentService = {
  list() {
    return Promise.resolve(structuredClone(initialAppointments))
  },
  create(appointment) {
    return Promise.resolve({ ...appointment, id: Date.now() })
  },
}
