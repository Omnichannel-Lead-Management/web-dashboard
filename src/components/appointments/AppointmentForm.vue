<script setup>
import { computed, reactive, ref, watch } from 'vue'

import AppButton from '../common/AppButton.vue'
import { appointmentService } from '../../services/appointmentService'
import {
  clearAppointmentSlot,
  isAppointmentSubmissionReady,
  isAvailabilityFullyBooked,
  isAvailabilityRequestCurrent,
  selectAppointmentSlot,
} from '../../services/mappers'

const props = defineProps({
  lead: {
    type: Object,
    default: null,
  },
  businessId: {
    type: String,
    required: true,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['submit'])

const validationError = ref('')
const availabilityError = ref('')
const availabilityLoading = ref(false)
const availability = ref({ businessId: '', date: '', slots: [] })
let availabilityRequestId = 0
const appointmentForm = reactive({
  customer: props.lead?.name || '',
  service: props.lead?.interest || 'Premium package',
  date: '',
  startTime: '',
  endTime: '',
  staff: 'Sithumi',
  notes: '',
})

const selectedSlotStart = computed(() => appointmentForm.startTime)
const fullyBooked = computed(() =>
  isAvailabilityFullyBooked({
    date: appointmentForm.date,
    slots: availability.value.slots,
    loading: availabilityLoading.value,
    error: availabilityError.value,
  }),
)
const canSubmit = computed(() =>
  isAppointmentSubmissionReady(appointmentForm, {
    availabilityLoading: availabilityLoading.value,
    submitting: props.submitting,
  }),
)

function clearSelectedSlot() {
  Object.assign(appointmentForm, clearAppointmentSlot(appointmentForm))
}

async function loadAvailability() {
  const requestDate = appointmentForm.date
  const requestId = ++availabilityRequestId
  clearSelectedSlot()
  availability.value = { businessId: props.businessId, date: requestDate, slots: [] }
  availabilityError.value = ''

  if (!requestDate || !props.businessId) {
    availabilityLoading.value = false
    return
  }

  availabilityLoading.value = true
  try {
    const result = await appointmentService.getAvailability({
      businessId: props.businessId,
      date: requestDate,
    })
    if (
      !isAvailabilityRequestCurrent({
        requestDate,
        selectedDate: appointmentForm.date,
        requestId,
        latestRequestId: availabilityRequestId,
      })
    ) {
      return
    }
    availability.value = result
  } catch {
    if (
      !isAvailabilityRequestCurrent({
        requestDate,
        selectedDate: appointmentForm.date,
        requestId,
        latestRequestId: availabilityRequestId,
      })
    ) {
      return
    }
    availabilityError.value = 'We could not load available times. Try again.'
  } finally {
    if (
      isAvailabilityRequestCurrent({
        requestDate,
        selectedDate: appointmentForm.date,
        requestId,
        latestRequestId: availabilityRequestId,
      })
    ) {
      availabilityLoading.value = false
    }
  }
}

watch(
  [() => appointmentForm.date, () => props.businessId],
  () => loadAvailability(),
)

function selectSlot(slot) {
  if (availabilityLoading.value) return
  Object.assign(appointmentForm, selectAppointmentSlot(appointmentForm, slot))
  validationError.value = ''
}

function submitAppointment() {
  if (!canSubmit.value) {
    validationError.value =
      'Customer, service, date and an available time are required.'
    return
  }

  validationError.value = ''
  emit('submit', { ...appointmentForm })
}

async function refreshAvailabilityAfterConflict() {
  clearSelectedSlot()
  await loadAvailability()
}

defineExpose({ refreshAvailabilityAfterConflict })
</script>
<template>
  <form class="card" @submit.prevent="submitAppointment">
    <label class="field wide">
      Customer *
      <input
        v-model.trim="appointmentForm.customer"
        required
        placeholder="Customer name"
      />
    </label>
    <label class="field">
      Service *
      <select v-model="appointmentForm.service">
        <option>Premium package</option>
        <option>Signature haircut</option>
        <option>Coloring</option>
        <option>Bridal trial</option>
      </select>
    </label>
    <label class="field">
      Assigned staff
      <select v-model="appointmentForm.staff">
        <option>Sithumi</option>
        <option>Nimali</option>
      </select>
    </label>
    <label class="field">
      Date *
      <input v-model="appointmentForm.date" type="date" required />
    </label>
    <fieldset class="slot-picker wide" :disabled="availabilityLoading">
      <legend>Available times *</legend>
      <p class="schedule-note">
        Available times are generated from the system-wide business schedule.
      </p>
      <p v-if="!appointmentForm.date" class="slot-state">
        Select a date to see available times.
      </p>
      <p v-else-if="availabilityLoading" class="slot-state" role="status">
        Loading available times…
      </p>
      <div v-else-if="availabilityError" class="availability-error" role="alert">
        <span>{{ availabilityError }}</span>
        <AppButton type="button" size="sm" variant="outline" @click="loadAvailability">
          Retry
        </AppButton>
      </div>
      <p v-else-if="fullyBooked" class="slot-state">
        No available times for this date. This date is fully booked.
      </p>
      <div v-else class="slots" role="group" aria-label="Available appointment times">
        <button
          v-for="slot in availability.slots"
          :key="slot.startTime"
          type="button"
          class="slot"
          :class="{ selected: selectedSlotStart === slot.startTime }"
          :aria-pressed="selectedSlotStart === slot.startTime"
          @click="selectSlot(slot)"
        >
          {{ slot.label }}
        </button>
      </div>
    </fieldset>
    <label class="field wide">
      Internal notes
      <textarea
        v-model="appointmentForm.notes"
        rows="3"
        placeholder="Add preparation details or preferences"
      />
    </label>
    <p v-if="validationError" class="error wide" role="alert">
      {{ validationError }}
    </p>
    <div class="actions wide">
      <RouterLink to="/appointments">Cancel</RouterLink>
      <AppButton :loading="submitting" :disabled="!canSubmit">
        {{ submitting ? 'Creating appointment…' : 'Create appointment' }}
      </AppButton>
    </div>
  </form>
</template>
<style scoped>
form {
  max-width: 760px;
  padding: 25px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 17px;
}
.wide {
  grid-column: 1/-1;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.actions a {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}
.error {
  color: #b42318;
  font-size: 12px;
}
.slot-picker {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.slot-picker legend {
  margin-bottom: 5px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}
.schedule-note,
.slot-state {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.schedule-note {
  margin-bottom: 11px;
}
.slots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.slot {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text-2);
  background: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}
.slot:hover {
  border-color: var(--primary);
}
.slot:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.slot.selected {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-soft);
}
.availability-error {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #b42318;
  font-size: 12px;
}
@media (max-width: 760px) {
  .slots {
    gap: 7px;
  }
}
@media (max-width: 600px) {
  form {
    grid-template-columns: 1fr;
    padding: 18px;
  }
  .wide {
    grid-column: auto;
  }
  .availability-error {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
