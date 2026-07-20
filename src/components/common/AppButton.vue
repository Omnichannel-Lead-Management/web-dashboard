<script setup>
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
})
</script>
<template>
  <button
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`]"
    :disabled="loading"
  >
    <slot>{{ loading ? 'Please wait…' : '' }}</slot>
  </button>
</template>
<style scoped>
.btn {
  border: 0;
  border-radius: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}
.btn--md {
  padding: 10px 16px;
  font-size: 13.5px;
}
.btn--sm {
  padding: 7px 11px;
  font-size: 12.5px;
}
.btn--lg {
  padding: 13px 18px;
  font-size: 15px;
}
.btn--primary {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 7px 16px -8px var(--primary);
}
.btn--primary:hover {
  background: var(--primary-dark);
}
.btn--secondary {
  background: #f1f2f6;
  color: var(--text-2);
}
.btn--outline {
  background: #fff;
  color: var(--text-2);
  border: 1px solid var(--border);
}
.btn--danger {
  background: var(--danger-bg);
  color: var(--danger);
}
.btn:disabled {
  opacity: 0.55;
}
</style>
