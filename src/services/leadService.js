import { leads } from '../data/mockData'

export const leadService = {
  list() {
    return Promise.resolve(structuredClone(leads))
  },
  get(id) {
    const lead = leads.find((currentLead) => currentLead.id === id)

    return Promise.resolve(structuredClone(lead))
  },
}
