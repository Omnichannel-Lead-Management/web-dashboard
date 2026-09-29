<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Send,
  Check,
  Ban,
  Trash2,
  AlertCircle,
} from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AppButton from '../../components/common/AppButton.vue'
import InvoiceStatusBadge from '../../components/admin/InvoiceStatusBadge.vue'
import { useAdminStore } from '../../stores/admin'
import { adminApi } from '../../services/adminApi'
import {
  formatCount,
  formatDate,
  formatMoney,
  formatPeriod,
} from '../../services/billingFormat'
import { friendlyErrorMessage } from '../../services/displayText'

const route = useRoute()
const router = useRouter()
const store = useAdminStore()

const invoice = ref(null)
const loading = ref(false)
const busy = ref('')
const error = ref('')

const invoiceId = computed(() => String(route.params.id))
const usage = computed(() => {
  if (!invoice.value?.usage_json) return null
  try {
    return JSON.parse(invoice.value.usage_json)
  } catch {
    // A snapshot we cannot read is not worth breaking the page over.
    return null
  }
})

const isDraft = computed(() => invoice.value?.status === 'draft')
const isVoid = computed(() => invoice.value?.status === 'void')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const body = await adminApi.getInvoice(invoiceId.value)
    invoice.value = body.invoice
  } catch (err) {
    error.value = friendlyErrorMessage(err, 'Could not load that invoice.')
  } finally {
    loading.value = false
  }
}

async function run(action, work) {
  if (busy.value) return
  busy.value = action
  error.value = ''
  try {
    await work()
  } catch (err) {
    error.value = friendlyErrorMessage(err, 'That did not work.')
  } finally {
    busy.value = ''
  }
}

const send = () =>
  run('send', async () => {
    const body = await store.sendInvoice(invoiceId.value)
    invoice.value = body.invoice
  })

const markPaid = () =>
  run('paid', async () => {
    invoice.value = await store.setInvoiceStatus(invoiceId.value, 'paid')
  })

const voidInvoice = () =>
  run('void', async () => {
    invoice.value = await store.setInvoiceStatus(invoiceId.value, 'void')
  })

const discard = () =>
  run('delete', async () => {
    await store.deleteInvoice(invoiceId.value)
    router.push('/admin/invoices')
  })

