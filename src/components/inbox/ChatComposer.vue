<script setup>
import { ref } from 'vue'
import { ImagePlus, Send } from 'lucide-vue-next'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  name: { type: String, default: '' },
})
const emit = defineEmits(['send'])
const messageText = ref('')

function submitMessage() {
  if (props.disabled) return
  const message = messageText.value.trim()
  if (!message) return
  emit('send', message)
  messageText.value = ''
}
</script>

<template>
  <form class="composer-shell" @submit.prevent="submitMessage">
    <div class="composer">
      <button
        type="button"
        class="attach"
        disabled
        aria-label="Attach image (requires agent media-send API)"
        title="Image sending requires the agent media-send API"
      >
        <ImagePlus :size="17" />
      </button>
      <textarea
        v-model="messageText"
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
        type="submit"
        aria-label="Send message"
        :disabled="disabled || !messageText.trim()"
      >
        <Send :size="17" />
      </button>
    </div>
    <p class="media-note">
      Image replies require gateway agent media-send support.
    </p>
  </form>
</template>

<style scoped>
.composer-shell {
  flex: none;
  padding: 18px 27px 15px;
  background: #fff;
  border-top: 1px solid #eef0f5;
}
.composer {
  min-height: 74px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f7f8fb;
  border: 1px solid #e1e4ec;
  border-radius: 14px;
}
.media-note {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 10px;
}
textarea {
  flex: 1;
  min-height: 24px;
  max-height: 86px;
  padding: 2px 0;
  resize: none;
  background: transparent;
  border: 0;
  outline: 0;
  font-size: 14px;
}
textarea:disabled {
  color: #98a2b3;
}
button {
  width: 48px;
  height: 48px;
  display: grid;
  flex: none;
  place-items: center;
  color: #fff;
  background: var(--primary);
  border: 0;
  border-radius: 11px;
}
button:disabled {
  background: #d5d8e2;
}
.attach {
  color: var(--muted);
  background: #fff;
  border: 1px solid var(--border);
}
@media (max-width: 760px) {
  .composer-shell {
    padding: 10px;
  }
  .composer {
    min-height: 58px;
  }
  button {
    width: 40px;
    height: 40px;
  }
}
</style>
