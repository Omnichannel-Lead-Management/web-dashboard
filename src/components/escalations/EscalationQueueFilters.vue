<script setup>
defineProps({ search: { type: String, default: '' }, filter: { type: String, default: 'all' }, sort: { type: String, default: 'default' } })
defineEmits(['update:search', 'update:filter', 'update:sort'])
const filters = [['all', 'All'], ['queued', 'Queued'], ['mine', 'Claimed by me'], ['others', 'Claimed by others']]
</script>
<template>
  <div class="queue-filters">
    <label>Search queue<input :value="search" placeholder="Customer, tag, summary…" @input="$emit('update:search', $event.target.value)" /></label>
    <div class="filter-buttons" aria-label="Escalation status filter">
      <button v-for="item in filters" :key="item[0]" type="button" :class="{ active: filter === item[0] }" @click="$emit('update:filter', item[0])">{{ item[1] }}</button>
    </div>
    <label>Sort<select :value="sort" @change="$emit('update:sort', $event.target.value)"><option value="default">Oldest waiting</option><option value="newest">Newest escalation</option><option value="claimed">Recently claimed</option></select></label>
  </div>
</template>
<style scoped>
.queue-filters{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:14px;align-items:end}.queue-filters label{display:grid;gap:6px;font-size:12px;font-weight:700}.queue-filters input,.queue-filters select{min-height:42px;padding:0 12px;border:1px solid var(--border);border-radius:10px;background:#fff}.filter-buttons{display:flex;gap:7px;flex-wrap:wrap}.filter-buttons button{min-height:40px;padding:0 13px;border:1px solid var(--border);border-radius:999px;background:#fff}.filter-buttons .active{color:#fff;background:var(--primary);border-color:var(--primary)}@media(max-width:850px){.queue-filters{grid-template-columns:1fr}.filter-buttons{order:3}}
</style>
