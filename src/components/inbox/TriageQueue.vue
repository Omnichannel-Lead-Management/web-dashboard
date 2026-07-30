<script setup>
import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'

defineProps({
  conversations: { type: Array, default: () => [] },
})
defineEmits(['open'])
</script>

<template>
  <section class="triage">
    <h2>⚡ Escalation queue · {{ conversations.length }}</h2>
    <button
      v-for="conversation in conversations"
      :key="conversation.id"
      @click="$emit('open', conversation.id)"
    >
      <AppAvatar
        :initials="conversation.initials"
        :channel="conversation.channel"
        :show-dot="false"
      />
      <span class="copy">
        <span class="top">
          <strong>{{ conversation.name }}</strong>
          <time class="mono">{{ conversation.time }}</time>
        </span>
        <span class="preview">{{ conversation.preview }}</span>
        <span class="meta">
          <i class="channel-dot" :class="conversation.channel.toLowerCase()" />
          <AppBadge v-if="conversation.score != null" tone="warning">
            Score {{ conversation.score }}
          </AppBadge>
        </span>
      </span>
    </button>
  </section>
</template>

<style scoped>
.triage h2 {
  margin: 5px 20px 10px;
  color: var(--danger);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}
.triage button {
  width: calc(100% - 26px);
  margin: 0 13px 8px;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  text-align: left;
  background: #fff;
  border: 1px solid #f6cdbb;
  border-left: 4px solid var(--danger);
  border-radius: 13px;
}
.copy {
  flex: 1;
  min-width: 0;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.top strong {
  font-size: 14px;
}
.top time {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}
.preview {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--text-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 7px;
}
.channel-dot {
  width: 8px;
  height: 8px;
  flex: none;
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
