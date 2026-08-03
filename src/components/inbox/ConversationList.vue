<script setup>
import { computed } from 'vue'
import { Search } from 'lucide-vue-next'
import ConversationListItem from './ConversationListItem.vue'
import TriageQueue from './TriageQueue.vue'

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
const escalated = computed(() =>
  props.escalationEnabled
    ? filteredConversations.value.filter((conversation) => conversation.escalated)
    : [],
)
const regular = computed(() =>
  props.escalationEnabled
    ? filteredConversations.value.filter((conversation) => !conversation.escalated)
    : filteredConversations.value,
)
</script>

<template>
  <aside class="list">
    <div class="tools">
      <label>
        <Search :size="18" />
        <input
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
      <TriageQueue
        v-if="escalated.length"
        :conversations="escalated"
        @open="emit('select', $event)"
      />
      <h2 v-if="regular.length">Conversations</h2>
      <ConversationListItem
        v-for="conversation in regular"
        :key="conversation.id"
        :conversation="conversation"
        :active="selectedId === conversation.id"
        @click="emit('select', conversation.id)"
      />
      <div v-if="!filteredConversations.length" class="empty">
        No conversations match.
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
  border-right: 1px solid #e7e9f0;
}
.tools {
  padding: 20px 20px 14px;
}
.tools label {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  color: #98a2b3;
  background: #fff;
  border: 1px solid #e1e4ec;
  border-radius: 12px;
}
.tools input {
  border: 0;
  padding: 0;
  outline: 0;
  background: transparent;
  font-size: 14px;
}
.filters {
  display: flex;
  gap: 8px;
  margin-top: 15px;
}
.filters button {
  padding: 7px 13px;
  color: #3b4054;
  background: #fff;
  border: 1px solid #dfe2ea;
  border-radius: 99px;
  font-size: 12.5px;
  font-weight: 600;
}
.filters button.active {
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
