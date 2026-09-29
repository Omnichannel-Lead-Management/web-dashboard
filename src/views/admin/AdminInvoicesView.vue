<script setup>
import { computed, onMounted, ref } from 'vue'
import { RefreshCw, ReceiptText } from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AppButton from '../../components/common/AppButton.vue'
import InvoiceStatusBadge from '../../components/admin/InvoiceStatusBadge.vue'
import { useAdminStore } from '../../stores/admin'
import {
  formatDate,
  formatMoney,
  formatPeriod,
} from '../../services/billingFormat'

const store = useAdminStore()
const statusFilter = ref('')

const STATUSES = [
  { value: '', label: 'All invoices' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
]

const totals = computed(() => {
  const outstanding = store.invoices
    .filter((invoice) => invoice.status === 'sent')
    .reduce((sum, invoice) => sum + invoice.total, 0)
  const currency = store.invoices[0]?.currency || store.currency
  return { outstanding, currency }
})

function load() {
  store.refreshInvoices(
    statusFilter.value ? { status: statusFilter.value } : {},
  )
}

onMounted(load)
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <h1>Invoices</h1>
          <p>
            {{ store.invoices.length }} shown ·
            {{ formatMoney(totals.outstanding, totals.currency) }} awaiting
            payment
          </p>
        </div>
        <AppButton
          variant="outline"
          :disabled="store.loadingInvoices"
          @click="load"
        >
          <RefreshCw :size="15" :class="{ spin: store.loadingInvoices }" />
          Refresh
        </AppButton>
      </header>

      <div class="stack">
        <div class="filters">
          <label class="sort">
            Show
            <select v-model="statusFilter" @change="load">
              <option
                v-for="status in STATUSES"
                :key="status.value"
                :value="status.value"
              >
                {{ status.label }}
              </option>
            </select>
          </label>
          <p class="hint">
            Raise a new invoice from a business's page under
            <RouterLink to="/admin/businesses">Businesses</RouterLink>
            .
          </p>
        </div>

        <p v-if="store.error" class="notice notice--danger" role="alert">
          {{ store.error }}
        </p>

        <div v-if="!store.invoices.length" class="card empty-state">
          <span class="empty-icon"><ReceiptText :size="22" /></span>
          <h3>No invoices here</h3>
          <p>
            {{
              statusFilter
                ? 'Nothing matches that status yet.'
                : 'Open a business and price a period to raise the first one.'
            }}
          </p>
        </div>

        <div v-else class="table card">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Business</th>
                <th>Period</th>
                <th>Total</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="invoice in store.invoices"
                :key="invoice.id"
                tabindex="0"
                @click="$router.push(`/admin/invoices/${invoice.id}`)"
                @keydown.enter="$router.push(`/admin/invoices/${invoice.id}`)"
              >
                <td class="mono num">{{ invoice.number }}</td>
                <td>
                  <span class="who">
                    <strong>
                      {{ invoice.business_name || invoice.business_id }}
                    </strong>
                    <small>{{ invoice.owner_email || '—' }}</small>
                  </span>
                </td>
                <td>
                  {{ formatPeriod(invoice.period_start, invoice.period_end) }}
                </td>
                <td class="mono">
                  {{ formatMoney(invoice.total, invoice.currency) }}
                </td>
                <td>
                  <InvoiceStatusBadge :status="invoice.status" />
                  <!-- An issued invoice whose email bounced needs to be
                       visible at a glance, not only on the detail page. -->
                  <small v-if="invoice.send_error" class="warn">
                    Email failed
                  </small>
                </td>
                <td class="muted">
                  {{ invoice.sent_at ? formatDate(invoice.sent_at) : '—' }}
                </td>
                <td class="muted">
                  {{ invoice.due_date ? formatDate(invoice.due_date) : '—' }}
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
  max-width: 1250px;
  margin: 0 auto;
}
.stack {
  display: grid;
  gap: 16px;
}
.filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.sort {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-2);
}
.sort select {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font: inherit;
  font-size: var(--fs-base);
  color: var(--text);
}
.hint {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-sm);
}

.table {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
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
tbody tr {
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}
tbody tr:hover {
  background: #fafaff;
}
tbody tr:focus-visible {
  outline: none;
  background: var(--primary-soft);
}
.num {
  font-weight: 700;
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
.warn {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--warning);
}
</style>
