import { describe, expect, test } from 'bun:test'
import { isCurrentTemplateAttachment } from './templateAttachment.js'

describe('template attachment tenant guard', () => {
  test('accepts a same-business successful attachment', () => {
    expect(
      isCurrentTemplateAttachment({
        requestBusinessId: 'biz_a',
        activeBusinessId: 'biz_a',
        flow: { id: 'flow_a', businessId: 'biz_a' },
      }),
    ).toBe(true)
  })

  test('suppresses an attachment after the active business changes', () => {
    expect(
      isCurrentTemplateAttachment({
        requestBusinessId: 'biz_a',
        activeBusinessId: 'biz_b',
        flow: { id: 'flow_a', businessId: 'biz_a' },
      }),
    ).toBe(false)
  })

  test('suppresses a returned flow with a mismatched business ID', () => {
    expect(
      isCurrentTemplateAttachment({
        requestBusinessId: 'biz_a',
        activeBusinessId: 'biz_a',
        flow: { id: 'flow_b', businessId: 'biz_b' },
      }),
    ).toBe(false)
  })

  test('allows a same-business flow when the response omits a business ID', () => {
    expect(
      isCurrentTemplateAttachment({
        requestBusinessId: 'biz_a',
        activeBusinessId: 'biz_a',
        flow: { id: 'flow_a' },
      }),
    ).toBe(true)
  })

  test('the picker guards attached emission and onboarding validates the returned flow', async () => {
    const [picker, onboarding] = await Promise.all([
      Bun.file(
        new URL('../components/settings/TemplatePicker.vue', import.meta.url),
      ).text(),
      Bun.file(new URL('../views/OnboardingView.vue', import.meta.url)).text(),
    ])

    expect(picker).toContain('const requestBusinessId = store.businessId')
    expect(picker).toContain('isCurrentTemplateAttachment({')
    expect(picker).toContain("emit('attached', flow)")
    expect(onboarding).toContain('flow.businessId === store.businessId')
    expect(onboarding).toContain('@confirmed="markTemplateConfirmed"')
  })
})
