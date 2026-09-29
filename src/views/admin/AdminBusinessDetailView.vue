<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, RefreshCw, ReceiptText, Lock } from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AdminPeriodPicker from '../../components/admin/AdminPeriodPicker.vue'
import AppButton from '../../components/common/AppButton.vue'
import AppBadge from '../../components/common/AppBadge.vue'
import AnalyticsKpiGrid from '../../components/analytics/AnalyticsKpiGrid.vue'
import AnalyticsTrend from '../../components/analytics/AnalyticsTrend.vue'
import AnalyticsDistribution from '../../components/analytics/AnalyticsDistribution.vue'
import InvoiceStatusBadge from '../../components/admin/InvoiceStatusBadge.vue'
import { useAdminStore, previousMonthPeriod } from '../../stores/admin'
import { adminApi } from '../../services/adminApi'
import {
  allowanceUsage,
  formatCount,
  formatDate,
  formatMoney,
  formatPeriod,
} from '../../services/billingFormat'
import { friendlyErrorMessage } from '../../services/displayText'

const route = useRoute()
const router = useRouter()
const store = useAdminStore()

const businessId = computed(() => String(route.params.id))
const detail = computed(() => store.businessDetail)
const plan = computed(() => detail.value?.plan || null)
const usage = computed(() => detail.value?.usage || null)

const AI_KIND_LABELS = {
  ai_reply: 'Chatbot replies',
  ai_voice: 'Voice transcription',
  ai_vision: 'Photo understanding',
  ai_other: 'Other AI',
}

const kpis = computed(() => {
  if (!usage.value) return []
  return [
    {
      label: 'Customers (all time)',
      value: formatCount(usage.value.total_contacts),
      note: `${formatCount(usage.value.new_contacts)} new this period`,
    },
    { label: 'Conversations', value: formatCount(usage.value.conversations) },
    {
      label: 'Messages',
      value: formatCount(usage.value.messages),
      note: `${formatCount(usage.value.inbound_messages)} in · ${formatCount(
        usage.value.outbound_messages,
      )} out`,
    },
    {
      label: 'AI requests',
      value: formatCount(usage.value.ai_requests),
      note: 'Billed at the AI rate',
    },
  ]
})

const aiBreakdown = computed(() =>
  Object.entries(usage.value?.ai_by_kind || {})
    .filter(([, value]) => value > 0)
    .map(([kind, value]) => ({
      category: AI_KIND_LABELS[kind] || kind,
      value,
    })),
)

/** Progress against each allowance, which is what turns usage into a charge. */
const allowances = computed(() => {
  if (!plan.value || !usage.value) return []

  return [
    {
      label: 'AI requests',
      used: usage.value.ai_requests,
      included: plan.value.included_ai_requests,
      price: plan.value.price_per_ai_request,
    },
    {
      label: 'Conversations',
      used: usage.value.conversations,
      included: plan.value.included_conversations,
      price: plan.value.price_per_conversation,
    },
    {
      label: 'Messages',
      used: usage.value.messages,
      included: plan.value.included_messages,
      price: plan.value.price_per_message,
    },
  ].map((row) => ({ ...row, meter: allowanceUsage(row.used, row.included) }))
})

/* ── Raising an invoice ── */

const invoiceForm = reactive({
  ...previousMonthPeriod(),
  due_date: '',
  notes: '',
})
const preview = ref(null)
const previewError = ref('')
const previewing = ref(false)
const creating = ref(false)

const periodValid = computed(
  () =>
    invoiceForm.from <= invoiceForm.to &&
    Boolean(invoiceForm.from && invoiceForm.to),
)

async function loadPreview() {
  if (!periodValid.value || previewing.value) return
  previewing.value = true
  previewError.value = ''
  try {
    const body = await adminApi.previewInvoice({
      business_id: businessId.value,
      period_start: invoiceForm.from,
      period_end: invoiceForm.to,
    })
    preview.value = body.preview
  } catch (error) {
    preview.value = null
    previewError.value = friendlyErrorMessage(
      error,
      'Could not price that period.',
    )
  } finally {
    previewing.value = false
  }
}

async function createInvoice() {
  if (!periodValid.value || creating.value) return
  creating.value = true
  try {
    const invoice = await store.createInvoice({
      business_id: businessId.value,
      period_start: invoiceForm.from,
      period_end: invoiceForm.to,
      due_date: invoiceForm.due_date || null,
      notes: invoiceForm.notes || null,
    })
    router.push(`/admin/invoices/${invoice.id}`)
  } catch (error) {
    previewError.value = friendlyErrorMessage(
      error,
      'Could not create the invoice.',
    )
  } finally {
    creating.value = false
  }
}

/* ── Plan assignment ── */

const assigning = ref(false)

async function assignPlan(event) {
  assigning.value = true
  try {
    await store.assignPlan(businessId.value, event.target.value)
  } finally {
    assigning.value = false
  }
}

async function toggleBilling() {
  await store.setBillingActive(
    businessId.value,
    !detail.value.business.billing_active,
  )
  await store.loadBusiness(businessId.value)
}

