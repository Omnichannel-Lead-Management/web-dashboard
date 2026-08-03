<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
    : `Browser timezone fallback: ${analyticsTimezone.value}`,
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
    ['Currently loaded conversations', local.value.summary.conversations],
    ['Currently loaded leads', local.value.summary.leads],
    ['Currently loaded appointments', local.value.summary.appointments],
    ['Currently loaded escalations', local.value.summary.escalations],
  ].map(([label, value]) => ({ label, value, note: 'Session snapshot' })),
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
          variant="secondary"
          :disabled="!!rangeError || store.analyticsRefreshing"
          @click="load({ force: true })"
        >
          {{ store.analyticsRefreshing ? 'Refreshing…' : 'Refresh' }}
        </AppButton>
      </header>
      <section v-if="!store.analyticsAvailable" class="notice" role="status">
        <strong>
          Business-wide analytics are ready in the dashboard, but live reporting
          requires the gateway analytics API.
        </strong>
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
      <p v-if="store.analyticsError" role="alert" class="error">
        {{ store.analyticsError }}
      </p>
      <p v-if="store.analyticsLoading" role="status">
        Loading business analytics…
      </p>
      <template v-if="store.analyticsAvailable && store.analytics">
        <p v-if="remoteEmpty" class="empty" role="status">
          No supported analytics data is available for the selected range.
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
        <h2>Current loaded workspace snapshot</h2>
        <p>
          These figures include only records currently loaded in this dashboard
          session and may not represent complete business totals.
        </p>
        <p v-if="local.empty" class="empty">
          No confirmed records are currently loaded for this workspace.
        </p>
        <AnalyticsKpiGrid :items="localKpis" />
        <div class="sections">
          <AnalyticsDistribution
            title="Loaded lead statuses"
            :rows="local.leadStatuses"
          />
          <AnalyticsDistribution
            title="Loaded appointment statuses"
            :rows="local.appointmentStatuses"
          />
          <AnalyticsDistribution
            title="Loaded escalation statuses"
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
}
.page h1,
.page header p {
  margin: 0;
}
.page header p,
.snapshot > p,
.empty {
  color: var(--muted);
}
.notice,
.error {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff8e3;
}
.error {
  color: var(--danger);
  background: var(--danger-bg);
}
.snapshot {
  display: grid;
  gap: 14px;
}
.snapshot h2 {
  margin: 0;
}
.sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
