<script setup>
import { MessageCircle, RotateCcw } from 'lucide-vue-next'

defineProps({
  /** Whether the chat can currently reach the business. */
  live: { type: Boolean, default: false },
  businessName: { type: String, default: '' },
})
defineEmits(['new-conversation'])
</script>
<template>
  <header class="header">
    <div class="brand">
      <i><MessageCircle :size="18" /></i>
      <div>
        <b>{{ businessName || 'Chat with us' }}</b>
        <small :class="{ live }">
          <em />
          {{ live ? 'Online — we usually reply in a few minutes' : 'Offline' }}
        </small>
      </div>
    </div>
    <div class="actions">
      <button
        type="button"
        aria-label="Start a new conversation"
        @click="$emit('new-conversation')"
      >
        <RotateCcw :size="15" />
        <span>Start new conversation</span>
      </button>
    </div>
  </header>
</template>
<style scoped>
.header,
.brand,
.actions,
.header button {
  display: flex;
  align-items: center;
}
.header {
  justify-content: space-between;
  gap: 16px;
  padding: 15px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.brand {
  gap: 10px;
  min-width: 0;
}
.brand i {
  width: 38px;
  height: 38px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--primary-soft);
  color: var(--primary);
}
.brand > div {
  display: grid;
  min-width: 0;
}
.brand b {
  font-size: var(--fs-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.brand small {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: var(--fs-xs);
}
.brand small em {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--border-strong);
}
.brand small.live em {
  background: #17b877;
  animation: pulse 2s infinite;
}
.actions {
  gap: 8px;
  flex: none;
}
.header button {
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-2);
  font-size: var(--fs-xs);
  font-weight: 700;
  transition:
    background var(--dur) var(--ease),
    border-color var(--dur) var(--ease);
}
.header button:hover {
  background: var(--surface-2);
  border-color: var(--border-strong);
}
@media (max-width: 600px) {
  .header button span {
    display: none;
  }
  .header button svg {
    width: 18px;
    height: 18px;
  }
}
</style>
