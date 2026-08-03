<script setup>
import {
  Bell,
  CalendarDays,
  Check,
  MessageCircle,
  UserRoundPlus,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { formatNotificationTime } from '../../services/notifications'

const props = defineProps({
  notification: { type: Object, required: true },
  marking: { type: Boolean, default: false },
})
defineEmits(['mark-read', 'navigate'])

const icon = computed(
  () =>
    ({
      lead: UserRoundPlus,
      appointment: CalendarDays,
      message: MessageCircle,
      system: Bell,
      other: Bell,
    })[props.notification.type] || Bell,
)
</script>

<template>
  <li class="item" :class="{ unread: !notification.isRead }">
    <span class="type-icon"><component :is="icon" :size="17" /></span>
    <div class="copy">
      <div class="title-row">
        <b>{{ notification.title || 'Notification' }}</b>
        <span v-if="!notification.isRead" class="unread-label">Unread</span>
      </div>
      <p>{{ notification.body || 'No additional details.' }}</p>
      <small>{{ formatNotificationTime(notification.createdAt) }}</small>
      <div class="actions">
        <button
          v-if="notification.actionUrl"
          type="button"
          @click="$emit('navigate', notification.actionUrl)"
        >
          View details
        </button>
        <button
          v-if="!notification.isRead"
          type="button"
          :disabled="marking"
          @click="$emit('mark-read', notification.id)"
        >
          <Check :size="14" />
          {{ marking ? 'Marking…' : 'Mark as read' }}
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.item {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--border);
  overflow-wrap: anywhere;
}
.item.unread {
  border-left: 3px solid var(--primary);
  background: #fafaff;
}
.type-icon {
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--primary);
  background: var(--primary-soft);
}
.copy {
  min-width: 0;
  flex: 1;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-row b {
  font-size: 13px;
}
.unread-label {
  color: var(--primary);
  font-size: 10px;
  font-weight: 750;
}
p {
  margin: 4px 0;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.45;
}
small {
  color: var(--muted);
  font-size: 10px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--primary);
  background: #fff;
  font-size: 10px;
  font-weight: 700;
}
</style>
