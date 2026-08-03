<script setup>
defineProps({
  state: { type: String, required: true },
  error: { type: String, default: '' },
  enabled: { type: Boolean, default: false },
})
defineEmits(['reconnect'])
const labels = {
  idle: 'Unavailable',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
  error: 'Connection unavailable',
  closed: 'Closed',
}
</script>
<template>
  <div class="state" :class="state" role="status" aria-live="polite">
    <span>
      <i />
      {{ labels[state] || state }}
    </span>
    <small v-if="error">{{ error }}</small>
    <button
      v-if="enabled && ['error', 'closed', 'offline'].includes(state)"
      type="button"
      @click="$emit('reconnect')"
    >
      Reconnect
    </button>
  </div>
</template>
<style scoped>
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 34px;
  padding: 7px 12px;
  background: #f7f8fb;
  color: var(--muted);
  font-size: 11px;
}
.state span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #98a2b3;
}
.connected i {
  background: var(--success);
}
.error i,
.offline i {
  background: var(--danger);
}
.state button {
  border: 0;
  background: transparent;
  color: var(--primary);
  font-weight: 700;
}
.state small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
