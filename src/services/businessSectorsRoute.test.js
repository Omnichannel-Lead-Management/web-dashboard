import { describe, expect, test } from 'bun:test'

const read = (path) => Bun.file(new URL(path, import.meta.url)).text()

describe('business sector integrations', () => {
  test('registration and profile settings use the shared value/label source', async () => {
    const [registration, profile] = await Promise.all([
      read('../views/RegisterView.vue'),
      read('../components/settings/BusinessProfileSettings.vue'),
    ])
    expect(registration).toContain("from '../constants/businessSectors'")
    expect(registration).toContain(':value="sector.value"')
    expect(registration).toContain('{{ sector.label }}')
    expect(registration).toContain('!registrationForm.sector')
    expect(profile).toContain("from '../../constants/businessSectors'")
    expect(profile).toContain('getBusinessSectorOptions(draft.sector)')
    expect(profile).toContain(':value="sector.value"')
    expect(profile).toContain('{{ sector.label }}')
    expect(profile).not.toContain('v-html')
  })

  test('onboarding displays shared labels while preserving unknown values', async () => {
    const review = await read('../components/onboarding/BusinessReviewStep.vue')
    expect(review).toContain("from '../../constants/businessSectors'")
    expect(review).toContain('getBusinessSectorLabel(business.sector)')
    expect(review).not.toContain('v-html')
  })

  test('no production component keeps a duplicate sector array', async () => {
    const [registration, profile, businessProfile] = await Promise.all([
      read('../views/RegisterView.vue'),
      read('../components/settings/BusinessProfileSettings.vue'),
      read('./businessProfile.js'),
    ])
    for (const source of [registration, profile, businessProfile]) {
      expect(source).not.toContain("['Salon', 'Tutor', 'Photography']")
    }
  })
})
