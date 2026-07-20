import { conversations, messagesByConversation } from '../data/mockData'

function resolveMockData(value) {
  return Promise.resolve(structuredClone(value))
}

export const conversationService = {
  list() {
    return resolveMockData(conversations)
  },
  messages(id) {
    return resolveMockData(messagesByConversation[id] || [])
  },
}
