<script setup>
defineProps({
  tone: {
    type: String,
    default: 'neutral',
  },
})
</script>
<template>
  <span class="badge" :class="`badge--${tone.toLowerCase()}`"><slot /></span>
</template>
<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
  text-transform: capitalize;
}

.badge--neutral,
.badge--new {
  color: var(--text-2);
  background: var(--surface-3);
  border-color: #e3e5ec;
}
.badge--primary,
.badge--qualified {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: #dfe3ff;
}
.badge--contacted {
  color: #3730a3;
  background: var(--primary-soft-2);
  border-color: #cdd6ff;
}
.badge--success,
.badge--converted,
.badge--confirmed {
  color: var(--success);
  background: var(--success-bg);
  border-color: var(--success-border);
}
.badge--lost,
.badge--completed {
  color: #7a8090;
  background: var(--surface-3);
  border-color: #e3e5ec;
}
.badge--warning,
.badge--pending {
  color: var(--warning);
  background: var(--warning-bg);
  border-color: var(--warning-border);
}
.badge--cancelled,
.badge--danger {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: var(--danger-border);
}
.badge--telegram {
  color: #1a6a94;
  background: var(--telegram-bg);
  border-color: #cfe7f6;
}
.badge--whatsapp {
  color: #12724d;
  background: var(--whatsapp-bg);
  border-color: #cbe9db;
}
.badge--web {
  color: #475569;
  background: var(--web-bg);
  border-color: #e3e5ec;
}
</style>
