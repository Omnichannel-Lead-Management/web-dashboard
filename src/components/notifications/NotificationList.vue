<script setup>
import NotificationEmptyState from './NotificationEmptyState.vue'
import NotificationItem from './NotificationItem.vue'

defineProps({
  notifications: { type: Array, default: () => [] },
  mutationIds: { type: Array, default: () => [] },
  filter: { type: String, default: 'all' },
})
defineEmits(['mark-read', 'navigate'])
</script>

<template>
  <NotificationEmptyState v-if="!notifications.length" :filter="filter" />
  <ul v-else class="list" aria-label="Notifications">
    <NotificationItem
      v-for="notification in notifications"
      :key="notification.id"
      :notification="notification"
      :marking="mutationIds.includes(notification.id)"
      @mark-read="$emit('mark-read', $event)"
      @navigate="$emit('navigate', $event)"
    />
  </ul>
</template>

<style scoped>
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
