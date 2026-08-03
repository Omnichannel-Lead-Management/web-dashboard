<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import NotificationList from './NotificationList.vue'
import NotificationStatus from './NotificationStatus.vue'

const emit = defineEmits(['close'])
const store = useAppStore()
const router = useRouter()
const latest = computed(() => store.notifications.slice(0, 5))

function markRead(id) {
  store.markNotificationRead(id).catch(() => {})
}
function navigate(path) {
  router.push(path)
  emit('close')
}
</script>

<template>
  <section
    class="panel"
    role="dialog"
    aria-modal="false"
    aria-labelledby="notification-panel-title"
  >
    <header>
      <div>
        <h2 id="notification-panel-title">Notifications</h2>
        <small v-if="store.notificationUnreadCount">
          {{ store.notificationUnreadCount }} unread
        </small>
      </div>
      <button
        type="button"
        aria-label="Close notifications"
        @click="$emit('close')"
      >
        ×
      </button>
    </header>
    <NotificationStatus
      :unavailable="!store.notificationCenterAvailable"
      :loading="store.notificationsLoading"
      :error="store.notificationsError"
      :stale="Boolean(store.notifications.length)"
    />
    <NotificationList
      v-if="
        store.notificationCenterAvailable &&
        (!store.notificationsLoading || store.notifications.length)
      "
      :notifications="latest"
      :mutation-ids="store.notificationMutationIds"
      @mark-read="markRead"
      @navigate="navigate"
    />
    <RouterLink to="/notifications" class="all" @click="$emit('close')">
      View all notifications
    </RouterLink>
  </section>
</template>

<style scoped>
.panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: min(390px, calc(100vw - 24px));
  max-height: min(620px, calc(100vh - 90px));
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 55px rgba(31, 35, 54, 0.2);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0;
  font-size: 16px;
}
small {
  color: var(--muted);
  font-size: 10px;
}
header button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f2f6;
  font-size: 20px;
}
.panel :deep(.status) {
  margin: 12px;
}
.all {
  display: block;
  padding: 12px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}
@media (max-width: 600px) {
  .panel {
    position: fixed;
    top: 60px;
    right: 8px;
    left: 8px;
    width: auto;
    max-height: calc(100dvh - 140px);
  }
}
</style>
