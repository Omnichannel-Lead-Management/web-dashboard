import { describe, expect, test } from 'bun:test'

const read = (path) => Bun.file(new URL(path, import.meta.url)).text()

describe('escalation queue integration', () => {
  test('route is authenticated and uses the dashboard shell', async () => {
    const [router, view] = await Promise.all([
      read('../router/index.js'),
      read('../views/EscalationsView.vue'),
    ])
    expect(router).toContain("path: '/escalations'")
    expect(router).toContain('if (!to.meta.guest && !store.authenticated)')
    expect(view).toContain('AppShell')
    expect(view).toContain('Escalation queue')
  })

  test('uses verified actions without resolve or priority UI', async () => {
    const source = (
      await Promise.all([
        read('../views/EscalationsView.vue'),
        read('../components/escalations/EscalationQueueItem.vue'),
        read('../components/settings/EscalationQueueSettings.vue'),
      ])
    ).join('\n')
    expect(source).toContain('Return to AI assistant')
    expect(source).not.toContain('resolve_chat')
    expect(source).not.toMatch(/priority.*(high|medium|low)/i)
  })

  test('queue surfaces never expose platform internals to business owners', async () => {
    const source = (
      await Promise.all([
        read('../views/EscalationsView.vue'),
        read('../components/escalations/EscalationQueueItem.vue'),
        read('../components/settings/EscalationQueueSettings.vue'),
      ])
    ).join('\n')
    // Template text only — script imports legitimately mention services.
    expect(source).not.toContain('Prototype mode')
    expect(source).not.toContain('/ws/agents')
    expect(source).not.toContain('/api/agents/queue')
    expect(source).not.toContain('queue_snapshot')
    expect(source).not.toContain('gateway-issued')
    expect(source).not.toContain('tenant membership')
    expect(source).not.toContain('item.messengerId')
    expect(source).not.toContain('item.claimedByAgentId }}')
    expect(source).not.toContain('store.connectionStatus }}')
  })

  test('Nav and Settings link to the queue and Inbox uses a stable identifier', async () => {
    const [nav, settings, inbox] = await Promise.all([
      read('../components/layout/AppNavigation.vue'),
      read('../components/settings/EscalationQueueSettings.vue'),
      read('../views/InboxView.vue'),
    ])
    expect(nav).toContain("to: '/escalations'")
    expect(settings).toContain('to="/escalations"')
    expect(inbox).toContain('route.query.conversation')
    expect(inbox).not.toContain('v-html')
  })

  test('compact Inbox queue and ownership controls are capability gated', async () => {
    const [list, header, inbox] = await Promise.all([
      read('../components/inbox/ConversationList.vue'),
      read('../components/inbox/ChatHeader.vue'),
      read('../views/InboxView.vue'),
    ])
    expect(list).toContain('props.escalationEnabled')
    expect(header).toContain('escalationEnabled &&')
    expect(inbox).toContain(
      ':escalation-enabled="store.escalationQueueAvailable"',
    )
  })

  test('disabled escalation mode preserves the ordinary composer path', async () => {
    const inbox = await read('../views/InboxView.vue')
    expect(inbox).toContain(
      '(store.escalationQueueAvailable && !selectedConversation.value.claimed)',
    )
    expect(inbox).toContain(':disabled="composerDisabled"')
  })

  test('disabled full-page state isolates all live queue controls', async () => {
    const view = await read('../views/EscalationsView.vue')
    expect(view).toContain('<template v-else>')
    expect(view).toContain('Back to Inbox')
    expect(view.indexOf('<template v-else>')).toBeLessThan(
      view.indexOf('<div class="counts">'),
    )
    expect(view.indexOf('<template v-else>')).toBeLessThan(
      view.indexOf('<EscalationQueueFilters'),
    )
  })
})
