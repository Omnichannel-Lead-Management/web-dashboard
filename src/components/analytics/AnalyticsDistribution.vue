<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  rows: { type: Array, default: () => [] },
})

const max = computed(() => Math.max(1, ...props.rows.map((row) => row.value)))
const total = computed(() =>
  props.rows.reduce((sum, row) => sum + (row.value || 0), 0),
)

function share(value) {
  if (!total.value) return ''
  return `${Math.round((value / total.value) * 100)}%`
}
</script>

<template>
  <section class="card distribution">
    <header>
      <h2>{{ title }}</h2>
      <span v-if="rows.length" class="total">{{ total }} total</span>
    </header>

    <p v-if="!rows.length" class="empty-row">Nothing to show yet.</p>

    <template v-else>
      <div aria-hidden="true" class="bars">
        <div v-for="row in rows" :key="row.category" class="bar-row">
          <span class="category">{{ row.category }}</span>
          <i><b :style="{ width: `${(row.value / max) * 100}%` }" /></i>
          <strong>
            {{ row.value }}
            <em>{{ share(row.value) }}</em>
          </strong>
        </div>
      </div>

      <!-- Same numbers as the chart, for screen readers. -->
      <table class="visually-hidden">
        <caption>{{ title }} data</caption>
        <thead>
          <tr>
            <th>Category</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.category">
            <td>{{ row.category }}</td>
            <td>{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>

<style scoped>
.distribution {
  padding: 20px;
}
.distribution header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.distribution h2 {
  margin: 0;
  font-size: var(--fs-lg);
}
.total {
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bars {
  display: grid;
  gap: 12px;
}
.bar-row {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) 2fr auto;
  gap: 12px;
  align-items: center;
  font-size: var(--fs-sm);
}
.category {
  color: var(--text-2);
  font-weight: 600;
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bars i {
  height: 10px;
  background: var(--surface-3);
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.bars b {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, var(--primary) 0%, #6d67ec 100%);
  transition: width var(--dur) var(--ease);
}
.bar-row strong {
  display: flex;
  align-items: baseline;
  gap: 6px;
  justify-content: flex-end;
  min-width: 62px;
  font-variant-numeric: tabular-nums;
}
.bar-row em {
  font-style: normal;
  font-size: var(--fs-2xs);
  font-weight: 600;
  color: var(--muted);
}

.empty-row {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-base);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
