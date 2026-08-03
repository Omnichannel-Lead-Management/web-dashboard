<script setup>
import { computed, reactive, ref, watch } from 'vue'
import AppButton from '../common/AppButton.vue'
import BusinessHoursEditor from './BusinessHoursEditor.vue'
import {
  mapBusinessProfile,
  toBusinessProfilePatch,
} from '../../services/mappers'
import {
  BUSINESS_TIMEZONES,
  isValidBusinessEmail,
  isValidBusinessPhone,
  optionsWithCurrent,
  validateBusinessHours,
  cloneBusinessProfileDraft,
  hasBusinessProfileChanges,
  reconcileBusinessProfileDraft,
  canSubmitBusinessProfile,
} from '../../services/businessProfile'
import { getBusinessSectorOptions } from '../../constants/businessSectors'
import { useAppStore } from '../../stores/app'
import { businessProfileUpdateEnabled } from '../../config'

const store = useAppStore()
const draft = reactive(mapBusinessProfile())
const baseline = ref(mapBusinessProfile())
const loading = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveStatus = ref('')

const confirmedBusiness = computed(() =>
  store.business?.id === store.businessId ? store.business : null,
)
const sectorOptions = computed(() => getBusinessSectorOptions(draft.sector))
const timezoneOptions = computed(() =>
  optionsWithCurrent(BUSINESS_TIMEZONES, draft.timezone),
)
const hoursErrors = computed(() => validateBusinessHours(draft.businessHours))
const validation = computed(() => ({
  name: draft.name ? '' : 'Business name is required.',
  sector: draft.sector ? '' : 'Sector is required.',
  email: isValidBusinessEmail(draft.ownerEmail)
    ? ''
    : 'Enter a valid email address.',
  phone: isValidBusinessPhone(draft.contactPhone)
    ? ''
    : 'Enter a valid phone number.',
}))
const patch = computed(() => toBusinessProfilePatch(baseline.value, draft))
const valid = computed(
  () =>
    !Object.values(validation.value).some(Boolean) &&
    !Object.keys(hoursErrors.value).length,
)
const changed = computed(() => hasBusinessProfileChanges(patch.value))
const canSave = computed(() =>
  canSubmitBusinessProfile({
    capabilityEnabled: businessProfileUpdateEnabled,
    hasConfirmedBusiness: Boolean(confirmedBusiness.value),
    valid: valid.value,
    changed: changed.value,
    saving: store.businessProfileSaving,
  }),
)
const endpointUnavailable = computed(() =>
  /404|not found|cannot (get|patch)|endpoint/i.test(saveError.value),
)

function replaceDraft(profile) {
  Object.assign(draft, cloneBusinessProfileDraft(profile))
}

function reset() {
  replaceDraft(baseline.value)
  saveError.value = ''
  saveStatus.value = ''
}

function synchronizeConfirmed(
  value,
  { force = false, clearFeedback = false } = {},
) {
  const mapped = mapBusinessProfile(value)
  const reconciled = reconcileBusinessProfileDraft({
    confirmed: mapped,
    baseline: baseline.value,
    draft,
    hasUnsavedChanges: changed.value,
    force,
  })
  baseline.value = reconciled.baseline
  replaceDraft(reconciled.draft)
  if (clearFeedback) {
    saveError.value = ''
    saveStatus.value = ''
  }
}

async function load() {
  const requestBusinessId = store.businessId
  if (!requestBusinessId) return
  loading.value = true
  loadError.value = ''
  try {
    const result = await store.refreshBusiness()
    if (
      store.authenticated &&
      result?.id === requestBusinessId &&
      store.businessId === requestBusinessId
    )
      synchronizeConfirmed(result)
  } catch (error) {
    if (store.authenticated && store.businessId === requestBusinessId)
      loadError.value = error.message || 'Business profile could not be loaded.'
  } finally {
    if (store.authenticated && store.businessId === requestBusinessId)
      loading.value = false
  }
}

async function save() {
  if (!canSave.value) return
  saveError.value = ''
  saveStatus.value = 'Saving business profile…'
  const requestBusinessId = store.businessId
  try {
    const result = await store.saveBusinessProfile(patch.value)
    if (!store.authenticated || requestBusinessId !== store.businessId) return
    if (!result) {
      saveStatus.value = ''
      saveError.value = 'Business profile save could not be confirmed.'
      return
    }
    synchronizeConfirmed(store.business, { force: true, clearFeedback: true })
    saveStatus.value = 'Business profile saved.'
  } catch (error) {
    if (!store.authenticated || requestBusinessId !== store.businessId) return
    saveError.value = error.message || 'Business profile could not be saved.'
    saveStatus.value = ''
  }
}

