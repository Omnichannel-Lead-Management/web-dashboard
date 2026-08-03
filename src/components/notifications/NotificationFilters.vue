<script setup>
defineProps({ modelValue: { type: String, default: 'all' } })
defineEmits(['update:modelValue'])
const filters = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['leads', 'Leads'],
  ['appointments', 'Appointments'],
  ['messages', 'Messages'],
  ['system', 'System'],
]
</script>

<template>
  <div class="filters" role="group" aria-label="Filter notifications">
    <button
      v-for="[value, label] in filters"
      :key="value"
      type="button"
      :aria-pressed="modelValue === value"
      :class="{ active: modelValue === value }"
      @click="$emit('update:modelValue', value)"
    >
      {{ label }}
    </button>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding: 2px;
}
button {
  flex: none;
  padding: 7px 11px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 650;
}
button.active {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: #d8d8ff;
}
</style>