onMounted(load)
watch(invoiceId, load)
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <RouterLink to="/admin/invoices" class="back">
            <ArrowLeft :size="15" />
            All invoices
          </RouterLink>
          <h1>
            {{ invoice?.number || 'Invoice' }}
            <InvoiceStatusBadge v-if="invoice" :status="invoice.status" />
          </h1>
          <p v-if="invoice">
            <RouterLink :to="`/admin/businesses/${invoice.business_id}`">
              {{ invoice.business_name || invoice.business_id }}
            </RouterLink>
            · {{ formatPeriod(invoice.period_start, invoice.period_end) }}
          </p>
        </div>
      </header>

      <p v-if="error" class="notice notice--danger" role="alert">{{ error }}</p>
      <p v-if="loading && !invoice" class="empty">Loading…</p>

      <div v-else-if="invoice" class="stack">
        <!-- The invoice went out but the email did not: the admin has to know,
             because the customer will not have been told. -->
        <section v-if="invoice.send_error" class="notice notice--warning">
          <AlertCircle :size="18" />
          <p>
            <strong>This invoice was issued, but not emailed.</strong>
            {{ invoice.send_error }}
            The business can still see it under Billing in their own dashboard.
          </p>
        </section>

        <section class="card sheet">
          <header class="sheet-head">
            <div>
              <span class="label">Billed to</span>
              <strong>
                {{ invoice.business_name || invoice.business_id }}
              </strong>
              <small>
                {{ invoice.owner_email || 'No owner email on file' }}
              </small>
            </div>
            <div class="right">
              <span class="label">Amount due</span>
              <strong class="amount">
                {{ formatMoney(invoice.total, invoice.currency) }}
              </strong>
              <small>
                {{
                  invoice.due_date
                    ? `Due ${formatDate(invoice.due_date)}`
                    : 'No due date'
                }}
              </small>
            </div>
          </header>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit price</th>
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
              <tr v-if="!invoice.line_items.length">
                <td colspan="4" class="muted">
                  Nothing was billable in this period.
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Subtotal</td>
                <td class="mono">
                  {{ formatMoney(invoice.subtotal, invoice.currency) }}
                </td>
              </tr>
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

          <footer class="meta">
            <span>
              Plan:
              <b>{{ invoice.plan_name || '—' }}</b>
            </span>
            <span>
              Created:
              <b>{{ formatDate(invoice.created_at) }}</b>
            </span>
            <span v-if="invoice.sent_at">
              Sent:
              <b>{{ formatDate(invoice.sent_at) }}</b>
            </span>
            <span v-if="invoice.paid_at">
              Paid:
              <b>{{ formatDate(invoice.paid_at) }}</b>
            </span>
            <span v-if="invoice.created_by">
              By:
              <b>{{ invoice.created_by }}</b>
            </span>
          </footer>
        </section>

        <section v-if="usage" class="card panel">
          <div class="section-head">
            <div>
              <h2>Usage this invoice was priced from</h2>
              <p>
                The counts recorded when the bill was raised, kept for
                reconciliation.
              </p>
            </div>
          </div>
          <dl class="usage">
            <div class="highlight">
              <dt>AI requests</dt>
              <dd>{{ formatCount(usage.ai_requests) }}</dd>
            </div>
            <div>
              <dt>Conversations</dt>
              <dd>{{ formatCount(usage.conversations) }}</dd>
            </div>
            <div>
              <dt>Messages</dt>
              <dd>{{ formatCount(usage.messages) }}</dd>
            </div>
            <div>
              <dt>New customers</dt>
              <dd>{{ formatCount(usage.new_contacts) }}</dd>
            </div>
            <div>
              <dt>Customers total</dt>
              <dd>{{ formatCount(usage.total_contacts) }}</dd>
            </div>
          </dl>
        </section>

        <section class="actions card panel">
          <div>
            <h2>
              {{
                isDraft
                  ? 'Ready to send?'
                  : isVoid
                    ? 'This invoice is void'
                    : 'Issued'
              }}
            </h2>
            <p>
              {{
                isDraft
                  ? 'Sending marks the invoice issued and emails it to the owner. It also appears on their Billing page.'
                  : isVoid
                    ? 'A void invoice is kept as a record and is no longer owed.'
                    : 'The business can see this invoice on their Billing page.'
              }}
            </p>
          </div>
          <div class="buttons">
            <AppButton v-if="!isVoid" :loading="busy === 'send'" @click="send">
              <Send :size="15" />
              {{ isDraft ? 'Send to business' : 'Resend email' }}
            </AppButton>
            <AppButton
              v-if="invoice.status === 'sent'"
              variant="outline"
              :loading="busy === 'paid'"
              @click="markPaid"
            >
              <Check :size="15" />
              Mark paid
            </AppButton>
            <AppButton
              v-if="!isDraft && !isVoid"
              variant="danger"
              :loading="busy === 'void'"
              @click="voidInvoice"
            >
              <Ban :size="15" />
              Void
            </AppButton>
            <AppButton
              v-if="isDraft"
              variant="danger"
              :loading="busy === 'delete'"
              @click="discard"
            >
              <Trash2 :size="15" />
              Discard draft
            </AppButton>
          </div>
        </section>
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
.page-title h1 {
  display: flex;
  align-items: center;
  gap: 11px;
}
.page-title a {
  font-weight: 700;
}

.sheet {
  padding: 24px;
}
.sheet-head {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding-bottom: 20px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border-soft);
}
.sheet-head > div {
  display: grid;
  gap: 3px;
}
.sheet-head .right {
  text-align: right;
}
.label {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.sheet-head strong {
  font-size: var(--fs-md);
}
.sheet-head .amount {
  font-size: 27px;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.sheet-head small {
  color: var(--muted);
  font-size: var(--fs-sm);
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
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
}
th:not(:first-child),
td:not(:first-child) {
  text-align: right;
}
td {
  padding: 11px 12px;
  border-top: 1px solid var(--border-soft);
  font-size: var(--fs-sm);
}
tfoot td {
  font-weight: 600;
}
tfoot .total td {
  font-size: var(--fs-md);
  font-weight: 800;
  border-top: 2px solid var(--border-strong);
}
.notes {
  margin: 18px 0 0;
  padding: 13px 15px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: var(--fs-sm);
  line-height: 1.6;
  white-space: pre-wrap;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
  color: var(--muted);
  font-size: var(--fs-xs);
}
.meta b {
  color: var(--text-2);
}

.panel {
  padding: 20px;
}
.usage {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.usage > div {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  display: grid;
  gap: 4px;
}
.usage > div.highlight {
  background: var(--primary-soft);
}
.usage dt {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
}
.usage dd {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.actions h2 {
  margin: 0 0 4px;
  font-size: var(--fs-lg);
}
.actions p {
  margin: 0;
  max-width: 52ch;
  color: var(--muted);
  font-size: var(--fs-sm);
  line-height: 1.6;
}
.buttons {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}
</style>
