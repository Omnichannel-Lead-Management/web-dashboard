<script setup>
import { computed, onMounted } from 'vue'
import AppShell from '../components/layout/AppShell.vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()

onMounted(() => {
  if (store.leads.length === 0) store.refreshLeads()
  if (store.appointments.length === 0) store.refreshAppointments()
})

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost']

function countBy(items, pick) {
  return items.reduce((totals, item) => {
    const key = pick(item)
    if (key) totals[key] = (totals[key] || 0) + 1
    return totals
  }, {})
}

/**
 * Derived from whatever the tenant actually has. There is no time-series store
 * yet, so these are totals rather than 30-day deltas — the third value is a
 * supporting fact, not a fabricated trend.
 */
const analytics = computed(() => {
  const leads = store.leads
  const converted = leads.filter((lead) => lead.status === 'converted').length
  const conversionRate = leads.length
    ? `${((converted / leads.length) * 100).toFixed(1)}%`
    : '0%'
  const averageScore = leads.length
    ? Math.round(leads.reduce((sum, lead) => sum + (lead.score || 0), 0) / leads.length)
    : 0
  const hot = leads.filter((lead) => (lead.score || 0) >= 70).length
  const unassigned = leads.filter((lead) => lead.agent === 'Unassigned').length

  const byStatus = countBy(leads, (lead) => lead.status)
  const byChannel = countBy(leads, (lead) => lead.channel)
  const channelTotal = Object.values(byChannel).reduce((a, b) => a + b, 0)

  return {
    metrics: [
      ['Conversations', String(store.conversations.length), `${store.conversations.filter((c) => c.escalated).length} escalated`],
      ['Leads', String(leads.length), `${hot} scoring 70+`],
      ['Conversion rate', conversionRate, `${converted} converted`],
      ['Appointments', String(store.appointments.length), `${unassigned} leads unassigned`],
    ],
    statuses: STATUSES.map((status) => [
      status[0].toUpperCase() + status.slice(1),
      byStatus[status] || 0,
    ]),
    platforms: Object.entries(byChannel).map(([channel, count]) => [
      channel,
      channelTotal ? Math.round((count / channelTotal) * 100) : 0,
    ]),
    averageScore,
    empty: leads.length === 0,
  }
})

/** Bars are relative to the biggest bucket so a small tenant still reads clearly. */
const maxStatus = computed(() =>
  Math.max(1, ...analytics.value.statuses.map(([, count]) => count)),
)
</script>
<template>
  <AppShell>
    <div class="page">
      <div class="page-title">
        <div>
          <h1>Analytics</h1>
          <p>{{ store.businessName }} · all time · avg score {{ analytics.averageScore }}</p>
        </div>
        <select aria-label="Analytics period">
          <option>Last 30 days</option>
          <option>Last 7 days</option>
        </select>
      </div>
      <p v-if="analytics.empty" class="empty">
        No leads captured yet for this business. They appear here as soon as the
        chatbot or routing qualifies one.
      </p>
      <section class="metrics">
        <article v-for="m in analytics.metrics" :key="m[0]" class="card">
          <span>{{ m[0] }}</span>
          <strong>{{ m[1] }}</strong>
          <b>{{ m[2] }}</b>
        </article>
      </section>
      <section class="charts">
        <article class="card">
          <h2>Leads by status</h2>
          <div v-for="s in analytics.statuses" :key="s[0]" class="bar">
            <span>{{ s[0] }}</span>
            <i><b :style="{ width: (s[1] / maxStatus) * 100 + '%' }" /></i>
            <strong>{{ s[1] }}</strong>
          </div>
        </article>
        <article class="card">
          <h2>Leads by platform</h2>
          <div class="donut" />
          <ul>
            <li
              v-for="p in analytics.platforms"
              :key="p[0]"
              :class="p[0].toLowerCase()"
            >
              <i />
              {{ p[0] }}
              <b>{{ p[1] }}%</b>
            </li>
          </ul>
        </article>
      </section>
    </div>
  </AppShell>
</template>
<style scoped>
.empty {
  margin: 0 0 16px;
  padding: 12px 14px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--muted);
}
.page-title select {
  width: 150px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;
}
.metrics article {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
}
.metrics span {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
}
.metrics strong {
  font-size: 29px;
  margin: 5px 0;
}
.metrics b {
  font-size: 11px;
  color: var(--success);
}
.charts {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 15px;
  margin-top: 15px;
}
.charts article {
  padding: 21px;
}
.charts h2 {
  font-size: 14px;
  margin-bottom: 22px;
}
.bar {
  display: grid;
  grid-template-columns: 75px 1fr 25px;
  gap: 10px;
  align-items: center;
  margin: 14px 0;
  font-size: 11.5px;
}
.bar i {
  height: 8px;
  background: #f0f1f5;
  border-radius: 8px;
  overflow: hidden;
}
.bar i b {
  height: 100%;
  display: block;
  background: var(--primary);
  border-radius: 8px;
}
.donut {
  width: 150px;
  height: 150px;
  margin: 10px auto;
  border-radius: 50%;
  background: conic-gradient(
    var(--telegram) 0 55%,
    var(--whatsapp) 55% 82%,
    var(--web) 82%
  );
  position: relative;
}
.donut:after {
  content: '';
  position: absolute;
  inset: 35px;
  background: #fff;
  border-radius: 50%;
}
ul {
  list-style: none;
  padding: 0;
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
}
li {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 5px;
}
li i {
  width: 9px;
  height: 9px;
  background: var(--web);
  border-radius: 3px;
}
li.telegram i {
  background: var(--telegram);
}
li.whatsapp i {
  background: var(--whatsapp);
}
@media (max-width: 850px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
  .charts {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
  .metrics article {
    padding: 14px;
  }
  .metrics strong {
    font-size: 23px;
  }
}
</style>
