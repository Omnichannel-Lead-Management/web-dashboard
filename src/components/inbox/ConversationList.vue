<script setup>
import { computed } from 'vue'
import { MessagesSquare, Search } from 'lucide-vue-next'
import ConversationListItem from './ConversationListItem.vue'

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  search: { type: String, default: '' },
  filter: { type: String, default: 'All' },
  escalationEnabled: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'update:search', 'update:filter'])
const filters = computed(() =>
  props.escalationEnabled ? ['All', 'Unread', 'Escalated'] : ['All', 'Unread'],
)

const filteredConversations = computed(() =>
  props.conversations.filter((conversation) => {
    const query = props.search.toLowerCase()
    const matchesSearch =
      !query ||
      `${conversation.name} ${conversation.preview}`
        .toLowerCase()
        .includes(query)
    const matchesFilter =
      props.filter === 'All' ||
      (props.filter === 'Unread' && conversation.unread) ||
      (props.filter === 'Escalated' && conversation.escalated)
    return matchesSearch && matchesFilter
  }),
)
/**
 * One plain stack, with anything waiting on a human floated to the top so an
 * agent sees it first. The row itself carries the "Escalated" tag.
 */
const orderedConversations = computed(() => {
  if (!props.escalationEnabled) return filteredConversations.value
  const escalated = []
  const rest = []
  for (const conversation of filteredConversations.value) {
    if (conversation.escalated) escalated.push(conversation)
    else rest.push(conversation)
  }
  return [...escalated, ...rest]
})
</script>

<template>
  <aside class="list">
    <div class="tools">
      <label>
        <Search :size="18" />
        <input
          type="search"
          aria-label="Search conversations"
          placeholder="Search conversations"
          :value="search"
          @input="emit('update:search', $event.target.value)"
        />
      </label>
      <div class="filters">
        <button
          v-for="item in filters"
          :key="item"
          :class="{ active: filter === item }"
          @click="emit('update:filter', item)"
        >
          {{ item }}
        </button>
      </div>
    </div>
    <div class="scroll">
      <h2 v-if="orderedConversations.length">Conversations</h2>
      <ConversationListItem
        v-for="conversation in orderedConversations"
        :key="conversation.id"
        :conversation="conversation"
        :active="selectedId === conversation.id"
        @click="emit('select', conversation.id)"
      />
      <div v-if="!filteredConversations.length" class="empty-state">
        <span class="empty-icon"><MessagesSquare :size="22" /></span>
        <h3>
          {{
            conversations.length
              ? 'Nothing matches that'
              : 'No conversations yet'
          }}
        </h3>
        <p>
          {{
            conversations.length
              ? 'Try clearing your search or switching filter.'
              : 'New customer messages will appear here as soon as they arrive.'
          }}
        </p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.list {
  width: 466px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fafafc;
  border-right: 1px solid var(--border-strong);
}
.tools {
  flex: none;
  padding: 20px 20px 14px;
  background: #fafafc;
}
.tools label {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid #e1e4ec;
  border-radius: 12px;
  transition:
    border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.tools label:focus-within {
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.tools input {
  border: 0;
  padding: 0;
  outline: 0;
  background: transparent;
  font-size: 14px;
}
.tools input:focus {
  box-shadow: none;
}
.filters {
  display: flex;
  gap: 8px;
  margin-top: 15px;
}
.filters button {
  padding: 7px 14px;
  color: var(--text-2);
  background: var(--surface);
  border: 1px solid #dfe2ea;
  border-radius: var(--radius-pill);
  font-size: var(--fs-sm);
  font-weight: 700;
  transition:
    background var(--dur) var(--ease),
    border-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
}
.filters button:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
}
.filters button.active,
.filters button.active:hover {
  color: #fff;
  background: var(--primary);
  border-color: var(--primary);
}
.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.scroll h2 {
  margin: 15px 20px 8px;
  color: #98a2b3;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
@media (max-width: 1100px) {
  .list {
    width: 380px;
  }
}
@media (max-width: 760px) {
  .list {
    width: 100%;
    height: 100%;
    border-right: 0;
  }
}
</style>
