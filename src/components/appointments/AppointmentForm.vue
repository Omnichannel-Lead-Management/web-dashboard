<script setup>
import { reactive, ref } from 'vue'

import AppButton from '../common/AppButton.vue'
import { useAppStore } from '../../stores/app'

const props = defineProps({
  lead: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['submit'])

const store = useAppStore()
const validationError = ref('')
const appointmentForm = reactive({
  customer: props.lead?.name || '',
  service: props.lead?.interest || 'Premium package',
  date: '2026-07-25',
  time: '10:00',
  duration: '60 min',
  staff: 'Sithumi',
  notes: '',
})

function submitAppointment() {
  const hasRequiredFields =
    appointmentForm.customer && appointmentForm.date && appointmentForm.time

  if (!hasRequiredFields) {
    validationError.value = 'Customer, date and time are required.'
    return
  }

  const selectedHour = Number(appointmentForm.time.split(':')[0])
  const formattedTime = new Date(`2000-01-01T${appointmentForm.time}`)
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?(AM|PM)/, '')

  emit('submit', {
    ...appointmentForm,
    ampm: selectedHour >= 12 ? 'PM' : 'AM',
    time: formattedTime,
  })

  store.notify('Appointment details validated')
}
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
    <label class="field">
      Time *
      <input v-model="appointmentForm.time" type="time" required />
    </label>
    <label class="field">
      Duration
      <select v-model="appointmentForm.duration">
        <option>30 min</option>
        <option>60 min</option>
        <option>90 min</option>
        <option>120 min</option>
      </select>
    </label>
    <label class="field wide">
      Internal notes
      <textarea
        v-model="appointmentForm.notes"
        rows="3"
        placeholder="Add preparation details or preferences"
      />
    </label>
    <p v-if="validationError" class="error wide">{{ validationError }}</p>
    <div class="actions wide">
      <RouterLink to="/appointments">Cancel</RouterLink>
      <AppButton>Create appointment</AppButton>
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
@media (max-width: 600px) {
  form {
    grid-template-columns: 1fr;
    padding: 18px;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
