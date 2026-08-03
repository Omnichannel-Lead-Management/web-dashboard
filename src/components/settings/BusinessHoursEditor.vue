<script setup>
import { BUSINESS_DAYS } from '../../services/businessProfile'

const props = defineProps({
  modelValue: { type: Object, required: true },
  errors: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

function label(day) {
  return day[0].toUpperCase() + day.slice(1)
}

function update(day, field, value) {
  emit('update:modelValue', {
    ...props.modelValue,
    [day]: { ...props.modelValue[day], [field]: value },
  })
}
</script>

<template>
  <fieldset class="hours" :disabled="disabled">
    <legend>Business hours</legend>
    <p>
      Enabled days require opening and closing times. Overnight hours are not
      supported.
    </p>
    <div v-for="day in BUSINESS_DAYS" :key="day" class="day-row">
      <label class="day-toggle">
        <input
          type="checkbox"
          :checked="modelValue[day].enabled"
          @change="update(day, 'enabled', $event.target.checked)"
        />
        {{ label(day) }}
      </label>
      <label>
        <span>Open</span>
        <input
          type="time"
          :value="modelValue[day].open"
          :disabled="!modelValue[day].enabled || disabled"
          @input="update(day, 'open', $event.target.value)"
        />
      </label>
      <label>
        <span>Close</span>
        <input
          type="time"
          :value="modelValue[day].close"
          :disabled="!modelValue[day].enabled || disabled"
          @input="update(day, 'close', $event.target.value)"
        />
      </label>
      <small v-if="errors[day]" class="error">{{ errors[day] }}</small>
    </div>
  </fieldset>
</template>

<style scoped>
.hours {
  border: 0;
  padding: 0;
  margin: 8px 0 0;
  display: grid;
  gap: 8px;
}
legend {
  font-weight: 700;
  margin-bottom: 4px;
}
.hours > p {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 12px;
}
.day-row {
  display: grid;
  grid-template-columns: 125px 1fr 1fr;
  gap: 10px;
  align-items: end;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.day-row label {
  display: grid;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
}
.day-toggle {
  display: flex !important;
  align-items: center;
  gap: 8px !important;
  padding-bottom: 10px;
}
.day-toggle input {
  width: 18px;
  height: 18px;
}
.error {
  grid-column: 2 / -1;
  color: var(--danger);
}
@media (max-width: 620px) {
  .day-row {
    grid-template-columns: 1fr 1fr;
  }
  .day-toggle {
    grid-column: 1 / -1;
    padding-bottom: 0;
  }
  .error {
    grid-column: 1 / -1;
  }
}
</style>
