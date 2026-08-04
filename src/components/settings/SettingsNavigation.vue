<script setup>
import {
  Radio,
  TentTree,
  MessageCircleMore,
  Bot,
  Building2,
  MessageSquareText,
  Globe2,
  Users,
  ChartNoAxesCombined,
} from 'lucide-vue-next'

defineProps({
  active: {
    type: String,
    default: 'channels',
  },
})

defineEmits(['select'])

/** Grouped so the list scans as three decisions, not nine unrelated links. */
const groups = [
  {
    title: 'Channels',
    items: [
      ['channels', 'All channels', Radio],
      ['telegram', 'Telegram', TentTree],
      ['whatsapp', 'WhatsApp', MessageCircleMore],
      ['webchat', 'Web chat', Globe2],
    ],
  },
  {
    title: 'Automation',
    items: [
      ['chatbot', 'Chatbot', Bot],
      ['faqs', 'FAQs & answers', MessageSquareText],
      ['escalations', 'Escalation queue', Users],
    ],
  },
  {
    title: 'Workspace',
    items: [
      ['analytics', 'Analytics', ChartNoAxesCombined],
      ['profile', 'Business profile', Building2],
    ],
  },
]
</script>
<template>
  <nav aria-label="Settings sections">
    <div v-for="group in groups" :key="group.title" class="group">
      <h2>{{ group.title }}</h2>
      <button
        v-for="[id, label, icon] in group.items"
        :key="id"
        type="button"
        :aria-current="active === id ? 'page' : undefined"
        :class="{ active: active === id }"
        @click="$emit('select', id)"
      >
        <component :is="icon" :size="17" />
        <span>{{ label }}</span>
      </button>
    </div>
  </nav>
</template>
<style scoped>
nav {
  width: 226px;
  flex: none;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.group h2 {
  margin: 0 0 4px 11px;
  color: var(--muted);
  font-size: var(--fs-2xs);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
button {
  border: 0;
  background: transparent;
  color: var(--text-2);
  padding: 10px 11px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  font-size: var(--fs-base);
  font-weight: 600;
  transition:
    background var(--dur) var(--ease),
    color var(--dur) var(--ease);
}
button:hover {
  background: var(--surface-2);
  color: var(--text);
}
button.active,
button.active:hover {
  background: var(--primary-soft);
  color: var(--primary);
}
button svg {
  flex: none;
  opacity: 0.85;
}
button.active svg {
  opacity: 1;
}

@media (max-width: 760px) {
  nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    padding: 0 0 12px;
    gap: 6px;
  }
  .group {
    flex-direction: row;
    gap: 6px;
  }
  .group h2 {
    display: none;
  }
  button {
    white-space: nowrap;
    border: 1px solid var(--border);
    background: var(--surface);
  }
  button.active {
    border-color: #d8d8ff;
  }
}
</style>
