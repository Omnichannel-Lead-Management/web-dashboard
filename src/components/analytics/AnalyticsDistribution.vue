<script setup>
import { computed } from 'vue'
const props = defineProps({
  title: { type: String, required: true },
  rows: { type: Array, default: () => [] },
})
const max = computed(() => Math.max(1, ...props.rows.map((row) => row.value)))
</script>
<template>
  <section class="card distribution">
    <h2>{{ title }}</h2>
    <p v-if="!rows.length" class="empty">No loaded records in this category.</p>
    <template v-else>
      <div aria-hidden="true" class="bars">
        <div v-for="row in rows" :key="row.category">
          <span>{{ row.category }}</span>
          <i><b :style="{ width: `${(row.value / max) * 100}%` }" /></i>
          <strong>{{ row.value }}</strong>
        </div>
      </div>
      <table>
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
  padding: 18px;
}
.distribution h2 {
  margin: 0 0 14px;
  font-size: 16px;
}
.bars > div {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) 2fr 35px;
  gap: 9px;
  align-items: center;
  margin: 9px 0;
  font-size: 12px;
}
.bars i {
  height: 9px;
  background: var(--surface-2, #eee);
  border-radius: 9px;
  overflow: hidden;
}
.bars b {
  display: block;
  height: 100%;
  background: var(--primary);
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
.empty {
  color: var(--muted);
}
</style>
