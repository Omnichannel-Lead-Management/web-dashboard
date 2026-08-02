<script setup>
import {
  Radio,
  TentTree,
  MessageCircleMore,
  Bot,
  Building2,
  MessageSquareText,
} from 'lucide-vue-next'

defineProps({
  active: {
    type: String,
    default: 'channels',
  },
})

const emit = defineEmits(['select'])

const items = [
  ['channels', 'Connected channels', Radio],
  ['telegram', 'Telegram', TentTree],
  ['whatsapp', 'WhatsApp', MessageCircleMore],
  ['chatbot', 'Chatbot settings', Bot],
  ['faqs', 'FAQs & answers', MessageSquareText],
  ['profile', 'Business profile', Building2],
]
</script>
<template>
  <nav aria-label="Settings sections">
    <button
      v-for="[id, label, icon] in items"
      :key="id"
      :class="{ active: active === id }"
      @click="$emit('select', id)"
    >
      <component :is="icon" :size="17" />
      <span>{{ label }}</span>
    </button>
  </nav>
</template>
<style scoped>
nav {
  width: 220px;
  flex: none;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
button {
  border: 0;
  background: transparent;
  color: var(--text-2);
  padding: 10px 11px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
}
button.active {
  background: var(--primary-soft);
  color: var(--primary);
}
@media (max-width: 760px) {
  nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    padding: 0 0 12px;
  }
  button {
    white-space: nowrap;
    border: 1px solid var(--border);
    background: #fff;
  }
  button.active {
    border-color: #d8d8ff;
  }
}
</style>
