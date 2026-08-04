<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  points: { type: Array, default: () => [] },
})

const max = computed(() =>
  Math.max(1, ...props.points.map((point) => point.value)),
)
const total = computed(() =>
  props.points.reduce((sum, point) => sum + (point.value || 0), 0),
)

/** `2026-08-04` reads as `Aug 4` on the axis. */
function axisLabel(date) {
  const parsed = new Date(date)
  if (!Number.isFinite(parsed.getTime())) return date
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
</script>

<template>
  <section v-if="points.length" class="card trend">
    <header>
      <h2>{{ title }}</h2>
      <span class="total">{{ total }} total</span>
    </header>

    <div class="plot" aria-hidden="true">
      <div v-for="point in points" :key="point.date" class="column">
        <span class="value">{{ point.value }}</span>
        <i :style="{ height: `${Math.max(3, (point.value / max) * 100)}%` }" />
        <span class="axis">{{ axisLabel(point.date) }}</span>
      </div>
    </div>

    <!-- Same numbers as the chart, for screen readers. -->
    <table class="visually-hidden">
      <caption>{{ title }} data</caption>
      <thead>
        <tr>
          <th>Date</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="point in points" :key="point.date">
          <td>{{ point.date }}</td>
          <td>{{ point.value }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.trend {
  padding: 20px;
}
.trend header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.trend h2 {
  margin: 0;
  font-size: var(--fs-lg);
}
.total {
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.plot {
  height: 168px;
  display: flex;
  align-items: end;
  gap: 8px;
  padding-bottom: 2px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
}
.column {
  height: 100%;
  min-width: 38px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: end;
  align-items: center;
  gap: 5px;
}
.column i {
  width: 100%;
  max-width: 26px;
  background: linear-gradient(180deg, var(--primary) 0%, #6d67ec 100%);
  border-radius: 6px 6px 0 0;
  transition: height var(--dur) var(--ease);
}
.column .value {
  font-size: var(--fs-2xs);
  font-weight: 700;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.column .axis {
  font-size: var(--fs-2xs);
  color: var(--muted);
  white-space: nowrap;
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
