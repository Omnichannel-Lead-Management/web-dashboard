<script setup>
import { AlertCircle, BellOff, RefreshCw } from 'lucide-vue-next'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  unavailable: { type: Boolean, default: false },
  stale: { type: Boolean, default: false },
})
</script>

<template>
  <div v-if="unavailable" class="status notice--warning" role="status">
    <BellOff :size="18" />
    <p>
      Notifications are switched off for this workspace. Contact your
      administrator to turn them on.
    </p>
  </div>
  <div v-else-if="loading && !stale" class="status" role="status">
    <RefreshCw class="spin" :size="18" />
    <p>Loading your notifications…</p>
  </div>
  <div v-else-if="error" class="status notice--danger" role="alert">
    <AlertCircle :size="18" />
    <p>
      <b>
        {{ stale ? 'Could not refresh.' : 'Could not load notifications.' }}
      </b>
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 13px 15px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-2);
  background: var(--surface-2);
  font-size: var(--fs-sm);
  line-height: 1.55;
}
.status > svg {
  flex: none;
  margin-top: 1px;
}
.status p {
  margin: 0;
}
.notice--warning {
  color: var(--warning);
  background: var(--warning-bg);
  border-color: var(--warning-border);
}
.notice--danger {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: var(--danger-border);
}
</style>
