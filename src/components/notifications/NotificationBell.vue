<script setup>
import { Bell } from 'lucide-vue-next'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '../../stores/app'
import NotificationPanel from './NotificationPanel.vue'

const store = useAppStore()
const open = ref(false)
const root = ref(null)
const bell = ref(null)
const badge = computed(() => {
  const count = store.notificationUnreadCount
  return count > 99 ? '99+' : String(count)
})
const bellLabel = computed(() =>
  store.notificationCenterAvailable && store.notificationUnreadCount > 0
    ? `Open notifications, ${store.notificationUnreadCount} unread`
    : 'Open notifications',
)

function close({ restoreFocus = true } = {}) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) nextTick(() => bell.value?.focus())
}
function toggle() {
  open.value = !open.value
  if (open.value) store.refreshNotifications()
}
function onKeydown(event) {
  if (event.key === 'Escape') close()
}
function onPointerDown(event) {
  if (open.value && !root.value?.contains(event.target)) close()
}
function addListeners() {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
}
function removeListeners() {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
}
watch(open, (value) => (value ? addListeners() : removeListeners()))
onUnmounted(removeListeners)
</script>

<template>
  <div ref="root" class="notification-bell">
    <button
      ref="bell"
      type="button"
      class="bell-button"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="bellLabel"
      @click="toggle"
    >
      <Bell :size="19" />
      <span
        v-if="
          store.notificationCenterAvailable && store.notificationUnreadCount > 0
        "
        class="badge"
        aria-hidden="true"
      >
        {{ badge }}
      </span>
    </button>
    <NotificationPanel v-if="open" @close="close" />
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
}
.bell-button {
  position: relative;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-2);
  background: #fff;
}
.badge {
  position: absolute;
  top: -6px;
  right: -7px;
  min-width: 19px;
  height: 19px;
  display: grid;
  place-items: center;
  padding: 0 4px;
  border: 2px solid #fff;
  border-radius: 999px;
  color: #fff;
  background: var(--danger);
  font-size: 9px;
  font-weight: 800;
}
</style>
