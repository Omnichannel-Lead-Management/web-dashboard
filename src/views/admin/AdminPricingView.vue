<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Tags, Sparkles } from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AppButton from '../../components/common/AppButton.vue'
import AppBadge from '../../components/common/AppBadge.vue'
import { useAdminStore } from '../../stores/admin'
import { formatMoney } from '../../services/billingFormat'
import { friendlyErrorMessage } from '../../services/displayText'

const store = useAdminStore()

/** A brand-new plan starts from the shape of a plan, not from blank fields. */
function emptyPlan() {
  return {
    name: '',
    description: '',
    currency: store.plans[0]?.currency || 'LKR',
    monthly_fee: 0,
    included_ai_requests: 0,
    price_per_ai_request: 0,
    included_conversations: 0,
    price_per_conversation: 0,
    included_messages: 0,
    price_per_message: 0,
    tax_percent: 0,
    is_default: false,
  }
}

const editingId = ref(null)
const creating = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive(emptyPlan())

const isEditing = computed(() => Boolean(editingId.value) || creating.value)

const FIELDS = [
  { key: 'monthly_fee', label: 'Monthly subscription', money: true },
  { key: 'included_ai_requests', label: 'AI requests included', money: false },
  { key: 'price_per_ai_request', label: 'Price per AI request', money: true },
  {
    key: 'included_conversations',
    label: 'Conversations included',
    money: false,
  },
  {
    key: 'price_per_conversation',
    label: 'Price per conversation',
    money: true,
  },
  { key: 'included_messages', label: 'Messages included', money: false },
  { key: 'price_per_message', label: 'Price per message', money: true },
  { key: 'tax_percent', label: 'Tax %', money: false },
]

function startCreate() {
  Object.assign(form, emptyPlan())
  editingId.value = null
  creating.value = true
  formError.value = ''
}

function startEdit(plan) {
  Object.assign(form, {
    name: plan.name,
    description: plan.description || '',
    currency: plan.currency,
    monthly_fee: plan.monthly_fee,
    included_ai_requests: plan.included_ai_requests,
    price_per_ai_request: plan.price_per_ai_request,
    included_conversations: plan.included_conversations,
    price_per_conversation: plan.price_per_conversation,
    included_messages: plan.included_messages,
    price_per_message: plan.price_per_message,
    tax_percent: plan.tax_percent,
    is_default: plan.is_default === 1,
  })
  editingId.value = plan.id
  creating.value = false
  formError.value = ''
}

function cancel() {
  editingId.value = null
  creating.value = false
  formError.value = ''
}

async function save() {
  if (saving.value) return
  formError.value = ''

  if (!form.name.trim()) {
    formError.value = 'Give the plan a name.'
    return
  }

  saving.value = true
  try {
    // Numbers come back from `type="number"` inputs as strings when the field
    // was typed into, so they are coerced here rather than at the API.
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      currency: form.currency.trim().toUpperCase(),
      is_default: form.is_default,
    }
    for (const field of FIELDS)
      payload[field.key] = Number(form[field.key]) || 0

    await store.savePlan(editingId.value, payload)
    cancel()
  } catch (error) {
    formError.value = friendlyErrorMessage(
      error,
      'Could not save those prices.',
    )
  } finally {
    saving.value = false
  }
}

async function makeDefault(plan) {
  try {
    await store.savePlan(plan.id, { is_default: true })
  } catch (error) {
    store.notify(
      friendlyErrorMessage(error, 'Could not set the default.'),
      'warning',
    )
  }
}

async function archive(plan) {
  try {
    await store.savePlan(plan.id, { archived: true })
  } catch (error) {
    store.notify(
      friendlyErrorMessage(error, 'Could not archive that plan.'),
      'warning',
    )
  }
}

