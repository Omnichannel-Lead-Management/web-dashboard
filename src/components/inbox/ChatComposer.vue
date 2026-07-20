<script setup>
import { ref } from 'vue'
import { Paperclip, Send, Smile } from 'lucide-vue-next'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['send'])

const messageText = ref('')

function submitMessage() {
  if (props.disabled) {
    return
  }

  const trimmedMessage = messageText.value.trim()

  if (!trimmedMessage) {
    return
  }

  emit('send', trimmedMessage)
  messageText.value = ''
}
</script>

<template>
  <form class="chat-composer" @submit.prevent="submitMessage">
    <button
      class="icon-button"
      type="button"
      aria-label="Attach file"
      :disabled="disabled"
    >
      <Paperclip :size="19" />
    </button>

    <textarea
      v-model="messageText"
      class="message-input"
      rows="1"
      :disabled="disabled"
      :placeholder="
        disabled
          ? `Claim this chat to reply to ${name}…`
          : `Type a reply to ${name}…`
      "
      aria-label="Reply message"
      @keydown.enter.exact.prevent="submitMessage"
    />

    <button
      class="icon-button"
      type="button"
      aria-label="Add emoji"
      :disabled="disabled"
    >
      <Smile :size="19" />
    </button>

    <button
      class="send-button"
      type="submit"
      aria-label="Send message"
      :disabled="disabled || !messageText.trim()"
    >
      <Send :size="18" />
    </button>
  </form>
</template>

<style scoped>
.chat-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 17px;
  background: #ffffff;
  border-top: 1px solid #eef0f5;
}

.message-input {
  min-height: 42px;
  max-height: 100px;
  padding: 10px 12px;
  resize: none;
  background: #f8f9fb;
}

.icon-button {
  display: grid;
  place-items: center;
  padding: 8px;
  color: var(--muted);
  background: none;
  border: 0;
}

.send-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: #ffffff;
  background: var(--primary);
  border: 0;
  border-radius: 10px;
}

.send-button:disabled {
  background: #d5d8e2;
}
</style>
