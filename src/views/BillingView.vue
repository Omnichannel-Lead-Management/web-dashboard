<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw, ReceiptText, Info } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import AppButton from '../components/common/AppButton.vue'
import AnalyticsKpiGrid from '../components/analytics/AnalyticsKpiGrid.vue'
import InvoiceStatusBadge from '../components/admin/InvoiceStatusBadge.vue'
import { useAppStore } from '../stores/app'
import { gatewayApi } from '../services/gatewayApi'
import {
  allowanceUsage,
  formatCount,
  formatDate,
  formatMoney,
  formatPeriod,
} from '../services/billingFormat'
import { friendlyErrorMessage } from '../services/displayText'

const store = useAppStore()

const billing = ref(null)
const loading = ref(false)
const error = ref('')
const openInvoiceId = ref('')

const plan = computed(() => billing.value?.plan || null)
const usage = computed(() => billing.value?.usage || null)
const currency = computed(() => plan.value?.currency || 'LKR')

const kpis = computed(() => {
  if (!usage.value) return []
  return [
    {
      label: 'Customers',
      value: formatCount(usage.value.total_contacts),
      note: `${formatCount(usage.value.new_contacts)} new this period`,
    },
    { label: 'Conversations', value: formatCount(usage.value.conversations) },
    { label: 'Messages', value: formatCount(usage.value.messages) },
    {
      label: 'AI requests',
      value: formatCount(usage.value.ai_requests),
      note: 'Automatic replies, transcriptions and photo reading',
    },
  ]
})

/** What this period would cost so far, so the next bill is never a surprise. */
const estimate = computed(() => {
  if (!plan.value || !usage.value) return null

  const rows = [
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
  ].map((row) => {
    const meter = allowanceUsage(row.used, row.included)
    return { ...row, meter, amount: meter.over * row.price }
  })

  const subtotal =
    plan.value.monthly_fee + rows.reduce((sum, row) => sum + row.amount, 0)
  const tax = (subtotal * plan.value.tax_percent) / 100

  return { rows, subtotal, tax, total: subtotal + tax }
})

function toggleInvoice(id) {
  openInvoiceId.value = openInvoiceId.value === id ? '' : id
}

