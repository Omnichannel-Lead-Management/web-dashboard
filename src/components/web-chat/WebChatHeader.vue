<script setup>
import { MessageCircle, RotateCcw } from 'lucide-vue-next'
defineProps({ prototype: { type: Boolean, default: false } })
defineEmits(['new-conversation'])
</script>
<template>
  <header class="header">
    <div class="brand">
      <i><MessageCircle :size="18" /></i>
      <div>
        <b>Loop Assistant</b>
        <small>Customer chat preview</small>
      </div>
    </div>
    <div class="actions">
      <span v-if="prototype" class="badge">Prototype mode</span>
      <button type="button" @click="$emit('new-conversation')">
        <RotateCcw :size="15" />
        Start new conversation
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
  background: #fff;
}
.brand {
  gap: 10px;
}
.brand i {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--primary-soft);
  color: var(--primary);
}
.brand div {
  display: grid;
}
.brand small {
  color: var(--muted);
  font-size: 11px;
}
.actions {
  gap: 8px;
}
.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 5px 8px;
  border-radius: 999px;
  background: #fff3cd;
  color: #7a5b00;
}
.header button {
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 650;
}
@media (max-width: 600px) {
  .header {
    align-items: flex-start;
  }
  .actions {
    align-items: flex-end;
    flex-direction: column;
  }
  .header button {
    font-size: 0;
  }
  .header button svg {
    width: 20px;
    height: 20px;
  }
}
</style>
