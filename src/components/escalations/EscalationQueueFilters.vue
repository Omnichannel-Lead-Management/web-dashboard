<script setup>
import { Search } from 'lucide-vue-next'

defineProps({
  search: { type: String, default: '' },
  filter: { type: String, default: 'all' },
  sort: { type: String, default: 'default' },
})
defineEmits(['update:search', 'update:filter', 'update:sort'])

const filters = [
  ['all', 'All'],
  ['queued', 'Waiting'],
  ['mine', 'Claimed by me'],
  ['others', 'Claimed by others'],
]
</script>

<template>
  <div class="queue-filters">
    <label class="search">
      <span>Search queue</span>
      <span class="input-wrap">
        <Search :size="16" />
        <input
          :value="search"
          type="search"
          placeholder="Customer, tag or message…"
          @input="$emit('update:search', $event.target.value)"
        />
      </span>
    </label>

    <div
      class="filter-buttons"
      role="group"
      aria-label="Filter conversations by status"
    >
      <button
        v-for="[value, label] in filters"
        :key="value"
        type="button"
        :aria-pressed="filter === value"
        :class="{ active: filter === value }"
        @click="$emit('update:filter', value)"
      >
        {{ label }}
      </button>
    </div>

    <label class="sort">
      <span>Sort</span>
      <select :value="sort" @change="$emit('update:sort', $event.target.value)">
        <option value="default">Longest waiting</option>
        <option value="newest">Newest first</option>
        <option value="claimed">Recently claimed</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.queue-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  gap: 14px;
  align-items: end;
}
.queue-filters label {
  display: grid;
  gap: 6px;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.input-wrap {
  position: relative;
  display: block;
}
.input-wrap svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.input-wrap input {
  min-height: 42px;
  padding: 0 12px 0 36px;
}
.queue-filters select {
  min-height: 42px;
  padding: 0 12px;
}
.filter-buttons {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.filter-buttons button {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-2);
  font-size: var(--fs-sm);
  font-weight: 700;
  transition:
    background var(--dur) var(--ease),
    border-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
}
.filter-buttons button:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
}
.filter-buttons .active,
.filter-buttons .active:hover {
  color: var(--primary-contrast);
  background: var(--primary);
  border-color: var(--primary);
}
@media (max-width: 850px) {
  .queue-filters {
    grid-template-columns: 1fr;
  }
  .filter-buttons {
    order: 3;
  }
}
</style>
