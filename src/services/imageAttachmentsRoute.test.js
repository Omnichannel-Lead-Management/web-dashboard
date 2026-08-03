import { describe, expect, test } from 'bun:test'

const read = (path) => Bun.file(new URL(path, import.meta.url)).text()

describe('image attachment integration', () => {
  test('web composer uses the exact safe image accept list and no base64 flow', async () => {
    const [composer, view] = await Promise.all([
      read('../components/web-chat/WebChatComposer.vue'),
      read('../views/WebChatView.vue'),
    ])
    expect(composer).toContain('IMAGE_ATTACHMENT_ACCEPTED_TYPES.join')
    expect(composer).not.toContain('accept="*/*"')
    expect(view).toContain('uploadChatImage')
    expect(view).toContain('socket.sendImage')
    expect(`${composer}${view}`).not.toContain('FileReader')
    expect(`${composer}${view}`).not.toContain('readAsDataURL')
  })

  test('capability is guarded and settings documents both surfaces', async () => {
    const [view, settings, inbox] = await Promise.all([
      read('../views/WebChatView.vue'),
      read('../components/settings/ImageAttachmentSettings.vue'),
      read('../components/inbox/ChatComposer.vue'),
    ])
    expect(view).toContain('!imageAttachmentsEnabled')
    expect(settings).toContain('POST /api/upload-image')
    expect(inbox).toContain('agent media-send API')
    expect(view).not.toContain('localStorage')
  })

  test('image retry reuses an uploaded URL and does not append another bubble', async () => {
    const view = await read('../views/WebChatView.vue')
    const send = view.slice(
      view.indexOf('async function sendImageAttachment'),
      view.indexOf('function retryMessage'),
    )
    const retry = view.slice(
      view.indexOf('function retryMessage'),
      view.indexOf('function sendQuickReply'),
    )
    expect(send).toContain('let uploadedUrl = selected.uploadedUrl')
    expect(send).toContain('if (!uploadedUrl)')
    expect(send).toContain('existingMessageId || selected.messageId')
    expect(send).toContain('message: outgoing.text')
    expect(send).not.toContain('message: draft.value')
    expect(retry).toContain('sendImageAttachment(message.id)')
    expect(retry).not.toContain('messages.value.push')
    expect(view).toContain(
      '@retry-image="sendImageAttachment(attachment?.messageId)"',
    )
    expect(view).toContain(
      "if (isNewMessage && draft.value.trim() === outgoing.text) draft.value = ''",
    )
  })

  test('image failure state is scoped to the currently rendered URL', async () => {
    const bubble = await read(
      '../components/web-chat/WebChatMessageBubble.vue',
    )
    expect(bubble).toContain("const failedImageUrl = ref('')")
    expect(bubble).toContain(
      'failedImageUrl.value === props.message.imageUrl',
    )
    expect(bubble).toContain(':key="message.imageUrl"')
    expect(bubble).toContain(':data-image-url="message.imageUrl"')
    expect(bubble).toContain('failedImageUrl.value = \'\'')
    expect(bubble).toContain(
      'if (!failedUrl || failedUrl !== props.message.imageUrl) return',
    )
    expect(bubble).toContain('failedImageUrl.value = failedUrl')
    expect(bubble).toContain('@error="handleImageError"')
    expect(bubble).toContain('<p v-if="message.text">{{ message.text }}</p>')
  })

  test('inbox image failure state is URL-scoped and keyed', async () => {
    const message = await read('../components/inbox/ChatMessage.vue')
    expect(message).toContain("const failedImageUrl = ref('')")
    expect(message).toContain(
      'failedImageUrl.value === props.message.imageUrl',
    )
    expect(message).toContain(':key="message.imageUrl"')
    expect(message).toContain(':data-image-url="message.imageUrl"')
    expect(message).toContain(
      'if (!failedUrl || failedUrl !== props.message.imageUrl) return',
    )
    expect(message).toContain('@error="handleImageError"')
    expect(message).toContain('<p>{{ message.text }}</p>')
  })
})
