import { describe, expect, test } from 'bun:test'

const read = (path) => Bun.file(new URL(path, import.meta.url)).text()

describe('public web chat integration', () => {
  test('registers a public route outside the authenticated dashboard shell', async () => {
    const [router, view] = await Promise.all([
      read('../router/index.js'),
      read('../views/WebChatView.vue'),
    ])
    expect(router).toContain("path: '/web-chat'")
    expect(router).toContain('meta: { guest: true, publicChat: true }')
    expect(view).not.toContain('AppShell')
  })

  test('settings exposes a preview link to the public route', async () => {
    const settings = await read('../components/settings/WebChatSettings.vue')
    expect(settings).toContain("router.push('/web-chat')")
    // Owners are told whether the channel is on, not how it is wired up.
    expect(settings).toContain('webChatEnabled')
    expect(settings).not.toContain('tenant binding')
    expect(settings).not.toContain('Gateway route')
    expect(settings).not.toContain('/ws/chat')
  })

  test('disabled view gates socket creation and says so in plain language', async () => {
    const view = await read('../views/WebChatView.vue')
    expect(view).toContain('if (!webChatEnabled) return')
    expect(view).toContain('Web chat is currently turned off')
    expect(view).not.toContain('secure tenant')
    expect(view).not.toContain('prototype mode')
  })

  test('retry uses the preserved wire value without adding another bubble', async () => {
    const view = await read('../views/WebChatView.vue')
    const retry = view.slice(
      view.indexOf('function retryMessage'),
      view.indexOf('function sendQuickReply'),
    )
    expect(retry).toContain('getWebChatMessageWireValue(message)')
    expect(retry).not.toContain('messages.value.push')
  })

  test('quick replies are guarded and disabled through the component tree', async () => {
    const [view, list, bubble] = await Promise.all([
      read('../views/WebChatView.vue'),
      read('../components/web-chat/WebChatMessageList.vue'),
      read('../components/web-chat/WebChatMessageBubble.vue'),
    ])
    const handler = view.slice(
      view.indexOf('function sendQuickReply'),
      view.indexOf('function startNewConversation'),
    )

    expect(handler).toContain(
      'canSendWebChatQuickReply(canSend.value, processing.value)',
    )
    expect(handler.indexOf('canSendWebChatQuickReply')).toBeLessThan(
      handler.indexOf('sendCustomerMessage'),
    )
    expect(view).toContain(':quick-replies-disabled="!canSend || processing"')
    expect(list).toContain(':quick-replies-disabled="quickRepliesDisabled"')
    expect(bubble).toContain(':disabled="quickRepliesDisabled"')
    expect(bubble).toContain('if (props.quickRepliesDisabled) return')
  })

  test('composer provides a visible keyboard focus treatment', async () => {
    const composer = await read('../components/web-chat/WebChatComposer.vue')
    expect(composer).toContain('.composer textarea:focus-visible')
    expect(composer).toContain('outline: 3px solid')
    expect(composer).toContain('outline-offset: 2px')
  })
})
