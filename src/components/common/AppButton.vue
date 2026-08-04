<script setup>
import { LoaderCircle } from 'lucide-vue-next'

defineProps({
  variant: {
    type: String,
    default: 'primary',
  },
  size: {
    type: String,
    default: 'md',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})
</script>
<template>
  <button
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'is-loading': loading }]"
    :disabled="loading || disabled"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading" class="btn-spinner spin" :size="15" />
    <slot>{{ loading ? 'Please wait…' : '' }}</slot>
  </button>
</template>
<style scoped>
.btn {
  position: relative;
  border: 1px solid transparent;
  border-radius: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  transition:
    background var(--dur) var(--ease),
    border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease),
    transform var(--dur-fast) var(--ease);
}
.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn--md {
  padding: 10px 16px;
  font-size: var(--fs-base);
}
.btn--sm {
  padding: 7px 12px;
  font-size: var(--fs-sm);
}
.btn--lg {
  padding: 13px 20px;
  font-size: var(--fs-md);
}

.btn--primary {
  background: var(--primary);
  color: var(--primary-contrast);
  box-shadow: 0 7px 16px -8px var(--primary);
}
.btn--primary:hover:not(:disabled) {
  background: var(--primary-dark);
  box-shadow: 0 10px 20px -8px var(--primary);
}

.btn--secondary {
  background: var(--surface-3);
  color: var(--text-2);
}
.btn--secondary:hover:not(:disabled) {
  background: #e8eaf1;
}

.btn--outline {
  background: var(--surface);
  color: var(--text-2);
  border-color: var(--border);
}
.btn--outline:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: var(--border-strong);
}

.btn--ghost {
  background: transparent;
  color: var(--text-2);
}
.btn--ghost:hover:not(:disabled) {
  background: var(--surface-3);
}

.btn--danger {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: var(--danger-border);
}
.btn--danger:hover:not(:disabled) {
  background: #f9dfd3;
}

.btn:disabled {
  opacity: 0.55;
  box-shadow: none;
}
.btn-spinner {
  flex: none;
}
</style>
