import { describe, expect, test } from 'bun:test'

async function source(path) {
  return Bun.file(new URL(path, import.meta.url)).text()
}

describe('ChatbotSettings draft-only warning contract', () => {
  test('warning is conditional and the prop defaults to false', async () => {
    const component = await source('./ChatbotSettings.vue')

    expect(component).toContain(
      'showDraftsWhenUnavailable: { type: Boolean, default: false }',
    )
    expect(
      component.match(
        /v-if="props\.showDraftsWhenUnavailable" class="draft-only"/g,
      ),
    ).toHaveLength(2)
  })

  test('normal Settings omits the fallback prop and preserves message saving', async () => {
    const [component, settings] = await Promise.all([
      source('./ChatbotSettings.vue'),
      source('../../views/SettingsView.vue'),
    ])

    expect(settings).toContain(
      '<ChatbotSettings :business-name="store.businessName" />',
    )
    expect(settings).not.toContain('show-drafts-when-unavailable')
    expect(component).toContain('await store.saveChatbotMessages({')
  })

  test('onboarding explicitly enables the unavailable draft fallback', async () => {
    const onboarding = await source('../onboarding/ChatbotSetupStep.vue')

    expect(onboarding).toContain('show-drafts-when-unavailable')
  })
})
