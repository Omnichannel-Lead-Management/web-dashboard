<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck } from 'lucide-vue-next'
import { useAdminStore } from '../../stores/admin'
import AppButton from '../../components/common/AppButton.vue'
import { friendlyErrorMessage } from '../../services/displayText'

const router = useRouter()
const store = useAdminStore()

const form = reactive({ email: '', password: '' })
const validationError = ref('')
const submitting = ref(false)

async function submit() {
  if (submitting.value) return
  validationError.value = ''

  // Shape check only; whether the credentials are right is the gateway's answer.
  if (!/^\S+@\S+\.\S+$/.test(form.email) || !form.password) {
    validationError.value = 'Enter your admin email address and password.'
    return
  }

  submitting.value = true
  try {
    await store.login({ email: form.email, password: form.password })
    router.push('/admin')
  } catch (error) {
    validationError.value = friendlyErrorMessage(
      error,
      'We could not sign you in. Check your details and try again.',
    )
    form.password = ''
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <main class="auth">
    <section>
      <div class="form">
        <div class="brand">
          <i><ShieldCheck :size="20" /></i>
          <strong>
            Loop
            <em>Admin</em>
          </strong>
        </div>
        <h1>Platform console</h1>
        <p>
          Sign in to monitor usage and bill the businesses on your platform.
        </p>
        <form @submit.prevent="submit">
          <label class="field">
            Email
            <input
              v-model.trim="form.email"
              type="email"
              autocomplete="email"
              required
            />
          </label>
          <label class="field">
            Password
            <input
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
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
          Running a business on this platform?
          <RouterLink to="/login">Sign in there instead</RouterLink>
        </p>
      </div>
    </section>
    <aside>
      <div>
        <span class="eyebrow">Platform operations</span>
        <h2>Usage you can bill for, without reading anyone's messages.</h2>
        <p>
          <b>Per-tenant usage</b>
          <b>AI metering</b>
          <b>Invoices</b>
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
  background: #1c2033;
  color: #fff;
  border-radius: 12px;
  display: grid;
  place-items: center;
}
.brand strong {
  font-size: 23px;
}
.brand em {
  font-style: normal;
  font-weight: 500;
  color: var(--muted);
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
.field input {
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
}
.field input:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
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
  /* The tenant login is indigo; the console is slate, so the two are never
     confused at a glance. */
  background: linear-gradient(150deg, #1c2033, #2f3550 55%, #3b3f63);
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
