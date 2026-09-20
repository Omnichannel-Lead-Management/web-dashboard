<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import AppButton from '../components/common/AppButton.vue'
import { friendlyErrorMessage } from '../services/displayText'
const router = useRouter()
const store = useAppStore()
const validationError = ref('')
const loginForm = reactive({
  email: '',
  password: '',
})

const submitting = ref(false)

async function submitLogin() {
  if (submitting.value) return
  validationError.value = ''

  const hasValidEmail = /^\S+@\S+\.\S+$/.test(loginForm.email)
  const hasValidPassword = loginForm.password.length >= 6

  if (!hasValidEmail || !hasValidPassword) {
    validationError.value =
      'Enter a valid email and a password of at least 6 characters.'
    return
  }

  submitting.value = true
  try {
    await store.login({ owner_email: loginForm.email })
    store.notify(`Welcome back, ${store.agentName}.`)
    router.push('/inbox')
  } catch (error) {
    validationError.value = friendlyErrorMessage(
      error,
      'We could not sign you in. Check your details and try again.',
    )
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <main class="auth">
    <section>
      <div class="form">
        <RouterLink to="/" class="brand">
          <i><b /></i>
          <strong>Loop</strong>
        </RouterLink>
        <h1>Welcome back</h1>
        <p>Sign in to your business workspace.</p>
        <form @submit.prevent="submitLogin">
          <label class="field">
            Email
            <input
              v-model.trim="loginForm.email"
              type="email"
              autocomplete="email"
              required
            />
          </label>
          <label class="field">
            Password
            <input
              v-model="loginForm.password"
              type="password"
              autocomplete="current-password"
              required
              minlength="6"
            />
          </label>
          <p v-if="validationError" class="error" role="alert">
            {{ validationError }}
          </p>
          <AppButton size="lg" :loading="submitting">
            {{ submitting ? 'Signing in…' : 'Sign in' }}
          </AppButton>
        </form>
        <p class="foot">
          New business?
          <RouterLink to="/register">Create an account</RouterLink>
        </p>
      </div>
    </section>
    <aside>
      <div>
        <span class="eyebrow">Omnichannel · One inbox</span>
        <h2>
          Every customer message from Telegram, WhatsApp & web in one calm
          place.
        </h2>
        <p>
          <b>Live inbox</b>
          <b>Lead scoring</b>
          <b>Auto-replies</b>
        </p>
      </div>
    </aside>
  </main>
</template>
<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
}
.auth > section {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 35px;
}
.form {
  width: 100%;
  max-width: 380px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  color: var(--text);
  margin-bottom: 32px;
}
.brand i {
  width: 40px;
  height: 40px;
  background: var(--primary);
  border-radius: 12px;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 18px -7px var(--primary);
}
.brand b {
  width: 17px;
  height: 17px;
  border: 3px solid white;
  border-right-color: transparent;
  border-radius: 50%;
}
.brand strong {
  font-size: 23px;
}
.form h1 {
  font-size: 27px;
  margin-bottom: 6px;
}
.form > p {
  font-size: 14.5px;
  color: var(--muted);
  margin-bottom: 26px;
}
.form form {
  display: flex;
  flex-direction: column;
  gap: 15px;
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
  margin-top: 20px !important;
  font-size: 13px !important;
}
.foot a {
  font-weight: 700;
}
.auth aside {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 48px;
  color: #fff;
  background: linear-gradient(150deg, #4f46e5, #7c3aed 55%, #6d28d9);
}
.auth aside > div {
  max-width: 420px;
}
.eyebrow {
  font: 500 11px 'JetBrains Mono';
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.7;
}
.auth aside h2 {
  font-size: 30px;
  line-height: 1.27;
  margin: 18px 0 30px;
}
.auth aside p {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}
.auth aside b {
  font-size: 12px;
  background: #ffffff29;
  padding: 7px 13px;
  border-radius: 20px;
}
@media (max-width: 850px) {
  .auth aside {
    display: none;
  }
  .auth > section {
    padding: 25px;
  }
}
</style>
