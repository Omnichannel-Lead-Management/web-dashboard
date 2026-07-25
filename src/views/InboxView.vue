<script setup>
import { ref, computed, nextTick } from 'vue'
import { Columns3, ListFilter, PanelRight } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import ConversationList from '../components/inbox/ConversationList.vue'
import ChatHeader from '../components/inbox/ChatHeader.vue'
import ChatMessage from '../components/inbox/ChatMessage.vue'
import ChatComposer from '../components/inbox/ChatComposer.vue'
import CustomerDetailsPanel from '../components/inbox/CustomerDetailsPanel.vue'
import TriageQueue from '../components/inbox/TriageQueue.vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const conversationSearch = ref('')
const conversationFilter = ref('All')
const activeMobilePanel = ref('list')
const areDetailsVisible = ref(false)

const emptyConversation = {
  id: '',
  name: 'No conversations yet',
  claimed: false,
  escalated: false,
}

const selectedConversation = computed(
  () =>
    store.conversations.find(
      (conversation) => conversation.id === store.selectedConversationId,
    ) ||
    store.conversations[0] ||
    emptyConversation,
)

function selectConversation(id) {
  store.selectedConversationId = id

  const conversation = store.conversations.find(
    (currentConversation) => currentConversation.id === id,
  )

  if (conversation) {
    conversation.unread = false
  }

  store.loadHistory(id)
  activeMobilePanel.value = 'chat'
}

function sendMessage(messageText) {
  if (!selectedConversation.value.id) return
  store.sendMessage(selectedConversation.value.id, messageText)

  nextTick(() => {
    const messageList = document.querySelector('.messages')

    messageList?.scrollTo({ top: 99999, behavior: 'smooth' })
  })
}

function claimConversation(id = selectedConversation.value.id) {
  store.claim(id)
  selectConversation(id)
}
</script>
<template>
  <AppShell>
    <div class="inbox">
      <div class="viewbar">
        <div>
          <h1>Inbox</h1>
          <span>
            {{ store.conversations.length }} conversations · gateway
            {{ store.connectionStatus }}
          </span>
        </div>
        <div class="switch" aria-label="Inbox view">
          <button
            :class="{ active: store.inboxView === 'conversation' }"
            @click="store.setInboxView('conversation')"
          >
            <Columns3 :size="15" />
            Conversation
          </button>
          <button
            :class="{ active: store.inboxView === 'triage' }"
            @click="store.setInboxView('triage')"
          >
            <ListFilter :size="15" />
            Triage
          </button>
        </div>
      </div>
      <div v-if="store.inboxView === 'conversation'" class="workspace">
        <ConversationList
          :class="{ hiddenMobile: activeMobilePanel === 'chat' }"
          :conversations="store.conversations"
          :selected-id="selectedConversation.id"
          v-model:search="conversationSearch"
          v-model:filter="conversationFilter"
          @select="selectConversation"
        />
        <section
          class="chat"
          :class="{ hiddenMobile: activeMobilePanel === 'list' }"
        >
          <ChatHeader
            :conversation="selectedConversation"
            @back="activeMobilePanel = 'list'"
            @claim="claimConversation()"
            @release="store.release(selectedConversation.id)"
          />
          <div class="messages">
            <div class="date">Today</div>
            <ChatMessage
              v-for="m in store.messages[selectedConversation.id]"
              :key="m.id"
              :message="m"
            />
            <span v-if="selectedConversation.escalated" class="escalation">
              ⚠ Chat escalated to a human agent
            </span>
          </div>
          <button
            class="details-toggle"
            aria-label="Show customer details"
            @click="areDetailsVisible = true"
          >
            <PanelRight :size="18" />
          </button>
          <ChatComposer
            :disabled="!selectedConversation.id || !selectedConversation.claimed"
            :name="(selectedConversation.name || 'Customer').split(' ')[0]"
            @send="sendMessage"
          />
        </section>
        <CustomerDetailsPanel
          :class="{ showMobile: areDetailsVisible }"
          :conversation="selectedConversation"
          @close="areDetailsVisible = false"
        />
      </div>
      <TriageQueue
        v-else
        :conversations="store.conversations"
        @open="
          (id) => {
            selectConversation(id)
            store.setInboxView('conversation')
          }
        "
        @claim="
          (id) => {
            claimConversation(id)
            store.setInboxView('conversation')
          }
        "
      />
    </div>
  </AppShell>
</template>
<style scoped>
.inbox {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-h));
  min-height: 0;
}
.viewbar {
  min-height: 62px;
  padding: 10px 18px;
  background: #fff;
  border-bottom: 1px solid #eef0f5;
  display: flex;
  align-items: center;
  gap: 14px;
}
.viewbar h1 {
  font-size: 18px;
  margin: 0;
}
.viewbar span {
  font-size: 11.5px;
  color: var(--muted);
}
.switch {
  margin-left: auto;
  background: #f1f2f6;
  border-radius: 9px;
  padding: 3px;
  display: flex;
}
.switch button {
  display: flex;
  gap: 6px;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
}
.switch button.active {
  background: #fff;
  color: var(--primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.workspace {
  flex: 1;
  display: flex;
  min-height: 0;
}
.chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  position: relative;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.date {
  align-self: center;
  background: #f1f2f6;
  color: var(--muted);
  border-radius: 12px;
  padding: 4px 11px;
  font-size: 10px;
  font-weight: 700;
}
.escalation {
  align-self: center;
  color: var(--danger);
  font-size: 10.5px;
  font-weight: 700;
}
.details-toggle {
  display: none;
  position: absolute;
  right: 12px;
  bottom: 76px;
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 9px;
  padding: 8px;
  color: var(--primary);
  box-shadow: var(--shadow);
}
@media (max-width: 1050px) {
  .details-toggle {
    display: grid;
  }
}
@media (max-width: 760px) {
  .inbox {
    height: calc(100vh - 126px);
  }
  .viewbar {
    min-height: 58px;
  }
  .viewbar > div:first-child {
    display: none;
  }
  .switch {
    margin: 0 auto;
  }
  .workspace > .hidden-mobile {
    display: none;
  }
  .messages {
    padding: 16px 12px;
  }
}
</style>
