<script setup>
import { BellOff } from 'lucide-vue-next'

defineProps({ filter: { type: String, default: 'all' } })
</script>

<template>
  <div class="empty-state" role="status">
    <span class="empty-icon"><BellOff :size="24" /></span>
    <h3>{{ filter === 'all' ? 'You are all caught up' : 'Nothing here' }}</h3>
    <p v-if="filter === 'all'">
      New leads, handoffs and appointment changes will show up here.
    </p>
    <p v-else>No notifications match this filter.</p>
  </div>
</template>

<style scoped>
.empty-state {
  min-height: 240px;
  align-content: center;
}
</style>
