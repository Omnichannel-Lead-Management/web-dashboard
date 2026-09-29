<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ShieldCheck, UserPlus } from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AppButton from '../../components/common/AppButton.vue'
import AppBadge from '../../components/common/AppBadge.vue'
import { useAdminStore } from '../../stores/admin'
import { adminApi } from '../../services/adminApi'
import { formatDate } from '../../services/billingFormat'
import { friendlyErrorMessage } from '../../services/displayText'

const store = useAdminStore()

const form = reactive({ email: '', name: '', password: '', role: 'staff' })
const creating = ref(false)
const error = ref('')
const busyId = ref('')

async function load() {
  try {
    await store.refreshAdmins()
  } catch (err) {
    error.value = friendlyErrorMessage(err, 'Could not load the admin list.')
  }
}

async function create() {
  if (creating.value) return
  error.value = ''

  if (!/^\S+@\S+\.\S+$/.test(form.email)) {
    error.value = 'Enter a valid email address.'
    return
  }
  if (form.password.length < 8) {
    error.value = 'The password must be at least 8 characters.'
    return
  }

  creating.value = true
  try {
    await adminApi.createAdmin({
      email: form.email,
      name: form.name || undefined,
      password: form.password,
      role: form.role,
    })
    Object.assign(form, { email: '', name: '', password: '', role: 'staff' })
    store.notify('Admin added.')
    await load()
  } catch (err) {
    error.value = friendlyErrorMessage(err, 'Could not add that admin.')
  } finally {
    creating.value = false
  }
}

async function setActive(admin, active) {
  busyId.value = admin.id
  try {
    await adminApi.updateAdmin(admin.id, { is_active: active })
    store.notify(active ? 'Admin reactivated.' : 'Admin deactivated.')
    await load()
  } catch (err) {
    store.notify(friendlyErrorMessage(err, 'That did not work.'), 'warning')
  } finally {
    busyId.value = ''
  }
}

onMounted(load)
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <h1>Admin team</h1>
          <p>
            Who can sign in to this console. Owners can manage the team; billing
            admins can do everything else.
          </p>
        </div>
      </header>

      <div class="stack">
        <section class="card panel">
          <div class="section-head">
            <span class="section-icon"><UserPlus :size="19" /></span>
            <div>
              <h2>Add an admin</h2>
              <p>They sign in at /admin/login with this email and password.</p>
            </div>
          </div>

          <div class="form-grid">
            <label class="field">
              Email
              <input
                v-model.trim="form.email"
                type="email"
                autocomplete="off"
              />
            </label>
            <label class="field">
              Name
              <input v-model.trim="form.name" type="text" maxlength="120" />
            </label>
            <label class="field">
              Password
              <input
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                minlength="8"
              />
              <small class="field-hint">At least 8 characters.</small>
            </label>
            <label class="field">
              Role
              <select v-model="form.role">
                <option value="staff">Billing admin</option>
                <option value="owner">Owner admin</option>
              </select>
            </label>
          </div>

          <p v-if="error" class="notice notice--danger" role="alert">
            {{ error }}
          </p>

          <div class="actions">
            <AppButton :loading="creating" @click="create">Add admin</AppButton>
          </div>
        </section>

        <div class="table card">
          <table>
            <thead>
              <tr>
                <th>Admin</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last signed in</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="admin in store.admins" :key="admin.id">
                <td>
                  <span class="who">
                    <strong>{{ admin.name || admin.email }}</strong>
                    <small>{{ admin.email }}</small>
                  </span>
                </td>
                <td>
                  <AppBadge
                    :tone="admin.role === 'owner' ? 'primary' : 'neutral'"
                  >
                    {{ admin.role === 'owner' ? 'Owner' : 'Billing' }}
                  </AppBadge>
                </td>
                <td>
                  <AppBadge :tone="admin.is_active ? 'success' : 'lost'">
                    {{ admin.is_active ? 'Active' : 'Disabled' }}
                  </AppBadge>
                </td>
                <td class="muted">
                  {{
                    admin.last_login_at
                      ? formatDate(admin.last_login_at)
                      : 'Never'
                  }}
                </td>
                <td class="right">
                  <!-- The gateway also refuses this, but not offering it at all
                       is clearer than offering it and being told no. -->
                  <AppButton
                    v-if="admin.id !== store.admin?.id"
                    size="sm"
                    variant="outline"
                    :loading="busyId === admin.id"
                    @click="setActive(admin, !admin.is_active)"
                  >
                    {{ admin.is_active ? 'Deactivate' : 'Reactivate' }}
                  </AppButton>
                  <span v-else class="muted you">You</span>
                </td>
              </tr>
              <tr v-if="!store.admins.length">
                <td colspan="5" class="muted">
                  <ShieldCheck :size="15" />
                  No admins loaded.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AdminShell>
</template>
<style scoped>
.page {
  max-width: 950px;
  margin: 0 auto;
}
.stack {
  display: grid;
  gap: 16px;
}
.panel {
  padding: 20px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}
.field input,
.field select {
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
}
.field input:focus-visible,
.field select:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.table {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}
th {
  text-align: left;
  color: var(--muted);
  font-size: var(--fs-2xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 13px 17px;
  background: #fbfbfd;
  border-bottom: 1px solid var(--border-soft);
}
td {
  padding: 13px 17px;
  border-top: 1px solid var(--border-soft);
  font-size: var(--fs-sm);
}
.who {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.who small {
  font-size: 10.5px;
  color: var(--muted);
}
.right {
  text-align: right;
}
.you {
  font-size: var(--fs-xs);
  font-weight: 700;
}
</style>
