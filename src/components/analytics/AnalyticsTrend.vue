<script setup>
import { computed } from 'vue'
const props = defineProps({
  title: { type: String, required: true },
  points: { type: Array, default: () => [] },
})
const max = computed(() =>
  Math.max(1, ...props.points.map((point) => point.value)),
)
</script>
<template>
  <section v-if="points.length" class="card trend">
    <h2>{{ title }}</h2>
    <div class="plot" aria-hidden="true">
      <div v-for="point in points" :key="point.date">
        <i :style="{ height: `${Math.max(3, (point.value / max) * 100)}%` }" />
        <span>{{ point.date.slice(5) }}</span>
      </div>
    </div>
    <table>
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
  padding: 18px;
}
.trend h2 {
  margin: 0 0 14px;
  font-size: 16px;
}
.plot {
  height: 150px;
  display: flex;
  align-items: end;
  gap: 6px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
}
.plot div {
  height: 100%;
  min-width: 34px;
  display: flex;
  flex-direction: column;
  justify-content: end;
  align-items: center;
  gap: 5px;
}
.plot i {
  width: 18px;
  background: var(--primary);
  border-radius: 5px 5px 0 0;
}
.plot span {
  font-size: 9px;
  color: var(--muted);
}
table {
  width: 100%;
  margin-top: 14px;
  border-collapse: collapse;
}
caption {
  text-align: left;
  font-weight: 700;
  padding: 8px 0;
}
th,
td {
  text-align: left;
  padding: 7px;
  border-bottom: 1px solid var(--border);
}
</style>
