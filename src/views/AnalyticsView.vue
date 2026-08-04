<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Info, RefreshCw } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import AppButton from '../components/common/AppButton.vue'
import AnalyticsDateRange from '../components/analytics/AnalyticsDateRange.vue'
import AnalyticsKpiGrid from '../components/analytics/AnalyticsKpiGrid.vue'
import AnalyticsDistribution from '../components/analytics/AnalyticsDistribution.vue'
import AnalyticsTrend from '../components/analytics/AnalyticsTrend.vue'
import { useAppStore } from '../stores/app'
import {
  analyticsRangeKey,
  createAnalyticsDateRange,
  getAnalyticsPresetRange,
  isValidAnalyticsDateRange,
  normalizeAnalyticsTimezone,
  rebaseAnalyticsRangeTimezone,
} from '../services/analyticsDateRange'
import { createLocalAnalyticsSnapshot } from '../services/localAnalytics'
const store = useAppStore()
const browserTimezone =
  normalizeAnalyticsTimezone(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) || 'UTC'
const businessTimezone = computed(() =>
  store.business?.id === store.businessId
    ? normalizeAnalyticsTimezone(store.business.timezone)
    : '',
)
const analyticsTimezone = computed(
  () => businessTimezone.value || browserTimezone,
)
const timezoneLabel = computed(() =>
  businessTimezone.value
    ? `Business timezone: ${analyticsTimezone.value}`
    : `Your device timezone: ${analyticsTimezone.value}`,
)
const range = ref(createAnalyticsDateRange(analyticsTimezone.value))
const resolvingBusinessId = ref('')
let businessLoadPromise = null
let lastAutomaticRangeKey = ''
const rangeError = computed(() =>
  isValidAnalyticsDateRange(range.value)
    ? ''
    : 'Start date must be on or before the end date.',
)
const local = computed(() =>
  createLocalAnalyticsSnapshot({
    businessId: store.businessId,
    conversations: store.conversations,
    leads: store.leads,
    appointments: store.appointments,
    escalations: store.escalations,
  }),
)
const localKpis = computed(() =>
  [
    ['Conversations', local.value.summary.conversations],
    ['Leads', local.value.summary.leads],
    ['Appointments', local.value.summary.appointments],
    ['Escalations', local.value.summary.escalations],
  ].map(([label, value]) => ({ label, value, note: 'Open in this dashboard' })),
)
const remoteKpis = computed(() => {
  const s = store.analytics?.summary || {}
  const conversionValue =
    s.conversionValue == null
      ? null
      : s.currency
        ? `${s.conversionValue} ${s.currency}`
        : s.conversionValue
  return [
    ['Conversations', s.conversations],
    ['New leads', s.leads],
    ['Converted leads', s.convertedLeads],
    [
      'Conversion rate',
      s.conversionRate == null ? null : `${s.conversionRate}%`,
    ],
    ['Appointments', s.appointments],
    ['Completed appointments', s.completedAppointments],
    ['Cancelled appointments', s.cancelledAppointments],
    ['Conversion value', conversionValue],
    ['Escalations', s.escalations],
  ].map(([label, value]) => ({ label, value }))
})
const remoteEmpty = computed(() => {
  const report = store.analytics
  if (!report) return false
  return (
    Object.entries(report.summary)
      .filter(([key]) => key !== 'currency')
      .every(([, value]) => value == null) &&
    Object.values(report.trends).every((points) => !points.length) &&
    !report.channels.length &&
    !report.leadStatuses.length &&
    !report.appointmentStatuses.length &&
    !report.escalationStatuses.length
  )
})
function choosePreset(preset) {
  range.value =
    preset === 'custom'
      ? { ...range.value, preset }
      : getAnalyticsPresetRange(preset, new Date(), analyticsTimezone.value)
  if (preset !== 'custom') load()
}
function load({ force = false } = {}) {
  if (!store.analyticsAvailable || !isValidAnalyticsDateRange(range.value))
    return
  const key = `${store.businessId}|${analyticsRangeKey(range.value)}`
  if (!force && key === lastAutomaticRangeKey) return
  lastAutomaticRangeKey = key
  store.refreshAnalytics(range.value).catch(() => {})
}
async function ensureActiveBusinessProfile(expectedBusinessId) {
  if (
    !store.authenticated ||
    !expectedBusinessId ||
    store.business?.id === expectedBusinessId
  )
    return
  if (businessLoadPromise && resolvingBusinessId.value === expectedBusinessId)
    return businessLoadPromise
  resolvingBusinessId.value = expectedBusinessId
  const request = store
    .refreshBusiness()
    .catch(() => null)
    .finally(() => {
      if (resolvingBusinessId.value === expectedBusinessId)
        resolvingBusinessId.value = ''
      if (businessLoadPromise === request) businessLoadPromise = null
    })
  businessLoadPromise = request
  return request
}
async function initializeForBusiness(expectedBusinessId) {
  lastAutomaticRangeKey = ''
  range.value = createAnalyticsDateRange(browserTimezone)
  await ensureActiveBusinessProfile(expectedBusinessId)
  if (!store.authenticated || store.businessId !== expectedBusinessId) return
  range.value = rebaseAnalyticsRangeTimezone(
    range.value,
    analyticsTimezone.value,
  )
  load()
}
watch(
  () => store.businessId,
  (businessId) => initializeForBusiness(businessId),
)
watch(analyticsTimezone, (nextTimezone, previousTimezone) => {
  if (
    nextTimezone === previousTimezone ||
    resolvingBusinessId.value === store.businessId ||
    !store.authenticated
  )
    return
  range.value = rebaseAnalyticsRangeTimezone(range.value, nextTimezone)
  load()
})
onMounted(() => initializeForBusiness(store.businessId))
</script>
<template>
  <AppShell>
    <main class="page">
      <header>
        <div>
          <h1>Analytics</h1>
          <p>{{ store.businessName }}</p>
        </div>
        <AppButton
          v-if="store.analyticsAvailable"
          variant="outline"
          :disabled="!!rangeError || store.analyticsRefreshing"
          @click="load({ force: true })"
        >
          <RefreshCw :size="15" :class="{ spin: store.analyticsRefreshing }" />
          {{ store.analyticsRefreshing ? 'Refreshing…' : 'Refresh' }}
        </AppButton>
      </header>
      <section
        v-if="!store.analyticsAvailable"
        class="notice notice--warning"
        role="status"
      >
        <Info :size="18" />
        <p>
          Full business reporting is turned off for this workspace, so the
          figures below cover only what is currently open in this dashboard.
        </p>
      </section>
      <AnalyticsDateRange
        v-if="store.analyticsAvailable"
        :range="range"
        :error="rangeError"
        :timezone-label="timezoneLabel"
        :disabled="store.analyticsLoading"
        @preset="choosePreset"
        @update:from="range = { ...range, preset: 'custom', from: $event }"
        @update:to="range = { ...range, preset: 'custom', to: $event }"
      />
      <p v-if="store.analyticsError" role="alert" class="notice notice--danger">
        {{ store.analyticsError }}
      </p>
      <div v-if="store.analyticsLoading" class="loading" role="status">
        <RefreshCw class="spin" :size="18" />
        Loading your report…
      </div>
      <template v-if="store.analyticsAvailable && store.analytics">
        <p v-if="remoteEmpty" class="empty" role="status">
          There is no activity in the dates you selected. Try a wider range.
        </p>
        <AnalyticsKpiGrid :items="remoteKpis" />
        <div class="sections">
          <AnalyticsTrend
            title="Conversation trend"
            :points="store.analytics.trends.conversations"
          />
          <AnalyticsTrend
            title="Lead trend"
            :points="store.analytics.trends.leads"
          />
          <AnalyticsTrend
            title="Appointment trend"
            :points="store.analytics.trends.appointments"
          />
          <AnalyticsDistribution
            title="Channels"
            :rows="store.analytics.channels"
          />
          <AnalyticsDistribution
            title="Lead statuses"
            :rows="store.analytics.leadStatuses"
          />
          <AnalyticsDistribution
            title="Appointment statuses"
            :rows="store.analytics.appointmentStatuses"
          />
          <AnalyticsDistribution
            title="Escalation statuses"
            :rows="store.analytics.escalationStatuses"
          />
        </div>
      </template>
      <section v-else-if="!store.analyticsAvailable" class="snapshot">
        <h2>What is open in this dashboard</h2>
        <p>
          A count of the records open on your screen right now. These figures
          may not represent complete business totals.
        </p>
        <p v-if="local.empty" class="empty">
          Nothing is loaded yet. Open your Inbox or Leads and come back.
        </p>
        <AnalyticsKpiGrid :items="localKpis" />
        <div class="sections">
          <AnalyticsDistribution
            title="Lead statuses"
            :rows="local.leadStatuses"
          />
          <AnalyticsDistribution
            title="Appointment statuses"
            :rows="local.appointmentStatuses"
          />
          <AnalyticsDistribution
            title="Escalation statuses"
            :rows="local.escalationStatuses"
          />
        </div>
      </section>
    </main>
  </AppShell>
</template>
<style scoped>
.page {
  display: grid;
  gap: 18px;
  padding: 28px;
  max-width: 1250px;
  margin: auto;
}
.page > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page h1 {
  margin: 0;
  font-size: var(--fs-2xl);
}
.page header p {
  margin: 4px 0 0;
}
.page header p,
.snapshot > p,
.empty {
  color: var(--muted);
  font-size: 14px;
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
.snapshot {
  display: grid;
  gap: 14px;
}
.snapshot h2 {
  margin: 0;
  font-size: var(--fs-xl);
}
.sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}
@media (max-width: 760px) {
  .page {
    padding: 16px;
  }
  .sections {
    grid-template-columns: 1fr;
  }
}
</style>
