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
  <button class="item" :class="{ active }">
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
        <i class="channel-dot" :class="conversation.channel.toLowerCase()" />
        <AppBadge :tone="conversation.status">
          {{ conversation.status }}
        </AppBadge>
        <i v-if="conversation.unread" class="unread" aria-label="Unread" />
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
  padding: 14px 20px;
  display: flex;
  gap: 11px;
  text-align: left;
}
.item:hover,
.item.active {
  background: #f4f4ff;
}
.item.active {
  box-shadow: none;
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
.meta .unread {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  margin-left: auto;
}
.channel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--web);
}
.channel-dot.telegram {
  background: var(--telegram);
}
.channel-dot.whatsapp {
  background: var(--whatsapp);
}
</style>