function changePeriod(period) {
  store.setPeriod(period)
  store.loadBusiness(businessId.value)
}

onMounted(() => {
  store.loadBusiness(businessId.value)
  store.refreshPlans()
  loadPreview()
})

watch(businessId, (id) => {
  store.loadBusiness(id)
  loadPreview()
})
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <RouterLink to="/admin/businesses" class="back">
            <ArrowLeft :size="15" />
            All businesses
          </RouterLink>
          <h1>{{ detail?.business?.name || 'Business' }}</h1>
          <p>
            {{ detail?.business?.owner_email || businessId }} ·
            {{ detail?.business?.sector }} · joined
            {{ formatDate(detail?.business?.created_at) }}
          </p>
        </div>
        <AppButton
          variant="outline"
          :disabled="store.loadingBusinessDetail"
          @click="store.loadBusiness(businessId)"
        >
          <RefreshCw
            :size="15"
            :class="{ spin: store.loadingBusinessDetail }"
          />
          Refresh
        </AppButton>
      </header>

      <div
        v-if="store.loadingBusinessDetail && !detail"
        class="loading"
        role="status"
      >
        <RefreshCw class="spin" :size="18" />
        Loading this tenant…
      </div>

      <div v-else-if="detail" class="stack">
        <AdminPeriodPicker :period="store.period" @change="changePeriod" />

        <AnalyticsKpiGrid :items="kpis" />

        <section class="card panel">
          <div class="section-head">
            <span class="section-icon"><Lock :size="19" /></span>
            <div>
              <h2>Plan &amp; billing</h2>
              <p>
                What this tenant is charged, and whether billing is running.
              </p>
            </div>
            <AppButton
              :variant="detail.business.billing_active ? 'outline' : 'primary'"
              size="sm"
              @click="toggleBilling"
            >
              {{
                detail.business.billing_active
                  ? 'Pause billing'
                  : 'Resume billing'
              }}
            </AppButton>
          </div>

          <div class="plan-grid">
            <label class="field">
              Rate card
              <select
                :value="detail.business.pricing_plan_id || ''"
                :disabled="assigning"
                @change="assignPlan"
              >
                <option value="">Platform default</option>
                <option
                  v-for="option in store.plans"
                  :key="option.id"
                  :value="option.id"
                >
                  {{ option.name }}
                </option>
              </select>
              <small class="field-hint">
                Change prices for everyone under
                <RouterLink to="/admin/pricing">Pricing</RouterLink>
                .
              </small>
            </label>

            <div v-if="plan" class="rates">
              <div>
                <span>Subscription</span>
                <b>{{ formatMoney(plan.monthly_fee, plan.currency) }}</b>
              </div>
              <div>
                <span>Per AI request</span>
                <b>
                  {{ formatMoney(plan.price_per_ai_request, plan.currency) }}
                </b>
              </div>
              <div>
                <span>Per conversation</span>
                <b>
                  {{ formatMoney(plan.price_per_conversation, plan.currency) }}
                </b>
              </div>
              <div>
                <span>Per message</span>
                <b>{{ formatMoney(plan.price_per_message, plan.currency) }}</b>
              </div>
            </div>
          </div>

          <div v-if="allowances.length" class="allowances">
            <article v-for="row in allowances" :key="row.label">
              <header>
                <strong>{{ row.label }}</strong>
                <span class="mono">
                  {{ formatCount(row.used) }}
                  <template v-if="row.included">
                    / {{ formatCount(row.included) }}
                  </template>
                </span>
              </header>
              <div class="bar" :class="{ over: row.meter.over > 0 }">
                <i :style="{ width: `${row.meter.percent}%` }" />
              </div>
              <small>
                <template v-if="row.meter.over > 0">
                  {{ formatCount(row.meter.over) }} over the allowance ·
                  {{ formatMoney(row.meter.over * row.price, plan.currency) }}
                  billable
                </template>
                <template v-else-if="row.included">
                  Within the allowance
                </template>
                <template v-else>
                  No allowance — every unit is billable
                </template>
              </small>
            </article>
          </div>
        </section>

        <div class="sections">
          <AnalyticsTrend
            title="AI requests per day"
            :points="detail.ai_trend"
          />
          <AnalyticsDistribution title="AI by kind" :rows="aiBreakdown" />
        </div>

        <section class="card panel">
          <div class="section-head">
            <span class="section-icon"><ReceiptText :size="19" /></span>
            <div>
              <h2>Raise an invoice</h2>
              <p>
                Price a period's metered usage, check it, then issue the bill.
              </p>
            </div>
          </div>

          <div class="invoice-form">
            <label class="field">
              Period start
              <input
                v-model="invoiceForm.from"
                type="date"
                @change="loadPreview"
              />
            </label>
            <label class="field">
              Period end
              <input
                v-model="invoiceForm.to"
                type="date"
                @change="loadPreview"
              />
            </label>
            <label class="field">
              Due date
              <input v-model="invoiceForm.due_date" type="date" />
              <small class="field-hint">Optional.</small>
            </label>
            <label class="field notes">
              Note on the invoice
              <textarea
                v-model="invoiceForm.notes"
                rows="2"
                placeholder="Optional message shown to the business."
              />
            </label>
          </div>

          <p v-if="!periodValid" class="notice notice--warning">
            The period start must be on or before the period end.
          </p>
          <p
            v-else-if="previewError"
            class="notice notice--danger"
            role="alert"
          >
            {{ previewError }}
          </p>

          <div v-if="preview" class="preview">
            <table>
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(line, index) in preview.line_items" :key="index">
                  <td>{{ line.description }}</td>
                  <td class="mono">{{ formatCount(line.quantity) }}</td>
                  <td class="mono">
                    {{ formatMoney(line.unit_price, preview.currency) }}
                  </td>
                  <td class="mono">
                    {{ formatMoney(line.amount, preview.currency) }}
                  </td>
                </tr>
                <tr v-if="!preview.line_items.length">
                  <td colspan="4" class="muted">
                    Nothing billable in this period on the current rate card.
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr v-if="preview.tax_percent > 0">
                  <td colspan="3">Tax ({{ preview.tax_percent }}%)</td>
                  <td class="mono">
                    {{ formatMoney(preview.tax, preview.currency) }}
                  </td>
                </tr>
                <tr class="total">
                  <td colspan="3">Total</td>
                  <td class="mono">
                    {{ formatMoney(preview.total, preview.currency) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="actions">
            <AppButton
              variant="outline"
              :loading="previewing"
              @click="loadPreview"
            >
              Recalculate
            </AppButton>
            <AppButton
              :loading="creating"
              :disabled="!periodValid"
              @click="createInvoice"
            >
              Create draft invoice
            </AppButton>
          </div>
        </section>

        <section class="card panel">
          <div class="section-head">
            <div>
              <h2>Invoice history</h2>
              <p>Every bill raised for this tenant.</p>
            </div>
          </div>

          <p v-if="!detail.invoices.length" class="empty">
            No invoices yet for this business.
          </p>
          <div v-else class="table">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Period</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="invoice in detail.invoices"
                  :key="invoice.id"
                  tabindex="0"
                  @click="$router.push(`/admin/invoices/${invoice.id}`)"
                  @keydown.enter="$router.push(`/admin/invoices/${invoice.id}`)"
                >
                  <td class="mono">{{ invoice.number }}</td>
                  <td>
                    {{ formatPeriod(invoice.period_start, invoice.period_end) }}
                  </td>
                  <td class="mono">
                    {{ formatMoney(invoice.total, invoice.currency) }}
                  </td>
                  <td><InvoiceStatusBadge :status="invoice.status" /></td>
                  <td class="muted">
                    {{ invoice.sent_at ? formatDate(invoice.sent_at) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </AdminShell>
</template>
<style scoped>
.page {
  max-width: 1250px;
  margin: 0 auto;
}
.stack {
  display: grid;
  gap: 16px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.back:hover {
  color: var(--primary);
}
.panel {
  padding: 20px;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px;
  color: var(--muted);
}
.sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.plan-grid {
  display: grid;
  grid-template-columns: minmax(220px, 300px) 1fr;
  gap: 20px;
  align-items: start;
}
.rates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.rates > div {
  padding: 11px 13px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  display: grid;
  gap: 3px;
}
.rates span {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 600;
}
.rates b {
  font-size: var(--fs-md);
  font-variant-numeric: tabular-nums;
}

.allowances {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--border-soft);
}
.allowances header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: var(--fs-sm);
  margin-bottom: 7px;
}
.bar {
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--surface-3);
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: inherit;
}
/* Over the allowance is the state that costs money, so it is coloured. */
.bar.over i {
  background: var(--warning);
}
.allowances small {
  display: block;
  margin-top: 6px;
  font-size: var(--fs-xs);
  color: var(--muted);
}

.invoice-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}
.invoice-form .notes {
  grid-column: 1 / -1;
}
.field input,
.field select,
.field textarea {
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
  resize: vertical;
}
.field input:focus-visible,
.field select:focus-visible,
.field textarea:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}

.preview,
.table {
  overflow: auto;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 520px;
}
th {
  text-align: left;
  color: var(--muted);
  font-size: var(--fs-2xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 11px 15px;
  background: #fbfbfd;
  border-bottom: 1px solid var(--border-soft);
}
td {
  padding: 11px 15px;
  border-top: 1px solid var(--border-soft);
  font-size: var(--fs-sm);
}
tfoot td {
  background: var(--surface-2);
  font-weight: 600;
}
tfoot .total td {
  font-size: var(--fs-md);
  font-weight: 800;
}
.table tbody tr {
  cursor: pointer;
}
.table tbody tr:hover {
  background: #fafaff;
}
.table tbody tr:focus-visible {
  outline: none;
  background: var(--primary-soft);
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
}

@media (max-width: 860px) {
  .plan-grid {
    grid-template-columns: 1fr;
  }
  .sections {
    grid-template-columns: 1fr;
  }
}
</style>
