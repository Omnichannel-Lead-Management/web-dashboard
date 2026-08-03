<script setup>
const props = defineProps({
  message: { type: Object, required: true },
  quickRepliesDisabled: { type: Boolean, default: false },
})
const emit = defineEmits(['retry', 'quick-reply'])

function sendQuickReply(reply) {
  if (props.quickRepliesDisabled) return
  emit('quick-reply', reply)
}
</script>
<template>
  <article class="message" :class="[message.role, message.type]">
    <small v-if="message.role === 'bot'" class="author">Loop Assistant</small>
    <p v-if="message.text">{{ message.text }}</p>
    <div v-if="message.quickReplies?.length" class="replies">
      <button
        v-for="reply in message.quickReplies"
        :key="`${reply.label}-${reply.value}`"
        type="button"
        :disabled="quickRepliesDisabled"
        @click="sendQuickReply(reply)"
      >
        {{ reply.label }}
      </button>
    </div>
    <small v-if="message.role === 'customer'" class="status">
      {{
        message.status === 'sending'
          ? 'Sending…'
          : message.status === 'failed'
            ? 'Not sent'
            : 'Sent'
      }}
    </small>
    <button
      v-if="message.status === 'failed'"
      class="retry"
      type="button"
      @click="$emit('retry', message)"
    >
      Retry
    </button>
  </article>
</template>
<style scoped>
.message {
  max-width: 78%;
  align-self: flex-start;
}
.message p {
  margin: 0;
  padding: 10px 13px;
  border-radius: 5px 15px 15px;
  background: #f1f2f6;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.customer {
  align-self: flex-end;
  text-align: right;
}
.customer p {
  background: var(--primary);
  color: #fff;
  border-radius: 15px 5px 15px 15px;
  text-align: left;
}
.error p {
  background: var(--danger-bg);
  color: var(--danger);
}
.author,
.status {
  display: block;
  margin: 0 4px 4px;
  color: var(--muted);
  font-size: 10px;
}
.status {
  margin: 4px 4px 0;
}
.replies {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 8px;
}
.replies button,
.retry {
  border: 1px solid var(--primary);
  border-radius: 999px;
  background: #fff;
  color: var(--primary);
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 650;
}
.replies button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.retry {
  margin-top: 5px;
}
</style>