watch(
  () => [store.authenticated, store.businessId],
  ([authenticated, businessId]) => {
    loadError.value = ''
    saveError.value = ''
    if (!authenticated) {
      synchronizeConfirmed(mapBusinessProfile(), {
        force: true,
        clearFeedback: true,
      })
      loading.value = false
      return
    }
    const business = confirmedBusiness.value
    if (business?.id === businessId)
      synchronizeConfirmed(business, { force: true, clearFeedback: true })
    else {
      synchronizeConfirmed(mapBusinessProfile(), {
        force: true,
        clearFeedback: true,
      })
      if (businessId) void load()
    }
  },
  { immediate: true },
)

watch(confirmedBusiness, (business) => {
  if (business) synchronizeConfirmed(business)
})
</script>

<template>
  <section aria-labelledby="business-profile-heading">
    <h2 id="business-profile-heading">Business Profile</h2>
    <p class="intro">Manage your business identity and operating details.</p>
    <div v-if="loading && !confirmedBusiness" class="notice" role="status">
      Loading business profile…
    </div>
    <div
      v-else-if="loadError && !confirmedBusiness"
      class="notice error"
      role="alert"
    >
      <span>{{ loadError }}</span>
      <AppButton size="sm" variant="outline" @click="load">
        Retry loading
      </AppButton>
    </div>
    <form v-else @submit.prevent="save">
      <div
        v-if="!businessProfileUpdateEnabled"
        id="profile-update-capability"
        class="schema-note"
        role="note"
      >
        <b>
          Profile editing is ready in the dashboard, but saving requires the
          gateway business-update API.
        </b>
        <span>
          Changes made here are not saved until backend profile updates are
          enabled.
        </span>
      </div>
      <div class="form-grid">
        <label class="field">
          Business name *
          <input
            v-model="draft.name"
            required
            maxlength="120"
            :disabled="store.businessProfileSaving"
          />
          <small v-if="validation.name" class="field-error">
            {{ validation.name }}
          </small>
        </label>
        <label class="field">
          Sector *
          <select
            v-model="draft.sector"
            required
            :disabled="store.businessProfileSaving"
          >
            <option disabled value="">Select a sector</option>
            <option
              v-for="sector in sectorOptions"
              :key="sector.value"
              :value="sector.value"
            >
              {{ sector.label }}
            </option>
          </select>
          <small v-if="validation.sector" class="field-error">
            {{ validation.sector }}
          </small>
        </label>
        <label class="field">
          Owner/contact email
          <input
            v-model="draft.ownerEmail"
            type="email"
            maxlength="254"
            :disabled="store.businessProfileSaving"
          />
          <small v-if="validation.email" class="field-error">
            {{ validation.email }}
          </small>
        </label>
        <label class="field">
          Timezone
          <select
            v-model="draft.timezone"
            :disabled="store.businessProfileSaving"
          >
            <option value="">Not set</option>
            <option v-for="zone in timezoneOptions" :key="zone" :value="zone">
              {{ zone }}
            </option>
          </select>
        </label>
        <label class="field">
          Contact phone
          <input
            v-model="draft.contactPhone"
            type="tel"
            maxlength="40"
            placeholder="+94 77 123 4567"
            :disabled="store.businessProfileSaving"
          />
          <small v-if="validation.phone" class="field-error">
            {{ validation.phone }}
          </small>
        </label>
        <label class="field wide">
          Address
          <textarea
            v-model="draft.address"
            rows="3"
            maxlength="500"
            :disabled="store.businessProfileSaving"
          />
        </label>
      </div>
      <BusinessHoursEditor
        v-model="draft.businessHours"
        :errors="hoursErrors"
        :disabled="store.businessProfileSaving"
      />
      <p v-if="saveError" class="notice error" role="alert">{{ saveError }}</p>
      <p v-if="endpointUnavailable" class="backend-note">
        The profile editor is complete, but the gateway does not yet provide the
        business-update endpoint.
      </p>
      <p class="save-status" aria-live="polite">{{ saveStatus }}</p>
      <div class="actions">
        <AppButton
          type="button"
          variant="outline"
          :disabled="!changed || store.businessProfileSaving"
          @click="reset"
        >
          Reset
        </AppButton>
        <AppButton
          type="submit"
          :loading="store.businessProfileSaving"
          :disabled="!canSave"
          :aria-describedby="
            !businessProfileUpdateEnabled
              ? 'profile-update-capability'
              : undefined
          "
        >
          Save changes
        </AppButton>
      </div>
    </form>
  </section>
</template>

<style scoped>
.intro {
  color: var(--muted);
  font-size: 13.5px;
  margin-bottom: 18px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.field {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 650;
}
.wide {
  grid-column: 1 / -1;
}
.schema-note,
.backend-note {
  padding: 11px 13px;
  border-radius: 9px;
  background: var(--primary-soft);
  color: var(--text-2);
  font-size: 12px;
}
.schema-note {
  display: grid;
  gap: 4px;
}
.backend-note {
  background: var(--danger-bg);
}
.notice {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 9px;
  background: var(--surface-2);
}
.error,
.field-error {
  color: var(--danger);
}
.save-status {
  min-height: 18px;
  color: var(--muted);
  font-size: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
@media (max-width: 620px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
  .actions {
    flex-direction: column-reverse;
  }
}
</style>
