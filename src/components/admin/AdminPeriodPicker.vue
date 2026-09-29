<script setup>
import { computed } from 'vue'
import {
  monthPeriod,
  previousMonthPeriod,
  defaultPeriod,
} from '../../stores/admin'

const props = defineProps({
  period: { type: Object, required: true },
  disabled: Boolean,
})
const emit = defineEmits(['change'])

/**
 * Billing questions are asked in whole months far more often than in rolling
 * windows, so "last month" — the period you actually invoice — is a preset,
 * not something to reconstruct by hand every time.
 */
const presets = [
  { value: 'month', label: 'This month', build: () => monthPeriod() },
  {
    value: 'last-month',
    label: 'Last month',
    build: () => previousMonthPeriod(),
  },
  { value: '30d', label: 'Last 30 days', build: () => defaultPeriod() },
  { value: 'custom', label: 'Custom range', build: null },
]

/** Derived from the dates themselves, so the dropdown never contradicts them. */
const activePreset = computed(() => {
  const match = presets.find(
    (preset) =>
      preset.build &&
      preset.build().from === props.period.from &&
      preset.build().to === props.period.to,
  )
  return match?.value ?? 'custom'
})

const invalid = computed(() => props.period.from > props.period.to)

function choosePreset(value) {
  const preset = presets.find((entry) => entry.value === value)
  if (preset?.build) emit('change', preset.build())
}
</script>
<template>
  <fieldset :disabled="disabled">
    <legend>Period</legend>
    <label>
      Range
      <select :value="activePreset" @change="choosePreset($event.target.value)">
        <option
          v-for="preset in presets"
          :key="preset.value"
          :value="preset.value"
        >
          {{ preset.label }}
        </option>
      </select>
    </label>
    <label>
      From
      <input
        type="date"
        :value="period.from"
        @input="emit('change', { from: $event.target.value, to: period.to })"
      />
    </label>
    <label>
      To
      <input
        type="date"
        :value="period.to"
        @input="emit('change', { from: period.from, to: $event.target.value })"
      />
    </label>
    <small>Counts are in UTC days.</small>
    <p v-if="invalid" role="alert">
      The start date must be on or before the end date.
    </p>
  </fieldset>
</template>
<style scoped>
fieldset {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
legend {
  font-weight: 700;
  font-size: var(--fs-sm);
  padding: 0 6px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-2);
}
select,
input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font: inherit;
  font-size: var(--fs-base);
  color: var(--text);
}
select:focus-visible,
input:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: var(--ring);
}
small {
  color: var(--muted);
  font-size: var(--fs-xs);
  margin-bottom: 9px;
}
p {
  flex-basis: 100%;
  margin: 0;
  color: var(--danger);
  font-size: var(--fs-sm);
  font-weight: 600;
}
</style>
