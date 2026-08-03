<script setup>
import { ChartNoAxesCombined } from 'lucide-vue-next'
import { analyticsEnabled } from '../../config'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'
</script>
<template>
  <section class="analytics-settings">
    <header>
      <ChartNoAxesCombined :size="22" />
      <div>
        <h2>Analytics</h2>
        <p>Business reporting and the current workspace snapshot.</p>
      </div>
      <AppBadge :tone="analyticsEnabled ? 'success' : 'neutral'">
        {{ analyticsEnabled ? 'Enabled' : 'Unavailable' }}
      </AppBadge>
    </header>
    <div class="notice">
      The expected live contract is GET /api/businesses/:businessId/analytics.
      Enable it only after that gateway route is deployed.
    </div>
    <p>
      Without the remote API, Analytics shows only records already loaded in
      this dashboard session and never presents them as complete totals.
    </p>
    <RouterLink to="/analytics">
      <AppButton>Open analytics</AppButton>
    </RouterLink>
  </section>
</template>
<style scoped>
.analytics-settings {
  display: grid;
  gap: 18px;
}
.analytics-settings header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.analytics-settings header div {
  flex: 1;
}
.analytics-settings h2,
.analytics-settings p {
  margin: 0;
}
.analytics-settings header p,
.analytics-settings > p {
  color: var(--muted);
}
.notice {
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface-2, #f7f7fa);
  overflow-wrap: anywhere;
}
</style>
