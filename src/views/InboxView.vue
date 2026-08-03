<script setup>
import { ref, computed, nextTick, provide, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import ConversationList from '../components/inbox/ConversationList.vue'
import ChatHeader from '../components/inbox/ChatHeader.vue'
import ChatMessage from '../components/inbox/ChatMessage.vue'
import ChatComposer from '../components/inbox/ChatComposer.vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const route = useRoute()
const isInboxPreview = computed(
  () => import.meta.env.DEV && route.query.preview === '1',
)
const conversationSearch = ref('')
const conversationFilter = ref('All')
const activeMobilePanel = ref('list')
const previewConversations = ref([])
const previewMessages = ref({})
const previewSelectedConversationId = ref('')
const previewIdentity = ref(null)

if (import.meta.env.DEV) {
watch(
    isInboxPreview,
    async (enabled) => {
      if (!enabled) return

      try {
        const preview = await import('../data/inboxPreviewData.js')
        if (!isInboxPreview.value) return
        previewConversations.value = structuredClone(
          preview.inboxPreviewConversations,
        )
        previewMessages.value = structuredClone(preview.inboxPreviewMessages)
        previewSelectedConversationId.value =
          preview.inboxPreviewSelectedConversationId
        previewIdentity.value = {
          business: preview.inboxPreviewBusiness,
          agent: preview.inboxPreviewAgent,
          connectionStatus: 'online',
        }
      } catch (error) {
        console.error('Failed to load inbox preview data:', error)
      }
    },
    { immediate: true },
  )
}

provide(
  'inboxPreviewIdentity',
  computed(() => (isInboxPreview.value ? previewIdentity.value : null)),
)

watch(
  () => route.query.conversation,
  async (id) => {
    if (typeof id !== 'string' || !id || isInboxPreview.value) return
    if (!store.conversations.some((item) => item.id === id))
      await store.refreshConversations()
    if (!store.conversations.some((item) => item.id === id)) return
    store.selectedConversationId = id
    store.loadHistory(id)
    activeMobilePanel.value = 'chat'
  },
  { immediate: true },
)

const emptyConversation = {
  id: '',
  name: 'No conversations yet',
  claimed: false,
  escalated: false,
}

const conversations = computed(() =>
  isInboxPreview.value ? previewConversations.value : store.conversations,
)

const selectedConversationId = computed(() =>
  isInboxPreview.value
    ? previewSelectedConversationId.value
    : store.selectedConversationId,
)

const selectedConversation = computed(
  () => {
    const selected = conversations.value.find(
      (conversation) => conversation.id === selectedConversationId.value,
    ) ||
    conversations.value[0] ||
    emptyConversation
    if (!selected.id) return selected
    const claimedByAgentId = selected.claimedByAgentId || ''
    return {
      ...selected,
      claimed: Boolean(claimedByAgentId && claimedByAgentId === store.agentId),
      claimedByOther: Boolean(claimedByAgentId && claimedByAgentId !== store.agentId),
    }
  },
)

const selectedMessages = computed(
  () =>
    (isInboxPreview.value ? previewMessages.value : store.messages)[
      selectedConversation.value.id
    ] || [],
)

const composerDisabled = computed(
  () =>
    !selectedConversation.value.id ||
    (store.escalationQueueAvailable && !selectedConversation.value.claimed),
)

function selectConversation(id) {
  if (isInboxPreview.value) {
    previewSelectedConversationId.value = id
  } else {
    store.selectedConversationId = id
  }
  const conversation = conversations.value.find((item) => item.id === id)
  if (conversation) conversation.unread = false
  if (!isInboxPreview.value) store.loadHistory(id)
  activeMobilePanel.value = 'chat'
}

function sendMessage(messageText) {
  if (!selectedConversation.value.id) return
  if (isInboxPreview.value) {
    previewMessages.value[selectedConversation.value.id] ||= []
    previewMessages.value[selectedConversation.value.id].push({
      id: `preview-${Date.now()}`,
      sender: 'agent',
      text: messageText,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      timestamp: new Date().toISOString(),
    })
  } else {
    store.sendMessage(selectedConversation.value.id, messageText)
  }
  nextTick(() => {
    document
      .querySelector('.messages')
      ?.scrollTo({ top: 99999, behavior: 'smooth' })
  })
}

function claimConversation(id = selectedConversation.value.id) {
  if (isInboxPreview.value) {
    const conversation = previewConversations.value.find(
      (item) => item.id === id,
    )
    if (conversation) conversation.claimed = true
  } else {
    store.claim(id)
  }
  selectConversation(id)
}

function releaseConversation(id) {
  if (isInboxPreview.value) {
    const conversation = previewConversations.value.find(
      (item) => item.id === id,
    )
    if (conversation) conversation.claimed = false
  } else {
    store.release(id)
  }
}
</script>

<template>
  <AppShell>
    <div class="inbox-layout">
      <ConversationList
        :class="{ hiddenMobile: activeMobilePanel === 'chat' }"
        :conversations="conversations"
        :selected-id="selectedConversation.id"
        :escalation-enabled="store.escalationQueueAvailable"
        v-model:search="conversationSearch"
        v-model:filter="conversationFilter"
        @select="selectConversation"
      />
      <section
        class="chat"
        :class="{ hiddenMobile: activeMobilePanel === 'list' }"
      >
        <ChatHeader
          v-if="selectedConversation.id"
          :conversation="selectedConversation"
          :agent-id="store.agentId"
          :escalation-enabled="store.escalationQueueAvailable"
          @back="activeMobilePanel = 'list'"
          @claim="claimConversation()"
          @release="releaseConversation(selectedConversation.id)"
        />
        <div v-if="selectedConversation.id" class="messages">
          <div v-if="selectedMessages.length" class="date">
            Today · {{ selectedMessages[0].time || 'Recent' }}
          </div>
          <ChatMessage
            v-for="message in selectedMessages"
            :key="message.id"
            :message="message"
          />
          <div
            v-if="selectedConversation.id && !selectedMessages.length"
            class="empty-chat"
          >
            No messages in this conversation yet.
          </div>
          <span v-if="selectedConversation.escalated" class="escalation">
            ⚠ Chat escalated to a human agent
          </span>
        </div>
        <div v-else class="empty-workspace">
          Select a conversation to view its messages.
        </div>
        <ChatComposer
          v-if="selectedConversation.id"
          :disabled="composerDisabled"
          :name="(selectedConversation.name || 'Customer').split(' ')[0]"
          @send="sendMessage"
        />
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.inbox-layout {
  display: grid;
  grid-template-columns: 466px minmax(0, 1fr);
  width: 100%;
  height: calc(100vh - var(--header-h));
  min-height: 0;
}
.chat {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #fff;
}
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 29px 33px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.date {
  align-self: center;
  color: var(--muted);
  background: #f1f2f6;
  border-radius: 99px;
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 600;
}
.escalation {
  align-self: center;
  color: var(--danger);
  font-size: 11px;
  font-weight: 700;
}
.empty-chat {
  margin: auto;
  color: var(--muted);
  font-size: 13px;
}
.empty-workspace {
  margin: auto;
  color: var(--muted);
  font-size: 13px;
}
@media (max-width: 1100px) {
  .inbox-layout {
    grid-template-columns: 380px minmax(0, 1fr);
  }
}
@media (max-width: 760px) {
  .inbox-layout {
    display: block;
    height: calc(100vh - 126px);
  }
  .hidden-mobile {
    display: none;
  }
  .chat {
    height: 100%;
  }
  .messages {
    padding: 18px 14px;
  }
}
</style>
