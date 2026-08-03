<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import AppButton from '../components/common/AppButton.vue'
import { BUSINESS_SECTORS } from '../services/businessProfile'

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
    !registrationForm.owner ||
    !/^\S+@\S+\.\S+$/.test(registrationForm.email) ||
    registrationForm.password.length < 6
  ) {
    validationError.value =
      'Please complete every required field with valid details.'
    return
  }

  if (registrationForm.password !== registrationForm.confirm) {
    validationError.value = 'Passwords do not match.'
    return
  }

  try {
    await store.registerBusiness(registrationForm)
    store.notify('Business created — connect your Telegram bot')
    router.push('/settings?section=telegram')
  } catch (error) {
    validationError.value = error.message || 'Could not create business'
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
            <option v-for="sector in BUSINESS_SECTORS" :key="sector">
              {{ sector }}
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
            minlength="6"
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
  color: #b42318;
  background: #fff0ed;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
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
