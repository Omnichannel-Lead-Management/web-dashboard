<script setup>
import { reactive, ref } from 'vue'
import { KeyRound } from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AppButton from '../../components/common/AppButton.vue'
import { useAdminStore } from '../../stores/admin'
import { adminApi } from '../../services/adminApi'
import { friendlyErrorMessage } from '../../services/displayText'

const store = useAdminStore()

const form = reactive({ current: '', next: '', confirm: '' })
const saving = ref(false)
const error = ref('')

async function submit() {
  if (saving.value) return
  error.value = ''

  if (form.next.length < 8) {
    error.value = 'The new password must be at least 8 characters.'
    return
  }
  if (form.next !== form.confirm) {
    error.value = 'The two new passwords do not match.'
    return
  }

  saving.value = true
  try {
    await adminApi.changePassword({
      current_password: form.current,
      new_password: form.next,
    })
    Object.assign(form, { current: '', next: '', confirm: '' })
    store.notify('Password changed.')
  } catch (err) {
    error.value = friendlyErrorMessage(err, 'Could not change your password.')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <h1>Your account</h1>
          <p>{{ store.admin?.email }}</p>
        </div>
      </header>

      <section class="card panel">
        <div class="section-head">
          <span class="section-icon"><KeyRound :size="19" /></span>
          <div>
            <h2>Change password</h2>
            <p>You stay signed in on this device after changing it.</p>
          </div>
        </div>

        <form @submit.prevent="submit">
          <label class="field">
            Current password
            <input
              v-model="form.current"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>
          <label class="field">
            New password
            <input
              v-model="form.next"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </label>
          <label class="field">
            Confirm new password
            <input
              v-model="form.confirm"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </label>

          <p v-if="error" class="notice notice--danger" role="alert">
            {{ error }}
          </p>

          <div class="actions">
            <AppButton :loading="saving">Change password</AppButton>
          </div>
        </form>
      </section>
    </div>
  </AdminShell>
</template>
<style scoped>
.page {
  max-width: 560px;
  margin: 0 auto;
}
.panel {
  padding: 20px;
}
form {
  display: grid;
  gap: 14px;
}
.field input {
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
}
.field input:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
