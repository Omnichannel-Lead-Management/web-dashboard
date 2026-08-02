import { gatewayApi } from './gatewayApi'
import { mapLead, mapLeadActivity } from './mappers'

/**
 * Leads come from the Lead Manager service via the gateway proxy. Every call is
 * tenant-scoped — Lead Manager filters on business_id server-side and returns
 * 404 across tenants, so a missing businessId here is a bug, not a "list all".
 */
export const leadService = {
  async list(businessId, filters) {
    const result = await gatewayApi.listLeads(businessId, filters)
    return (result.leads || []).map(mapLead)
  },

  async get(id, businessId) {
    const result = await gatewayApi.getLead(id, businessId)
    return {
      lead: mapLead(result.lead),
      activities: (result.activities || [])
        .map(mapLeadActivity)
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt || 0).getTime() || 0
          const rightTime = new Date(right.createdAt || 0).getTime() || 0
          return rightTime - leftTime
        }),
    }
  },

  async update(id, businessId, payload) {
    const result = await gatewayApi.updateLead(id, businessId, payload)
    return result.lead ? mapLead(result.lead) : null
  },

  async assign(id, businessId, payload) {
    const result = await gatewayApi.assignLead(id, businessId, payload)
    return result.lead ? mapLead(result.lead) : null
  },
}
