import { describe, expect, test } from 'bun:test'
import { computed, ref } from 'vue'
import {
  BUSINESS_TIMEZONES,
  isValidBusinessEmail,
  isValidBusinessPhone,
  optionsWithCurrent,
  validateBusinessHours,
  cloneBusinessProfileDraft,
  hasBusinessProfileChanges,
  activeBusinessForTenant,
  reconcileBusinessProfileDraft,
  canSubmitBusinessProfile,
} from './businessProfile.js'
import { getBusinessSectorOptions } from '../constants/businessSectors.js'
import { mapBusinessProfile, toBusinessProfilePatch } from './mappers.js'

describe('business profile validation', () => {
  test('validates optional email and phone values', () => {
    expect(isValidBusinessEmail('')).toBe(true)
    expect(isValidBusinessEmail('owner@example.com')).toBe(true)
    expect(isValidBusinessEmail('owner@invalid')).toBe(false)
    expect(isValidBusinessPhone('+94 (77) 123-4567')).toBe(true)
    expect(isValidBusinessPhone('phone')).toBe(false)
  })

  test('requires enabled hours and rejects overnight ranges', () => {
    expect(
      validateBusinessHours({
        monday: { enabled: true, open: '', close: '' },
        tuesday: { enabled: true, open: '17:00', close: '09:00' },
        wednesday: { enabled: false, open: '', close: '' },
      }),
    ).toEqual({
      monday: 'Open and close times are required.',
      tuesday: 'Close time must be after open time.',
    })
  })

  test('preserves unknown sector and timezone options', () => {
    expect(getBusinessSectorOptions('Healthcare')[0]).toEqual({
      value: 'Healthcare',
      label: 'Current value: Healthcare',
    })
    expect(optionsWithCurrent(BUSINESS_TIMEZONES, 'Pacific/Auckland')[0]).toBe(
      'Pacific/Auckland',
    )
  })

  test('clones reset drafts and detects only non-empty patches', () => {
    const confirmed = {
      name: 'Confirmed',
      businessHours: { monday: { enabled: false, open: '', close: '' } },
    }
    const draft = cloneBusinessProfileDraft(confirmed)
    draft.name = 'Draft'
    draft.businessHours.monday.enabled = true
    expect(confirmed.name).toBe('Confirmed')
    expect(confirmed.businessHours.monday.enabled).toBe(false)
    expect(hasBusinessProfileChanges({})).toBe(false)
    expect(hasBusinessProfileChanges({ name: 'Draft' })).toBe(true)
  })

  test('reactively selects only the current tenant business sector', () => {
    const businessId = ref('biz_a')
    const business = ref({ id: 'biz_a', sector: 'Salon' })
    const active = computed(() =>
      activeBusinessForTenant(business.value, businessId.value),
    )
    const sector = computed(() => active.value?.sector || '')

    expect(sector.value).toBe('Salon')
    business.value = { id: 'biz_a', sector: 'Healthcare' }
    expect(sector.value).toBe('Healthcare')
    businessId.value = 'biz_b'
    expect(sector.value).toBe('')
    business.value = { id: 'biz_b', sector: 'Photography' }
    expect(sector.value).toBe('Photography')
  })

  test('Settings binds FAQ sector to activeBusiness instead of a local snapshot', async () => {
    const settings = await Bun.file(
      new URL('../views/SettingsView.vue', import.meta.url),
    ).text()
    expect(settings).toContain(
      'activeBusinessForTenant(store.business, store.businessId)',
    )
    expect(settings).toContain(':sector="activeBusiness?.sector || \'\'"')
    expect(settings).not.toContain('const business = ref(null)')
  })

  test('clean same-business refresh replaces draft and baseline', () => {
    const previous = mapBusinessProfile({ id: 'biz_a', name: 'Old' })
    const refreshed = mapBusinessProfile({ id: 'biz_a', name: 'New' })
    const state = reconcileBusinessProfileDraft({
      confirmed: refreshed,
      baseline: previous,
      draft: previous,
      hasUnsavedChanges: false,
    })
    expect(state.baseline.name).toBe('New')
    expect(state.draft.name).toBe('New')
    expect(state.preservedDraft).toBe(false)
  })

  test('dirty refresh preserves edits and recalculates a minimal patch from the new baseline', () => {
    const baseline = mapBusinessProfile({
      id: 'biz_a',
      name: 'Old name',
      sector: 'Salon',
      owner_email: 'old@example.com',
    })
    const draft = cloneBusinessProfileDraft(baseline)
    draft.name = 'Server name'
    draft.ownerEmail = 'draft@example.com'
    const refreshed = mapBusinessProfile({
      id: 'biz_a',
      name: 'Server name',
      sector: 'Healthcare',
      owner_email: 'old@example.com',
    })
    const state = reconcileBusinessProfileDraft({
      confirmed: refreshed,
      baseline,
      draft,
      hasUnsavedChanges: true,
    })

    expect(state.draft.name).toBe('Server name')
    expect(state.draft.ownerEmail).toBe('draft@example.com')
    expect(state.draft.sector).toBe('Healthcare')
    expect(toBusinessProfilePatch(state.baseline, state.draft)).toEqual({
      owner_email: 'draft@example.com',
    })
  })

  test('tenant switch and logout force replacement instead of preserving an old draft', () => {
    const oldBaseline = mapBusinessProfile({ id: 'biz_a', name: 'A' })
    const oldDraft = { ...oldBaseline, name: 'A draft' }
    const businessB = mapBusinessProfile({ id: 'biz_b', name: 'B' })
    const switched = reconcileBusinessProfileDraft({
      confirmed: businessB,
      baseline: oldBaseline,
      draft: oldDraft,
      hasUnsavedChanges: true,
    })
    expect(switched.draft.name).toBe('B')
    expect(switched.baseline.id).toBe('biz_b')

    const loggedOut = reconcileBusinessProfileDraft({
      confirmed: mapBusinessProfile(),
      baseline: businessB,
      draft: switched.draft,
      hasUnsavedChanges: true,
      force: true,
    })
    expect(loggedOut.draft.id).toBe('')
    expect(loggedOut.draft.name).toBe('')
  })

  test('capability gate prevents disabled submissions and enables valid saves', () => {
    const ready = {
      hasConfirmedBusiness: true,
      valid: true,
      changed: true,
      saving: false,
    }
    expect(
      canSubmitBusinessProfile({ ...ready, capabilityEnabled: false }),
    ).toBe(false)
    expect(
      canSubmitBusinessProfile({ ...ready, capabilityEnabled: true }),
    ).toBe(true)
    expect(
      canSubmitBusinessProfile({
        ...ready,
        capabilityEnabled: true,
        valid: false,
      }),
    ).toBe(false)
  })

  test('disabled UI explains the blocker, guards save, and leaves Reset available', async () => {
    const component = await Bun.file(
      new URL(
        '../components/settings/BusinessProfileSettings.vue',
        import.meta.url,
      ),
    ).text()
    expect(component).toContain('if (!canSave.value) return')
    expect(component).toContain(':disabled="!canSave"')
    // The owner is told the effect on their work, not which service is missing.
    expect(component).toContain('Editing your profile is not available yet.')
    expect(component).toContain('changes will not be saved')
    expect(component).not.toContain('business-update')
    expect(component).not.toContain('gateway')
    expect(component).toContain('@click="reset"')
    expect(component).not.toMatch(/localStorage.*draft|draft.*localStorage/s)
  })
})
