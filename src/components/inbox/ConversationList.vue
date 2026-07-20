<script setup>
import { computed } from 'vue'
import { Search } from 'lucide-vue-next'
import ConversationListItem from './ConversationListItem.vue'
const props = defineProps({
  conversations: {
    type: Array,
    default: () => [],
  },
  selectedId: {
    type: String,
    default: '',
  },
  search: {
    type: String,
    default: '',
  },
  filter: {
    type: String,
    default: 'All',
  },
})
const emit = defineEmits(['select', 'update:search', 'update:filter'])
const filters = ['All', 'Unread', 'Telegram', 'WhatsApp', 'Web']
const filteredConversations = computed(() =>
  props.conversations.filter((conversation) => {
    const normalizedSearch = props.search.toLowerCase()
    const searchableText =
      `${conversation.name} ${conversation.preview}`.toLowerCase()
    const matchesSearch =
      !normalizedSearch || searchableText.includes(normalizedSearch)
    const matchesFilter =
      props.filter === 'All' ||
      (props.filter === 'Unread'
        ? conversation.unread
        : conversation.channel === props.filter)

    return matchesSearch && matchesFilter
  }),
)
</script>
<template>
  <aside class="list">
    <div class="tools">
      <label>
        <Search :size="16" />
        <input
          aria-label="Search conversations"
          placeholder="Search conversations"
          :value="search"
          @input="emit('update:search', $event.target.value)"
        />
      </label>
      <div class="filters">
        <button
          v-for="f in filters"
          :key="f"
          :class="{ active: filter === f }"
          @click="emit('update:filter', f)"
        >
          {{ f }}
        </button>
      </div>
    </div>
    <div class="scroll">
      <ConversationListItem
        v-for="c in filteredConversations"
        :key="c.id"
        :conversation="c"
        :active="selectedId === c.id"
        @click="emit('select', c.id)"
      />
      <div v-if="!filteredConversations.length" class="empty">
        No conversations match.
      </div>
    </div>
  </aside>
</template>
<style scoped>
.list {
  width: 350px;
  flex: none;
  border-right: 1px solid #eef0f5;
  background: #fbfbfd;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tools {
  padding: 14px 15px 11px;
}
.tools label {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 11px;
  color: var(--muted);
}
.tools input {
  border: 0;
  padding: 9px 0;
  font-size: 13px;
  outline: 0;
}
.filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  margin-top: 10px;
}
.filters button {
  border: 1px solid var(--border);
  background: #fff;
  padding: 5px 10px;
  border-radius: 16px;
  font-size: 11.5px;
  font-weight: 600;
}
.filters button.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.scroll {
  overflow-y: auto;
  flex: 1;
}
@media (max-width: 1050px) {
  .list {
    width: 310px;
  }
}
@media (max-width: 760px) {
  .list {
    width: 100%;
    border: 0;
  }
  .list.hidden-mobile {
    display: none;
  }
}
</style>
