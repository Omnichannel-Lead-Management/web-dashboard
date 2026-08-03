<script setup>
import { nextTick, ref, watch } from 'vue'
import WebChatMessageBubble from './WebChatMessageBubble.vue'
const props = defineProps({
  messages: { type: Array, default: () => [] },
  quickRepliesDisabled: { type: Boolean, default: false },
})
defineEmits(['retry', 'quick-reply'])
const list = ref(null)
watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    list.value?.scrollTo({ top: list.value.scrollHeight, behavior: 'smooth' })
  },
)
</script>
<template>
  <div
    ref="list"
    class="messages"
    role="log"
    aria-live="polite"
    aria-relevant="additions text"
  >
    <div v-if="!messages.length" class="empty">
      <b>How can we help?</b>
      <span>Send a message to start this conversation.</span>
    </div>
    <WebChatMessageBubble
      v-for="message in messages"
      :key="message.id"
      :message="message"
      :quick-replies-disabled="quickRepliesDisabled"
      @retry="$emit('retry', $event)"
      @quick-reply="$emit('quick-reply', $event)"
    />
  </div>
</template>
<style scoped>
.messages {
  flex: 1;
  min-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 20px;
  background: #fff;
}
.empty {
  margin: auto;
  display: grid;
  gap: 5px;
  text-align: center;
  color: var(--muted);
}
.empty b {
  color: var(--text);
  font-size: 17px;
}
.empty span {
  font-size: 12px;
}
@media (prefers-reduced-motion: reduce) {
  .messages {
    scroll-behavior: auto;
  }
}
</style>
