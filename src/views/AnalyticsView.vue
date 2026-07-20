<script setup>
import AppShell from '../components/layout/AppShell.vue'
import { analytics } from '../data/mockData'
</script>
<template>
  <AppShell>
    <div class="page">
      <div class="page-title">
        <div>
          <h1>Analytics</h1>
          <p>Elegant Salon · last 30 days</p>
        </div>
        <select aria-label="Analytics period">
          <option>Last 30 days</option>
          <option>Last 7 days</option>
        </select>
      </div>
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
            <i><b :style="{ width: s[1] * 2 + '%' }" /></i>
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
