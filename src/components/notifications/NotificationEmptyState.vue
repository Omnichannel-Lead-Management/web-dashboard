<script setup>
import { BellOff } from 'lucide-vue-next'
defineProps({ filter: { type: String, default: 'all' } })
</script>

<template>
  <div class="empty" role="status">
    <BellOff :size="26" />
    <b>No notifications found</b>
    <span v-if="filter === 'all'">New notifications will appear here.</span>
    <span v-else>There are no notifications matching this filter.</span>
  </div>
</template>

<style scoped>
.empty {
  min-height: 220px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  color: var(--muted);
}
.empty b {
  color: var(--text);
}
.empty span {
  font-size: 12px;
}
</style>
