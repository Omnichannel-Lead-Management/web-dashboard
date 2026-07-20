import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  conversations as seedConversations,
  messagesByConversation,
  leads as seedLeads,
  initialAppointments,
} from '../data/mockData'

export const useAppStore = defineStore('app', () => {
  const authenticated = ref(localStorage.getItem('loop-auth') === 'true')
  const inboxView = ref(
    localStorage.getItem('loop-inbox-view') || 'conversation',
  )
  const chatbotEnabled = ref(localStorage.getItem('loop-chatbot') !== 'false')
  const conversations = ref(structuredClone(seedConversations))
  const messages = ref(structuredClone(messagesByConversation))
  const leads = ref(structuredClone(seedLeads))
  const appointments = ref(structuredClone(initialAppointments))
  const selectedConversationId = ref('A12F')
  const toast = ref(null)

  let toastTimer

  function notify(message, type = 'success') {
    toast.value = { message, type }
    clearTimeout(toastTimer)

    toastTimer = setTimeout(() => {
      toast.value = null
    }, 3200)
  }

  function login() {
    authenticated.value = true
    localStorage.setItem('loop-auth', 'true')
  }

  function logout() {
    authenticated.value = false
    localStorage.removeItem('loop-auth')
  }

  function setInboxView(view) {
    inboxView.value = view
    localStorage.setItem('loop-inbox-view', view)
  }

  function toggleChatbot() {
    chatbotEnabled.value = !chatbotEnabled.value
    localStorage.setItem('loop-chatbot', String(chatbotEnabled.value))
    notify(`Chatbot ${chatbotEnabled.value ? 'enabled' : 'disabled'}`)
  }

  function claim(id) {
    const conversation = conversations.value.find(
      (currentConversation) => currentConversation.id === id,
    )

    if (conversation) {
      conversation.claimed = true
    }

    notify('Chat claimed — you can reply now')
  }

  function release(id) {
    const conversation = conversations.value.find(
      (currentConversation) => currentConversation.id === id,
    )

    if (conversation) {
      conversation.claimed = false
    }

    notify('Chat released back to the queue')
  }

  function sendMessage(id, text) {
    messages.value[id] ||= []
    messages.value[id].push({
      id: Date.now(),
      sender: 'agent',
      text,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    })
    const conversation = conversations.value.find(
      (currentConversation) => currentConversation.id === id,
    )

    if (conversation) {
      conversation.preview = text
    }
  }

  function updateLeadStatus(id, status) {
    const lead = leads.value.find((currentLead) => currentLead.id === id)
    const conversation = conversations.value.find(
      (currentConversation) => currentConversation.id === id,
    )

    if (lead) {
      lead.status = status
    }

    if (conversation) {
      conversation.status = status
    }

    notify('Lead status updated')
  }

  function addAppointment(item) {
    appointments.value.unshift({
      ...item,
      id: Date.now(),
      status: 'confirmed',
      day: 'Upcoming',
    })
    notify('Appointment created')
  }

  return {
    authenticated,
    inboxView,
    chatbotEnabled,
    conversations,
    messages,
    leads,
    appointments,
    selectedConversationId,
    toast,
    notify,
    login,
    logout,
    setInboxView,
    toggleChatbot,
    claim,
    release,
    sendMessage,
    updateLeadStatus,
    addAppointment,
  }
})