onMounted(() => store.refreshPlans())
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <h1>Pricing</h1>
          <p>
            Rate cards businesses are billed on. Changing a price affects future
            invoices only — bills already issued keep the prices they were sent
            with.
          </p>
        </div>
        <AppButton v-if="!isEditing" @click="startCreate">
          <Plus :size="16" />
          New plan
        </AppButton>
      </header>

      <div class="stack">
        <section v-if="isEditing" class="card panel">
          <div class="section-head">
            <span class="section-icon"><Tags :size="19" /></span>
            <div>
              <h2>{{ creating ? 'New rate card' : 'Edit prices' }}</h2>
              <p>
                Set a monthly fee, then what each extra unit costs beyond its
                allowance.
              </p>
            </div>
          </div>

          <div class="form-grid">
            <label class="field name">
              Plan name
              <input v-model="form.name" type="text" maxlength="80" />
            </label>
            <label class="field">
              Currency
              <input v-model="form.currency" type="text" maxlength="8" />
            </label>
            <label class="field description">
              Description
              <input
                v-model="form.description"
                type="text"
                maxlength="500"
                placeholder="Shown to admins only."
              />
            </label>

            <label v-for="field in FIELDS" :key="field.key" class="field">
              {{ field.label }}
              <input
                v-model="form[field.key]"
                type="number"
                min="0"
                :step="field.money ? '0.01' : '1'"
              />
            </label>

            <label class="field checkbox">
              <input v-model="form.is_default" type="checkbox" />
              <span>Bill new businesses on this plan</span>
            </label>
          </div>

          <p v-if="formError" class="notice notice--danger" role="alert">
            {{ formError }}
          </p>

          <div class="actions">
            <AppButton variant="ghost" @click="cancel">Cancel</AppButton>
            <AppButton :loading="saving" @click="save">
              {{ creating ? 'Create plan' : 'Save prices' }}
            </AppButton>
          </div>
        </section>

        <section class="notice notice--info">
          <Sparkles :size="18" />
          <p>
            AI requests are the platform's own upstream cost, so they are
            metered per call and normally priced well above a plain message.
            Everything a tenant sends over its allowance is charged at the
            per-unit price below.
          </p>
        </section>

        <div v-if="store.plans.length" class="plans">
          <article v-for="plan in store.plans" :key="plan.id" class="card plan">
            <header>
              <div>
                <h2>{{ plan.name }}</h2>
                <p v-if="plan.description">{{ plan.description }}</p>
              </div>
              <AppBadge v-if="plan.is_default === 1" tone="primary">
                Default
              </AppBadge>
            </header>

            <p class="fee">
              <strong>
                {{ formatMoney(plan.monthly_fee, plan.currency) }}
              </strong>
              <span>per month</span>
            </p>

            <dl>
              <div class="highlight">
                <dt>AI request</dt>
                <dd>
                  {{ formatMoney(plan.price_per_ai_request, plan.currency) }}
                  <small>
                    {{ plan.included_ai_requests.toLocaleString() }} included
                  </small>
                </dd>
              </div>
              <div>
                <dt>Conversation</dt>
                <dd>
                  {{ formatMoney(plan.price_per_conversation, plan.currency) }}
                  <small>
                    {{ plan.included_conversations.toLocaleString() }} included
                  </small>
                </dd>
              </div>
              <div>
                <dt>Message</dt>
                <dd>
                  {{ formatMoney(plan.price_per_message, plan.currency) }}
                  <small>
                    {{ plan.included_messages.toLocaleString() }} included
                  </small>
                </dd>
              </div>
              <div v-if="plan.tax_percent > 0">
                <dt>Tax</dt>
                <dd>{{ plan.tax_percent }}%</dd>
              </div>
            </dl>

            <footer>
              <AppButton size="sm" variant="outline" @click="startEdit(plan)">
                Adjust prices
              </AppButton>
              <AppButton
                v-if="plan.is_default !== 1"
                size="sm"
                variant="ghost"
                @click="makeDefault(plan)"
              >
                Make default
              </AppButton>
              <AppButton
                v-if="plan.is_default !== 1"
                size="sm"
                variant="ghost"
                @click="archive(plan)"
              >
                Archive
              </AppButton>
            </footer>
          </article>
        </div>

        <div v-else-if="!store.loadingPlans" class="card empty-state">
          <span class="empty-icon"><Tags :size="22" /></span>
          <h3>No rate cards yet</h3>
          <p>
            Create one and new businesses will be billed on it automatically.
          </p>
          <AppButton @click="startCreate">Create a plan</AppButton>
        </div>
      </div>
    </div>
  </AdminShell>
</template>
<style scoped>
.page {
  max-width: 1150px;
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
  margin-bottom: 16px;
}
.form-grid .name,
.form-grid .description {
  grid-column: span 2;
}
.field input[type='text'],
.field input[type='number'] {
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
.field.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 9px;
  align-self: end;
  padding-bottom: 9px;
}
.field.checkbox input {
  width: 16px;
  height: 16px;
}
.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}
.plan {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.plan > header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}
.plan h2 {
  margin: 0;
  font-size: var(--fs-lg);
}
.plan header p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: var(--fs-sm);
}
.fee {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 7px;
}
.fee strong {
  font-size: 26px;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.fee span {
  color: var(--muted);
  font-size: var(--fs-sm);
}
dl {
  margin: 0;
  display: grid;
  gap: 8px;
}
dl > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
/* The AI row is the one that drives most bills, so it is set apart. */
dl > div.highlight {
  background: var(--primary-soft);
}
dt {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-2);
}
dd {
  margin: 0;
  text-align: right;
  font-size: var(--fs-base);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
dd small {
  display: block;
  font-weight: 500;
  font-size: var(--fs-2xs);
  color: var(--muted);
}
.plan footer {
  margin-top: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 620px) {
  .form-grid .name,
  .form-grid .description {
    grid-column: span 1;
  }
}
</style>
