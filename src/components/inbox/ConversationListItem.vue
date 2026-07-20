<script setup>
import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'

defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
})
</script>
<template>
  <button class="item" :class="{ active, escalated: conversation.escalated }">
    <AppAvatar
      :initials="conversation.initials"
      :channel="conversation.channel"
    />
    <span class="copy">
      <span class="top">
        <strong>{{ conversation.name }}</strong>
        <time class="mono">{{ conversation.time }}</time>
      </span>
      <span class="preview">{{ conversation.preview }}</span>
      <span class="meta">
        <AppBadge
          :tone="conversation.escalated ? 'warning' : conversation.status"
        >
          {{
            conversation.escalated
              ? 'Score ' + conversation.score
              : conversation.status
          }}
        </AppBadge>
        <i v-if="conversation.unread" aria-label="Unread" />
      </span>
    </span>
  </button>
</template>
<style scoped>
.item {
  width: 100%;
  border: 0;
  border-bottom: 1px solid #f0f1f5;
  background: transparent;
  padding: 13px 17px;
  display: flex;
  gap: 11px;
  text-align: left;
}
.item:hover,
.item.active {
  background: #fff;
}
.item.active {
  box-shadow: inset 3px 0 var(--primary);
}
.item.escalated {
  border-left: 4px solid var(--danger);
  background: #fffaf8;
}
.copy {
  flex: 1;
  min-width: 0;
}
.top,
.meta {
  display: flex;
  align-items: center;
  gap: 7px;
}
.top strong {
  font-size: 13.5px;
}
.top time {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}
.preview {
  display: block;
  font-size: 12.5px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 3px 0 6px;
}
.meta i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  margin-left: auto;
}
</style>
