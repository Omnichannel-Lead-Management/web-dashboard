import { conversations, messagesByConversation } from '../data/mockData'
const delay = (value) => Promise.resolve(structuredClone(value))
export const conversationService = { list:()=>delay(conversations), messages:(id)=>delay(messagesByConversation[id] || []) }
