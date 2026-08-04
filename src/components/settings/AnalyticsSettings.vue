<script setup>
import { ChartNoAxesCombined, ArrowRight } from 'lucide-vue-next'
import { analyticsEnabled } from '../../config'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

const reports = [
  'Conversations, new leads and how many of them converted',
  'Appointments booked, completed and cancelled',
  'Which channel your customers actually arrive through',
]
</script>

<template>
  <section class="analytics-settings">
    <header class="section-head">
      <span class="section-icon"><ChartNoAxesCombined :size="22" /></span>
      <div>
        <h2>Analytics</h2>
        <p>Reporting across your whole business.</p>
      </div>
      <AppBadge :tone="analyticsEnabled ? 'success' : 'neutral'">
        {{ analyticsEnabled ? 'Active' : 'Off' }}
      </AppBadge>
    </header>

    <ul class="reports">
      <li v-for="item in reports" :key="item">{{ item }}</li>
    </ul>

    <p v-if="!analyticsEnabled" class="notice">
      Full reporting is switched off for this workspace, so Analytics shows only
      the records currently open in the dashboard. Contact your administrator to
      turn on full reporting.
    </p>

    <RouterLink to="/analytics" class="cta">
      <AppButton>
        Open analytics
        <ArrowRight :size="16" />
      </AppButton>
    </RouterLink>
  </section>
</template>

<style scoped>
.analytics-settings {
  display: grid;
  gap: 20px;
}
.reports {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.reports li {
  position: relative;
  padding-left: 26px;
  color: var(--text-2);
  font-size: var(--fs-base);
  line-height: 1.55;
}
.reports li::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
}
.cta {
  justify-self: start;
}
</style>
