<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import WebChatComposer from '../components/web-chat/WebChatComposer.vue'
import WebChatConnectionState from '../components/web-chat/WebChatConnectionState.vue'
import WebChatMessageList from '../components/web-chat/WebChatMessageList.vue'
import WebChatShell from '../components/web-chat/WebChatShell.vue'
import WebChatWelcome from '../components/web-chat/WebChatWelcome.vue'
import { webChatEnabled } from '../config'
import {
  canSendWebChatQuickReply,
  createOutgoingWebChatMessage,
  getWebChatMessageWireValue,
  mapWebChatServerFrame,
  withWebChatMessageStatus,
} from '../services/webChatMessages'
import {
  clearWebChatSession,
  emptyWebChatSession,
  loadWebChatSession,
  saveWebChatSession,
} from '../services/webChatSession'
import { createWebChatSocket } from '../services/webChatSocket'

const connectionState = ref('idle')
const connectionError = ref('')
const messages = ref([])
const draft = ref('')
const processing = ref(false)
const session = ref(loadWebChatSession())
let socket = null

const canSend = computed(
  () => webChatEnabled && connectionState.value === 'connected',
)

function persistSession(next) {
  session.value = saveWebChatSession(next)
}

function makeSocket() {
  return createWebChatSocket({
    enabled: webChatEnabled,
    getSessionId: () => session.value.sessionId,
    onState: (state) => {
      connectionState.value = state
      if (state === 'connected') connectionError.value = ''
    },
    onError: (error) => {
      connectionError.value = error?.message || 'Web chat connection failed'
    },
    onSessionId: (sessionId) => {
      persistSession({ ...session.value, sessionId })
    },
    onFrame: (frame) => {
      const mapped = mapWebChatServerFrame(frame)
      if (mapped.messages.length) {
        messages.value.push(...mapped.messages)
      }
    },
  })
}

function connect() {
  if (!webChatEnabled) return
  if (!socket) socket = makeSocket()
  socket.connect()
}

function updateIdentity(identity) {
  persistSession({ ...session.value, ...identity })
}

function replaceMessage(id, transform) {
  messages.value = messages.value.map((message) =>
    message.id === id ? transform(message) : message,
  )
}

function sendCustomerMessage(
  text,
  { displayText = text, clearDraft = false } = {},
) {
  const normalized = String(text || '').trim()
  if (!normalized || processing.value) return false

  const outgoing = createOutgoingWebChatMessage(displayText, normalized)
  messages.value.push(outgoing)
  processing.value = true
  try {
    if (!socket) throw new Error('Web chat is not connected')
    socket.sendText({
      message: normalized,
      sessionId: session.value.sessionId,
      firstName: session.value.firstName,
      lastName: session.value.lastName,
      language: session.value.language,
    })
    replaceMessage(outgoing.id, (message) =>
      withWebChatMessageStatus(message, 'sent'),
    )
    if (clearDraft && draft.value.trim() === normalized) draft.value = ''
    return true
  } catch (error) {
    replaceMessage(outgoing.id, (message) =>
      withWebChatMessageStatus(message, 'failed'),
    )
    connectionError.value = error?.message || 'Message could not be sent'
    return false
  } finally {
    processing.value = false
  }
}

function sendDraft() {
  sendCustomerMessage(draft.value, { clearDraft: true })
}

function retryMessage(message) {
  if (!canSend.value || processing.value) return
  replaceMessage(message.id, (item) =>
    withWebChatMessageStatus(item, 'sending'),
  )
  processing.value = true
  try {
    socket.sendText({
      message: getWebChatMessageWireValue(message),
      sessionId: session.value.sessionId,
      firstName: session.value.firstName,
      lastName: session.value.lastName,
      language: session.value.language,
    })
    replaceMessage(message.id, (item) => withWebChatMessageStatus(item, 'sent'))
  } catch (error) {
    replaceMessage(message.id, (item) =>
      withWebChatMessageStatus(item, 'failed'),
    )
    connectionError.value = error?.message || 'Message could not be sent'
  } finally {
    processing.value = false
  }
}

function sendQuickReply(reply) {
  if (!canSendWebChatQuickReply(canSend.value, processing.value)) return
  sendCustomerMessage(reply.value, { displayText: reply.label })
}

function startNewConversation() {
  socket?.destroy()
  socket = null
  clearWebChatSession()
  session.value = emptyWebChatSession()
  messages.value = []
  draft.value = ''
  connectionError.value = ''
  connectionState.value = 'idle'
  connect()
}

onMounted(connect)
onUnmounted(() => {
  socket?.destroy()
  socket = null
})
</script>

<template>
  <main class="web-chat-page">
    <WebChatShell
      :prototype="webChatEnabled"
      @new-conversation="startNewConversation"
    >
      <div v-if="!webChatEnabled" class="capability-notice" role="note">
        <b>Preview environment</b>
        Web chat is ready in the dashboard, but live use requires secure tenant
        binding in the gateway.
      </div>
      <div v-else class="prototype-notice" role="note">
        Preview environment — this customer chat is currently in prototype mode.
      </div>
      <WebChatConnectionState
        :state="connectionState"
        :error="connectionError"
        :enabled="webChatEnabled"
        @reconnect="connect"
      />
      <WebChatWelcome
        :identity="session"
        :disabled="!webChatEnabled"
        @update:identity="updateIdentity"
      />
      <WebChatMessageList
        :messages="messages"
        :quick-replies-disabled="!canSend || processing"
        @retry="retryMessage"
        @quick-reply="sendQuickReply"
      />
      <WebChatComposer
        v-model="draft"
        :disabled="!canSend"
        :processing="processing"
        @send="sendDraft"
      />
    </WebChatShell>
  </main>
</template>

<style scoped>
.web-chat-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, var(--primary-soft), transparent 38%),
    #f6f7fb;
}
.capability-notice,
.prototype-notice {
  padding: 9px 16px;
  font-size: 11px;
  line-height: 1.45;
  text-align: center;
  color: var(--text-2);
  background: #fff8e3;
  border-bottom: 1px solid #f1e5bd;
}
.capability-notice b {
  margin-right: 4px;
}
.prototype-notice {
  background: #f5f3ff;
  border-color: #e3ddff;
}
@media (max-width: 600px) {
  .web-chat-page {
    padding: 0;
  }
}
</style>
