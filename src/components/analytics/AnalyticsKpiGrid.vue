<script setup>
defineProps({ items: { type: Array, default: () => [] } })
</script>
<template>
  <section class="grid" aria-label="Analytics summary">
    <article
      v-for="item in items"
      :key="item.label"
      class="card"
      :aria-label="`${item.label}: ${item.value ?? 'Unavailable'}`"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.value ?? 'Unavailable' }}</strong>
      <small v-if="item.note">{{ item.note }}</small>
    </article>
  </section>
</template>
<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.card {
  padding: 17px;
  display: grid;
  gap: 6px;
}
.card span,
.card small {
  color: var(--muted);
}
.card strong {
  font-size: 26px;
}
@media (max-width: 850px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
