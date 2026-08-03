<script setup>
defineProps({
  range: { type: Object, required: true },
  error: { type: String, default: '' },
  timezoneLabel: { type: String, default: '' },
  disabled: Boolean,
})
defineEmits(['preset', 'update:from', 'update:to'])
</script>
<template>
  <fieldset :disabled="disabled">
    <legend>Date range</legend>
    <label>
      Period
      <select
        :value="range.preset"
        @change="$emit('preset', $event.target.value)"
      >
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="month">This month</option>
        <option value="custom">Custom range</option>
      </select>
    </label>
    <template v-if="range.preset === 'custom'">
      <label>
        Start date
        <input
          type="date"
          :value="range.from"
          @input="$emit('update:from', $event.target.value)"
        />
      </label>
      <label>
        End date
        <input
          type="date"
          :value="range.to"
          @input="$emit('update:to', $event.target.value)"
        />
      </label>
    </template>
    <small>{{ timezoneLabel || `Timezone: ${range.timezone || 'UTC'}` }}</small>
    <p v-if="error" role="alert">{{ error }}</p>
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
}
legend {
  font-weight: 700;
}
label {
  display: grid;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
}
select,
input {
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: #fff;
}
small {
  color: var(--muted);
}
p {
  margin: 0;
  color: var(--danger);
}
</style>
