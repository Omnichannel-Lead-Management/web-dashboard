<script setup>
import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'
import LeadStatusBadge from './LeadStatusBadge.vue'

defineProps({
  leads: {
    type: Array,
    default: () => [],
  },
  selectedIds: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['toggle-selection'])
</script>
<template>
  <div class="table card">
    <table>
      <thead>
        <tr>
          <th><span class="sr-only">Select</span></th>
          <th>Lead</th>
          <th>Platform</th>
          <th>Status</th>
          <th>Score</th>
          <th>Interest</th>
          <th>Agent</th>
          <th>Age</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="l in leads"
          :key="l.id"
          tabindex="0"
          @click="$router.push(`/leads/${l.id}`)"
          @keydown.enter="$router.push(`/leads/${l.id}`)"
        >
          <td class="select-cell">
            <input
              type="checkbox"
              :checked="selectedIds.includes(l.id)"
              :aria-label="`Select lead ${l.name}`"
              @click.stop
              @change="$emit('toggle-selection', l.id)"
            />
          </td>
          <td>
            <AppAvatar :initials="l.initials" :channel="l.channel" />
            <span>
              <strong>{{ l.name }}</strong>
              <small class="mono">#{{ l.id }}</small>
            </span>
          </td>
          <td>
            <AppBadge :tone="l.channel">{{ l.channel }}</AppBadge>
          </td>
          <td><LeadStatusBadge :status="l.status" /></td>
          <td>
            <b :class="{ hot: l.score >= 70 }">{{ l.score }}</b>
          </td>
          <td>{{ l.interest }}</td>
          <td>{{ l.agent }}</td>
          <td class="mono">{{ l.age }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.table {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}
th {
  text-align: left;
  color: var(--muted);
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 17px;
  background: #fbfbfd;
}
td {
  padding: 13px 17px;
  border-top: 1px solid #eef0f5;
  font-size: 12.5px;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: #fafaff;
}
td:nth-child(2) {
  display: flex;
  align-items: center;
  gap: 10px;
}
td:nth-child(2) span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.select-cell {
  width: 34px;
  padding-right: 0;
}
.select-cell input {
  width: 16px;
  height: 16px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
td small {
  font-size: 9.5px;
  color: var(--muted);
}
.hot {
  color: #b25a12;
}
</style>
