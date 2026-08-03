<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import WebChatComposer from '../components/web-chat/WebChatComposer.vue'
import WebChatConnectionState from '../components/web-chat/WebChatConnectionState.vue'
import WebChatMessageList from '../components/web-chat/WebChatMessageList.vue'
import WebChatShell from '../components/web-chat/WebChatShell.vue'
import WebChatWelcome from '../components/web-chat/WebChatWelcome.vue'
import { imageAttachmentsEnabled, webChatEnabled } from '../config'
import { uploadChatImage } from '../services/chatMediaUpload'
import {
  createImageAttachmentDraft,
  revokeImageAttachmentPreview,
} from '../services/imageAttachments'
import {
  canSendWebChatQuickReply,
  createOutgoingWebChatImageMessage,
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
const attachment = ref(null)
let socket = null
let uploadController = null

const canSend = computed(
  () => webChatEnabled && connectionState.value === 'connected',
)

function persistSession(next) {
  session.value = saveWebChatSession(next)
}

function makeSocket() {
  return createWebChatSocket({
    enabled: webChatEnabled,
    imagesEnabled: imageAttachmentsEnabled,
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
  if (attachment.value) sendImageAttachment()
  else sendCustomerMessage(draft.value, { clearDraft: true })
}

function removeAttachment() {
  uploadController?.abort()
  uploadController = null
  const removed = attachment.value
  if (removed) {
    revokeImageAttachmentPreview(removed)
    if (removed.messageId)
      messages.value = messages.value.filter(
        (message) =>
          message.id !== removed.messageId || message.status === 'sent',
      )
  }
  attachment.value = null
}

function selectImage(file) {
  if (!imageAttachmentsEnabled || !canSend.value || processing.value) return
  removeAttachment()
  try {
    attachment.value = createImageAttachmentDraft(file)
  } catch (error) {
    connectionError.value = error?.message || 'Image could not be selected'
  }
}

async function sendImageAttachment(existingMessageId = '') {
  const selected = attachment.value
  if (
    !selected ||
    !imageAttachmentsEnabled ||
    !canSend.value ||
    processing.value
  )
    return false
  const associatedMessageId = existingMessageId || selected.messageId
  const outgoing = associatedMessageId
    ? messages.value.find((item) => item.id === associatedMessageId)
    : createOutgoingWebChatImageMessage({
        caption: draft.value,
        previewUrl: selected.previewUrl,
        uploadedUrl: selected.uploadedUrl,
        attachmentId: selected.id,
      })
  if (!outgoing) return false
  const isNewMessage = !associatedMessageId
  if (isNewMessage) {
    messages.value.push(outgoing)
    attachment.value = { ...selected, messageId: outgoing.id }
  }
  processing.value = true
  try {
    let uploadedUrl = selected.uploadedUrl
    if (!uploadedUrl) {
      attachment.value = {
        ...attachment.value,
        messageId: outgoing.id,
        status: 'uploading',
        error: '',
      }
      replaceMessage(outgoing.id, (item) => ({ ...item, status: 'uploading' }))
      uploadController = new AbortController()
      const uploaded = await uploadChatImage({
        file: selected.file,
        signal: uploadController.signal,
      })
      if (attachment.value?.id !== selected.id) return false
      uploadedUrl = uploaded.url
      attachment.value = {
        ...attachment.value,
        uploadedUrl,
        status: 'sending',
      }
    }
    replaceMessage(outgoing.id, (item) => ({
      ...item,
      imageUrl: uploadedUrl,
      uploadedUrl,
      status: 'sending',
    }))
    socket.sendImage({
      url: uploadedUrl,
      message: outgoing.text,
      sessionId: session.value.sessionId,
      firstName: session.value.firstName,
      lastName: session.value.lastName,
      language: session.value.language,
    })
    replaceMessage(outgoing.id, (item) => ({ ...item, status: 'sent' }))
    if (attachment.value?.id === selected.id) {
      revokeImageAttachmentPreview(attachment.value)
      attachment.value = null
      if (isNewMessage && draft.value.trim() === outgoing.text) draft.value = ''
    }
    return true
  } catch (error) {
    if (error?.name !== 'AbortError') {
      const message = error?.message || 'Image could not be sent'
      connectionError.value = message
      if (attachment.value?.id === selected.id)
        attachment.value = {
          ...attachment.value,
          status: 'failed',
          error: message,
        }
      replaceMessage(outgoing.id, (item) => ({ ...item, status: 'failed' }))
    }
    return false
  } finally {
    uploadController = null
    processing.value = false
  }
}

function retryMessage(message) {
  if (!canSend.value || processing.value) return
  if (message.type === 'image') {
    sendImageAttachment(message.id)
    return
  }
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
  removeAttachment()
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
  removeAttachment()
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
        :attachments-enabled="imageAttachmentsEnabled"
        :attachment="attachment"
        :attachment-disabled="!canSend || processing"
        @send="sendDraft"
        @select-image="selectImage"
        @remove-image="removeAttachment"
        @retry-image="sendImageAttachment(attachment?.messageId)"
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
