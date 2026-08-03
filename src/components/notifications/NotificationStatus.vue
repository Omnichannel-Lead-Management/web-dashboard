<script setup>
defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  unavailable: { type: Boolean, default: false },
  stale: { type: Boolean, default: false },
})
</script>

<template>
  <div v-if="unavailable" class="status unavailable" role="status">
    Notification Centre is ready in the dashboard, but live notifications
    require the gateway notification API.
  </div>
  <div v-else-if="loading && !stale" class="status" role="status">
    Loading notifications…
  </div>
  <div v-else-if="error" class="status error" role="alert">
    <b>{{ stale ? 'Refresh failed.' : 'Notifications unavailable.' }}</b>
    {{ error }}
  </div>
</template>

<style scoped>
.status {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-2);
  background: #f8f9fb;
  font-size: 12px;
  line-height: 1.5;
}
.unavailable {
  color: #795b00;
  background: #fff8e3;
  border-color: #f1e5bd;
}
.error {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: #f4cbbd;
}
</style>
