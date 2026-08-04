<script setup>
defineProps({ items: { type: Array, default: () => [] } })
</script>

<template>
  <section class="grid" aria-label="Analytics summary">
    <article
      v-for="item in items"
      :key="item.label"
      class="card kpi"
      :aria-label="`${item.label}: ${item.value ?? 'Not available'}`"
    >
      <span class="label">{{ item.label }}</span>
      <strong :class="{ unavailable: item.value == null }">
        {{ item.value ?? '—' }}
      </strong>
      <small v-if="item.note">{{ item.note }}</small>
    </article>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.kpi {
  padding: 18px;
  display: grid;
  gap: 6px;
  align-content: start;
  transition: box-shadow var(--dur) var(--ease);
}
.kpi:hover {
  box-shadow: var(--shadow-md);
}
.label {
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.kpi strong {
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.kpi strong.unavailable {
  color: var(--muted);
  font-size: 22px;
}
.kpi small {
  color: var(--muted);
  font-size: var(--fs-xs);
}
</style>
