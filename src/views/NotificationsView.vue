<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import AppButton from '../components/common/AppButton.vue'
import NotificationFilters from '../components/notifications/NotificationFilters.vue'
import NotificationList from '../components/notifications/NotificationList.vue'
import NotificationStatus from '../components/notifications/NotificationStatus.vue'
import { filterNotifications } from '../services/notifications'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const router = useRouter()
const filter = ref('all')
const filtered = computed(() =>
  filterNotifications(store.notifications, filter.value),
)
const initialLoading = computed(
  () => store.notificationsLoading && !store.notificationsLoadedForBusinessId,
)
const markingAll = computed(() =>
  store.notificationMutationIds.includes('__all__'),
)

function refresh() {
  store.refreshNotifications()
}
function markRead(id) {
  store.markNotificationRead(id).catch(() => {})
}
function markAll() {
  store.markAllNotificationsRead().catch(() => {})
}
onMounted(refresh)
</script>

<template>
  <AppShell>
    <div class="page notifications-page">
      <div class="page-title">
        <div>
          <h1>Notifications</h1>
          <p>Everything that happened while you were away.</p>
        </div>
        <div class="page-actions">
          <AppButton
            variant="outline"
            :disabled="
              !store.notificationCenterAvailable || store.notificationsLoading
            "
            @click="refresh"
          >
            {{ store.notificationsLoading ? 'Refreshing…' : 'Refresh' }}
          </AppButton>
          <AppButton
            :disabled="
              !store.notificationCenterAvailable ||
              store.notificationUnreadCount === 0 ||
              markingAll
            "
            @click="markAll"
          >
            {{ markingAll ? 'Marking…' : 'Mark all as read' }}
          </AppButton>
        </div>
      </div>

      <NotificationStatus
        :unavailable="!store.notificationCenterAvailable"
        :loading="initialLoading"
        :error="store.notificationsError"
        :stale="Boolean(store.notifications.length)"
      />

      <section v-if="store.notificationCenterAvailable" class="card centre">
        <div class="toolbar">
          <NotificationFilters v-model="filter" />
          <small v-if="store.notificationsLastUpdatedAt">
            Last updated
            {{
              new Date(store.notificationsLastUpdatedAt).toLocaleTimeString()
            }}
          </small>
        </div>
        <NotificationList
          v-if="!initialLoading"
          :notifications="filtered"
          :mutation-ids="store.notificationMutationIds"
          :filter="filter"
          @mark-read="markRead"
          @navigate="router.push($event)"
        />
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.notifications-page {
  overflow-y: auto;
}
.page-actions {
  display: flex;
  gap: 9px;
}
.notifications-page > .status {
  margin-bottom: 14px;
}
.centre {
  overflow: hidden;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--border);
}
.toolbar small {
  flex: none;
  color: var(--muted);
  font-size: 10px;
}
@media (max-width: 700px) {
  .page-title,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .page-actions :deep(button) {
    flex: 1;
  }
  .notifications-page {
    padding-bottom: 90px;
  }
}
</style>
