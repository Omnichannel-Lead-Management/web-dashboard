import { gatewayApi } from './gatewayApi'
import { mapConversation, mapHistoryMessage } from './mappers'

export const conversationService = {
  async list(businessId) {
    if (!businessId) return []
    const result = await gatewayApi.listConversations(businessId)
    return (result.conversations || []).map(mapConversation)
  },

  async messages({ messenger_id, platform }) {
    const result = await gatewayApi.getMessagingHistory({
      messenger_id,
      platform,
      limit: 50,
    })
    const history = Array.isArray(result.history) ? result.history : []
    return history.map((entry) =>
      mapHistoryMessage({
        id: entry.id,
        from: entry.is_from_user ? 'user' : 'ai',
        text: entry.message_text || entry.text,
        timestamp: entry.created_at || entry.timestamp,
      }),
    )
  },
}
