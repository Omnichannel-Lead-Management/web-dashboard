<script setup>
import { computed, onMounted } from 'vue'
import { RefreshCw, Info } from 'lucide-vue-next'
import AdminShell from '../../components/admin/AdminShell.vue'
import AdminPeriodPicker from '../../components/admin/AdminPeriodPicker.vue'
import AppButton from '../../components/common/AppButton.vue'
import AnalyticsKpiGrid from '../../components/analytics/AnalyticsKpiGrid.vue'
import AnalyticsTrend from '../../components/analytics/AnalyticsTrend.vue'
import AnalyticsDistribution from '../../components/analytics/AnalyticsDistribution.vue'
import { useAdminStore } from '../../stores/admin'
import { formatCount, formatMoney } from '../../services/billingFormat'

const store = useAdminStore()

const AI_KIND_LABELS = {
  ai_reply: 'Chatbot replies',
  ai_voice: 'Voice transcription',
  ai_vision: 'Photo understanding',
  ai_other: 'Other AI',
}

const kpis = computed(() => {
  const overview = store.overview
  if (!overview) return []

  return [
    {
      label: 'Businesses',
      value: formatCount(overview.businesses),
      note: `${formatCount(overview.active_businesses)} active in this period`,
    },
    {
      label: 'Customers reached',
      value: formatCount(overview.contacts),
      note: `${formatCount(overview.new_contacts)} new in this period`,
    },
    { label: 'Messages', value: formatCount(overview.messages) },
    {
      label: 'AI requests',
      value: formatCount(overview.ai_requests),
      note: 'The metered, billable line',
    },
    {
      label: 'Invoiced',
      value: formatMoney(overview.invoiced_total, overview.currency),
      note: 'Sent and paid, all time',
    },
    {
      label: 'Outstanding',
      value: formatMoney(overview.outstanding_total, overview.currency),
      note: 'Sent, not yet paid',
    },
  ]
})

const aiBreakdown = computed(() =>
  Object.entries(store.overview?.ai_by_kind || {})
    .filter(([, value]) => value > 0)
    .map(([kind, value]) => ({ category: AI_KIND_LABELS[kind] || kind, value }))
    .sort((a, b) => b.value - a.value),
)

const topTenants = computed(() =>
  [...store.businesses]
    .sort((a, b) => b.ai_requests - a.ai_requests)
    .slice(0, 6)
    .map((business) => ({
      category: business.name,
      value: business.ai_requests,
    }))
    .filter((row) => row.value > 0),
)

function load() {
  store.refreshOverview()
  store.refreshBusinesses()
}

function changePeriod(period) {
  store.setPeriod(period)
  load()
}

onMounted(load)
</script>
<template>
  <AdminShell>
    <div class="page">
      <header class="page-title">
        <div>
          <h1>Platform overview</h1>
          <p>Usage across every business on this platform.</p>
        </div>
        <AppButton
          variant="outline"
          :disabled="store.loadingOverview"
          @click="load"
        >
          <RefreshCw :size="15" :class="{ spin: store.loadingOverview }" />
          {{ store.loadingOverview ? 'Refreshing…' : 'Refresh' }}
        </AppButton>
      </header>

      <div class="stack">
        <AdminPeriodPicker
          :period="store.period"
          :disabled="store.loadingOverview"
          @change="changePeriod"
        />

        <p v-if="store.error" class="notice notice--danger" role="alert">
          {{ store.error }}
        </p>

        <section class="notice notice--info">
          <Info :size="18" />
          <p>
            This console reports counts only. Conversation content stays with
            the business that owns it — an admin session cannot open a tenant's
            inbox.
          </p>
        </section>

        <div
          v-if="store.loadingOverview && !store.overview"
          class="loading"
          role="status"
        >
          <RefreshCw class="spin" :size="18" />
          Loading platform figures…
        </div>

        <template v-else-if="store.overview">
          <AnalyticsKpiGrid :items="kpis" />
          <div class="sections">
            <AnalyticsTrend
              title="AI requests per day"
              :points="store.overview.ai_trend"
            />
            <AnalyticsDistribution title="AI by kind" :rows="aiBreakdown" />
            <AnalyticsDistribution
              title="Contacts by channel"
              :rows="store.overview.channels"
            />
            <AnalyticsDistribution
              title="Heaviest AI users"
              :rows="topTenants"
            />
          </div>
        </template>
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
.sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px;
  color: var(--muted);
  font-size: var(--fs-base);
}
@media (max-width: 760px) {
  .sections {
    grid-template-columns: 1fr;
  }
}
</style>
