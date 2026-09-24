<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import AppButton from '../components/common/AppButton.vue'
import { BUSINESS_SECTORS } from '../constants/businessSectors'
import { friendlyErrorMessage } from '../services/displayText'

/** Must match the gateway's MIN_PASSWORD_LENGTH, or signup 400s on submit. */
const MIN_PASSWORD_LENGTH = 8

const router = useRouter()
const store = useAppStore()
const validationError = ref('')
const registrationForm = reactive({
  business: '',
  sector: '',
  owner: '',
  email: '',
  city: '',
  password: '',
  confirm: '',
})

async function submitRegistration() {
  if (
    !registrationForm.business ||
    !registrationForm.sector ||
    !registrationForm.owner ||
    !/^\S+@\S+\.\S+$/.test(registrationForm.email) ||
    registrationForm.password.length < MIN_PASSWORD_LENGTH
  ) {
    validationError.value =
      `Please complete every required field, with a password of at least ${MIN_PASSWORD_LENGTH} characters.`
    return
  }

  if (registrationForm.password !== registrationForm.confirm) {
    validationError.value = 'Passwords do not match.'
    return
  }

  try {
    await store.registerBusiness(registrationForm)
    store.notify('Business created. Next, connect a channel.')
    router.push('/settings?section=telegram')
  } catch (error) {
    validationError.value = friendlyErrorMessage(
      error,
      'We could not create your business. Please try again.',
    )
  }
}
</script>
<template>
  <main>
    <div class="wrap">
      <RouterLink to="/login" class="brand">
        <i><b /></i>
        <strong>Loop</strong>
      </RouterLink>
      <h1>Create your business</h1>
      <p>
        After registering, connect your Telegram bot to start receiving customer
        messages.
      </p>
      <form class="card" @submit.prevent="submitRegistration">
        <label class="field wide">
          Business name *
          <input v-model="registrationForm.business" required />
        </label>
        <label class="field">
          Sector *
          <select v-model="registrationForm.sector" required>
            <option disabled value="">Select a sector</option>
            <option
              v-for="sector in BUSINESS_SECTORS"
              :key="sector.value"
              :value="sector.value"
            >
              {{ sector.label }}
            </option>
          </select>
        </label>
        <label class="field">
          Owner name *
          <input v-model="registrationForm.owner" required />
        </label>
        <label class="field">
          Owner email *
          <input v-model="registrationForm.email" type="email" required />
        </label>
        <label class="field">
          City
          <input v-model="registrationForm.city" />
        </label>
        <label class="field">
          Password *
          <input
            v-model="registrationForm.password"
            type="password"
            :minlength="MIN_PASSWORD_LENGTH"
            required
          />
        </label>
        <label class="field">
          Confirm password *
          <input v-model="registrationForm.confirm" type="password" required />
        </label>
        <p v-if="validationError" class="error wide" role="alert">
          {{ validationError }}
        </p>
        <AppButton class="wide" size="lg">Create business & continue</AppButton>
      </form>
      <p class="foot">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </div>
  </main>
</template>
<style scoped>
main {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 36px;
}
.wrap {
  width: 100%;
  max-width: 540px;
}
.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--text);
  margin-bottom: 25px;
}
.brand i {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--primary);
  display: grid;
  place-items: center;
}
.brand b {
  width: 16px;
  height: 16px;
  border: 3px solid #fff;
  border-right-color: transparent;
  border-radius: 50%;
}
.brand strong {
  font-size: 21px;
}
.wrap h1 {
  font-size: 26px;
  margin-bottom: 6px;
}
.wrap > p {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 24px;
}
form {
  padding: 25px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.wide {
  grid-column: 1/-1;
}
.error {
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  padding: 11px 13px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-weight: 600;
  line-height: 1.5;
  margin: 0;
}
.foot {
  text-align: center;
  margin-top: 18px !important;
}
.foot a {
  font-weight: 700;
}
@media (max-width: 600px) {
  main {
    padding: 24px 14px;
  }
  form {
    grid-template-columns: 1fr;
    padding: 18px;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
