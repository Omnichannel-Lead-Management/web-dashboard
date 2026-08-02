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
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.badge--neutral,
.badge--new {
  color: #565c6e;
  background: #eef0f5;
}
.badge--primary,
.badge--qualified {
  color: #4f46e5;
  background: #eef2ff;
}
.badge--contacted {
  color: #3730a3;
  background: #e0e7ff;
}
.badge--success,
.badge--converted,
.badge--confirmed {
  color: #0f7a54;
  background: #dff3e8;
}
.badge--lost,
.badge--completed {
  color: #7a8090;
  background: #f1f2f6;
}
.badge--warning {
  color: #b25a12;
  background: #fdecd3;
}
.badge--pending {
  color: #b25a12;
  background: #fdecd3;
}
.badge--cancelled {
  color: var(--danger);
  background: var(--danger-bg);
}
.badge--telegram {
  color: #1a6a94;
  background: #e3f2fb;
}
.badge--whatsapp {
  color: #12724d;
  background: #e2f4ec;
}
.badge--web {
  color: #475569;
  background: #eef0f5;
}
</style>
