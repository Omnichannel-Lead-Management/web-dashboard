<script setup>
import { computed, onMounted, ref } from 'vue'
import { RefreshCw, Search, Building2 } from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AdminPeriodPicker from '../../components/admin/AdminPeriodPicker.vue'
import AppButton from '../../components/common/AppButton.vue'
import AppBadge from '../../components/common/AppBadge.vue'
import { useAdminStore } from '../../stores/admin'
import {
  formatCount,
  formatDate,
  formatMoney,
} from '../../services/billingFormat'

const store = useAdminStore()
const query = ref('')
const sortKey = ref('ai_requests')

const SORTS = [
  { value: 'ai_requests', label: 'AI requests' },
  { value: 'contacts', label: 'Customers' },
  { value: 'messages', label: 'Messages' },
  { value: 'outstanding_total', label: 'Outstanding' },
  { value: 'name', label: 'Name' },
]

const rows = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const filtered = needle
    ? store.businesses.filter((business) =>
        [business.name, business.owner_email, business.id, business.sector]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(needle)),
      )
    : store.businesses

  return [...filtered].sort((a, b) =>
    sortKey.value === 'name'
      ? a.name.localeCompare(b.name)
      : (b[sortKey.value] || 0) - (a[sortKey.value] || 0),
  )
})

const totals = computed(() =>
  rows.value.reduce(
    (sum, business) => ({
      contacts: sum.contacts + business.contacts,
      messages: sum.messages + business.messages,
      ai: sum.ai + business.ai_requests,
    }),
    { contacts: 0, messages: 0, ai: 0 },
  ),
)

function changePeriod(period) {
  store.setPeriod(period)
  store.refreshBusinesses()
}

onMounted(() => {
  store.refreshBusinesses()
  store.refreshPlans()
})
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <h1>Businesses</h1>
          <p>
            {{ formatCount(rows.length) }} tenants ·
            {{ formatCount(totals.contacts) }} customers ·
            {{ formatCount(totals.ai) }} AI requests this period
          </p>
        </div>
        <AppButton
          variant="outline"
          :disabled="store.loadingBusinesses"
          @click="store.refreshBusinesses()"
        >
          <RefreshCw :size="15" :class="{ spin: store.loadingBusinesses }" />
          Refresh
        </AppButton>
      </header>

      <div class="stack">
        <AdminPeriodPicker
          :period="store.period"
          :disabled="store.loadingBusinesses"
          @change="changePeriod"
        />

        <div class="filters">
          <label class="search">
            <Search :size="16" />
            <input
              v-model="query"
              type="search"
              placeholder="Search by name, owner or id"
              aria-label="Search businesses"
            />
          </label>
          <label class="sort">
            Sort by
            <select v-model="sortKey">
              <option
                v-for="sort in SORTS"
                :key="sort.value"
                :value="sort.value"
              >
                {{ sort.label }}
              </option>
            </select>
          </label>
        </div>

        <p v-if="store.error" class="notice notice--danger" role="alert">
          {{ store.error }}
        </p>

        <div v-if="!rows.length" class="card empty-state">
          <span class="empty-icon"><Building2 :size="22" /></span>
          <h3>No businesses match</h3>
          <p>
            {{
              query
                ? 'Nothing matches that search. Try a different name or owner email.'
                : 'No business has registered on this platform yet.'
            }}
          </p>
        </div>

        <div v-else class="table card">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Plan</th>
                <th>Customers</th>
                <th>New</th>
                <th>Messages</th>
                <th>AI requests</th>
                <th>Channels</th>
                <th>Outstanding</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="business in rows"
                :key="business.id"
                tabindex="0"
                @click="$router.push(`/admin/businesses/${business.id}`)"
                @keydown.enter="
                  $router.push(`/admin/businesses/${business.id}`)
                "
              >
                <td>
                  <span class="who">
                    <strong>{{ business.name }}</strong>
                    <small>{{ business.owner_email || business.id }}</small>
                  </span>
                </td>
                <td>
                  <AppBadge
                    :tone="business.billing_active ? 'primary' : 'neutral'"
                  >
                    {{ business.plan_name || 'No plan' }}
                  </AppBadge>
                  <small v-if="!business.billing_active" class="paused">
                    Paused
                  </small>
                </td>
                <td class="mono">{{ formatCount(business.contacts) }}</td>
                <td class="mono">{{ formatCount(business.new_contacts) }}</td>
                <td class="mono">{{ formatCount(business.messages) }}</td>
                <td class="mono ai">{{ formatCount(business.ai_requests) }}</td>
                <td>
                  <span class="channels">
                    <AppBadge
                      v-for="channel in business.channels"
                      :key="channel"
                      :tone="channel"
                    >
                      {{ channel }}
                    </AppBadge>
                    <small v-if="!business.channels.length" class="muted">
                      —
                    </small>
                  </span>
                </td>
                <td class="mono">
                  {{
                    business.outstanding_total
                      ? formatMoney(
                          business.outstanding_total,
                          business.currency,
                        )
                      : '—'
                  }}
                </td>
                <td class="muted">
                  {{ formatDate(business.last_activity_at) }}
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
  max-width: 1400px;
  margin: 0 auto;
}
.stack {
  display: grid;
  gap: 16px;
}
.filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
.search {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--muted);
}
.search input {
  flex: 1;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: var(--fs-base);
  color: var(--text);
}
.search input:focus-visible {
  outline: none;
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

.table {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
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
.who {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.who small {
  font-size: 10.5px;
  color: var(--muted);
}
.channels {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.paused {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: var(--warning);
  font-weight: 700;
}
/* AI is the line the bill turns on, so it reads first. */
.ai {
  font-weight: 700;
  color: var(--primary);
}
</style>
