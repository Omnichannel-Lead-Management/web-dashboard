<script setup>
import { computed, ref, watch } from 'vue'
import { Clock, UserRound } from 'lucide-vue-next'

import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'
import { appointmentStatusActions } from '../../services/mappers'

const props = defineProps({
  appointment: {
    type: Object,
    required: true,
  },
  updatingAction: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['status-change'])
const confirmingCancel = ref(false)
const actions = computed(() => appointmentStatusActions(props.appointment.status))
const isUpdating = computed(() => Boolean(props.updatingAction))
const loadingLabel = computed(
  () =>
    ({
      confirmed: 'Confirming…',
      completed: 'Completing…',
      cancelled: 'Cancelling…',
    })[props.updatingAction] || 'Updating…',
)

watch(
  () => props.appointment.status,
  () => {
    confirmingCancel.value = false
  },
)

watch(
  () => props.updatingAction,
  (current, previous) => {
    if (previous && !current) confirmingCancel.value = false
  },
)

function requestStatus(status) {
  if (isUpdating.value) return
  emit('status-change', { id: props.appointment.id, status })
}

function handleCancel() {
  if (isUpdating.value) return
  if (!confirmingCancel.value) {
    confirmingCancel.value = true
    return
  }
  requestStatus('cancelled')
}
</script>
<template>
  <article>
    <time>
      <strong>{{ appointment.time }}</strong>
      <small>{{ appointment.ampm }}</small>
    </time>
    <div>
      <h3>{{ appointment.customer }}</h3>
      <p>{{ appointment.service }}</p>
    </div>
    <span>
      <Clock :size="14" />
      {{ appointment.duration }}
    </span>
    <span>
      <UserRound :size="14" />
      {{ appointment.staff }}
    </span>
    <div class="status-cell">
      <AppBadge :tone="appointment.status">{{ appointment.status }}</AppBadge>
      <div
        v-if="actions.length || isUpdating"
        class="status-actions"
        :aria-label="`Actions for ${appointment.customer}'s appointment`"
        role="group"
      >
        <AppButton
          v-if="isUpdating"
          size="sm"
          variant="secondary"
          disabled
          aria-busy="true"
        >
          {{ loadingLabel }}
        </AppButton>
        <template v-else>
          <AppButton
            v-if="actions.includes('confirmed')"
            size="sm"
            variant="outline"
            @click="requestStatus('confirmed')"
          >
            Confirm
          </AppButton>
          <AppButton
            v-if="actions.includes('completed')"
            size="sm"
            variant="outline"
            @click="requestStatus('completed')"
          >
            Complete
          </AppButton>
          <AppButton
            v-if="actions.includes('cancelled')"
            size="sm"
            :variant="confirmingCancel ? 'danger' : 'outline'"
            :aria-expanded="confirmingCancel"
            @click="handleCancel"
          >
            {{ confirmingCancel ? 'Confirm cancel' : 'Cancel' }}
          </AppButton>
          <button
            v-if="confirmingCancel"
            type="button"
            class="keep-action"
            @click="confirmingCancel = false"
          >
            Keep appointment
          </button>
          <span v-if="confirmingCancel" class="sr-status" role="status">
            Cancellation confirmation required.
          </span>
        </template>
      </div>
    </div>
  </article>
</template>
<style scoped>
article {
  display: grid;
  grid-template-columns: 80px minmax(180px, 1fr) 90px 90px minmax(210px, auto);
  align-items: center;
  gap: 15px;
  padding: 16px 19px;
  background: #fff;
  border: 1px solid #eef0f5;
  border-radius: 13px;
}
time {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
time strong {
  font-size: 20px;
}
time small {
  font-size: 10px;
  color: var(--muted);
}
h3 {
  font-size: 13.5px;
  margin: 0 0 3px;
}
p {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
article > span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-2);
}
.status-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.status-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}
.keep-action {
  border: 0;
  padding: 4px;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  text-decoration: underline;
}
.sr-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 760px) {
  article {
    grid-template-columns: 65px 1fr auto;
  }
  article > span {
    display: none;
  }
  .status-cell {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
  .status-actions {
    justify-content: flex-start;
  }
}
@media (max-width: 600px) {
  article {
    grid-template-columns: 58px 1fr;
  }
  .status-cell {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