async function load() {
  if (!store.businessId) return
  loading.value = true
  error.value = ''
  try {
    billing.value = await gatewayApi.getBilling(store.businessId)
  } catch (err) {
    error.value = friendlyErrorMessage(
      err,
      'Could not load your billing details.',
    )
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => store.businessId, load)
</script>
<template>
  <AppShell>
    <div class="page">
      <header class="page-title">
        <div>
          <h1>Billing</h1>
          <p>
            Your plan, what you have used
            <template v-if="billing">
              between {{ formatPeriod(billing.period.from, billing.period.to) }}
            </template>
            , and the invoices you have been sent.
          </p>
        </div>
        <AppButton variant="outline" :disabled="loading" @click="load">
          <RefreshCw :size="15" :class="{ spin: loading }" />
          Refresh
        </AppButton>
      </header>

      <p v-if="error" class="notice notice--danger" role="alert">{{ error }}</p>
      <p v-else-if="loading && !billing" class="empty">
        Loading your billing details…
      </p>

      <div v-else-if="billing" class="stack">
        <AnalyticsKpiGrid :items="kpis" />

        <section v-if="plan" class="card panel">
          <div class="section-head">
            <div>
              <h2>Your plan · {{ plan.name }}</h2>
              <p v-if="plan.description">{{ plan.description }}</p>
              <p v-else>
                {{ formatMoney(plan.monthly_fee, currency) }} per month, plus
                anything you use beyond your included allowances.
              </p>
            </div>
          </div>

          <div v-if="estimate" class="allowances">
            <article v-for="row in estimate.rows" :key="row.label">
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
                  {{ formatCount(row.meter.over) }} over ·
                  {{ formatMoney(row.amount, currency) }} so far
                </template>
                <template v-else-if="row.included">
                  Included in your plan
                </template>
                <template v-else>
                  {{ formatMoney(row.price, currency) }} each
                </template>
              </small>
            </article>
          </div>

          <p v-if="estimate" class="estimate">
            <span>Usage so far this period</span>
            <strong>{{ formatMoney(estimate.total, currency) }}</strong>
          </p>
          <!-- An estimate is not a bill, and saying so avoids an awkward
               conversation when the final invoice differs. -->
          <p class="notice notice--info">
            <Info :size="18" />
            An estimate from your usage to date. Your actual invoice is issued
            by the platform at the end of the billing period.
          </p>
        </section>

        <section class="card panel">
          <div class="section-head">
            <span class="section-icon"><ReceiptText :size="19" /></span>
            <div>
              <h2>Invoices</h2>
              <p v-if="billing.outstanding_total > 0">
                {{ formatMoney(billing.outstanding_total, currency) }} awaiting
                payment.
              </p>
              <p v-else>Nothing outstanding.</p>
            </div>
          </div>

          <p v-if="!billing.invoices.length" class="empty">
            You have not been invoiced yet.
          </p>

          <ul v-else class="invoices">
            <li v-for="invoice in billing.invoices" :key="invoice.id">
              <button
                class="row"
                :aria-expanded="openInvoiceId === invoice.id"
                @click="toggleInvoice(invoice.id)"
              >
                <span class="num mono">{{ invoice.number }}</span>
                <span class="period">
                  {{ formatPeriod(invoice.period_start, invoice.period_end) }}
                </span>
                <InvoiceStatusBadge :status="invoice.status" />
                <span class="amount mono">
                  {{ formatMoney(invoice.total, invoice.currency) }}
                </span>
              </button>

              <div v-if="openInvoiceId === invoice.id" class="detail">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="line in invoice.line_items" :key="line.id">
                      <td>{{ line.description }}</td>
                      <td class="mono">{{ formatCount(line.quantity) }}</td>
                      <td class="mono">
                        {{ formatMoney(line.unit_price, invoice.currency) }}
                      </td>
                      <td class="mono">
                        {{ formatMoney(line.amount, invoice.currency) }}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr v-if="invoice.tax_percent > 0">
                      <td colspan="3">Tax ({{ invoice.tax_percent }}%)</td>
                      <td class="mono">
                        {{ formatMoney(invoice.tax, invoice.currency) }}
                      </td>
                    </tr>
                    <tr class="total">
                      <td colspan="3">Total</td>
                      <td class="mono">
                        {{ formatMoney(invoice.total, invoice.currency) }}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p v-if="invoice.notes" class="notes">{{ invoice.notes }}</p>
                <p class="meta">
                  Issued {{ formatDate(invoice.sent_at || invoice.issued_at) }}
                  <template v-if="invoice.due_date">
                    · due {{ formatDate(invoice.due_date) }}
                  </template>
                  <template v-if="invoice.paid_at">
                    · paid {{ formatDate(invoice.paid_at) }}
                  </template>
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </AppShell>
</template>
<style scoped>
.page {
  max-width: 1000px;
  margin: 0 auto;
}
.stack {
  display: grid;
  gap: 16px;
}
.panel {
  padding: 20px;
}

.allowances {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
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
.bar.over i {
  background: var(--warning);
}
.allowances small {
  display: block;
  margin-top: 6px;
  font-size: var(--fs-xs);
  color: var(--muted);
}
.estimate {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0 14px;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
}
.estimate span {
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.estimate strong {
  font-size: 24px;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.invoices {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.row {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 14px;
  padding: 13px 15px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: left;
  font: inherit;
  font-size: var(--fs-sm);
  transition: background var(--dur) var(--ease);
}
.row:hover {
  background: var(--surface-2);
}
.num {
  font-weight: 700;
}
.period {
  color: var(--muted);
}
.amount {
  font-weight: 700;
  font-size: var(--fs-md);
}

.detail {
  padding: 4px 15px 16px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  text-align: left;
  color: var(--muted);
  font-size: var(--fs-2xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-soft);
}
th:not(:first-child),
td:not(:first-child) {
  text-align: right;
}
td {
  padding: 10px;
  border-top: 1px solid var(--border-soft);
  font-size: var(--fs-sm);
}
tfoot .total td {
  font-weight: 800;
  border-top: 2px solid var(--border-strong);
}
.notes {
  margin: 14px 0 0;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-size: var(--fs-sm);
  line-height: 1.6;
  white-space: pre-wrap;
}
.meta {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: var(--fs-xs);
}

@media (max-width: 620px) {
  .row {
    grid-template-columns: 1fr auto;
  }
  .period {
    grid-column: 1 / -1;
  }
}
</style>
