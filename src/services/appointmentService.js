import { gatewayApi } from './gatewayApi'
import { mapAppointment, mapAvailability } from './mappers'

/**
 * Bookings live in the Appointment service, reached through the gateway proxy.
 * Creation can fail with 409 when the slot was taken while the form was open —
 * callers must surface that rather than assume success.
 */
export const appointmentService = {
  async getAvailability({ businessId, date }) {
    const result = await gatewayApi.getAvailability({ businessId, date })
    return mapAvailability(result)
  },

  async list(businessId) {
    const result = await gatewayApi.listAppointments(businessId)
    return (result.data || []).map(mapAppointment)
  },

  async create(appointment) {
    const result = await gatewayApi.createAppointment(appointment)
    return result.data ? mapAppointment(result.data) : null
  },

  async updateStatus(id, businessId, status) {
    const result = await gatewayApi.updateAppointmentStatus(
      id,
      businessId,
      status,
    )
    return result.data ? mapAppointment(result.data) : null
  },
}
