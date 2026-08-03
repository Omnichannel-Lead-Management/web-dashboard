<script setup>
import { computed } from 'vue'
import { Send } from 'lucide-vue-next'
const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  processing: { type: Boolean, default: false },
  limit: { type: Number, default: 1000 },
})
const emit = defineEmits(['update:modelValue', 'send'])
const valid = computed(
  () =>
    Boolean(props.modelValue.trim()) && !props.disabled && !props.processing,
)
function submit() {
  if (valid.value) emit('send', props.modelValue.trim())
}
</script>
<template>
  <form class="composer" @submit.prevent="submit">
    <label for="web-chat-message">Message</label>
    <div>
      <textarea
        id="web-chat-message"
        :value="modelValue"
        rows="2"
        :maxlength="limit"
        :disabled="disabled"
        placeholder="Type your message…"
        @input="$emit('update:modelValue', $event.target.value)"
        @keydown.enter.exact.prevent="submit"
      />
      <button type="submit" :disabled="!valid" aria-label="Send message">
        <Send :size="18" />
      </button>
    </div>
    <small>
      {{ modelValue.length }}/{{ limit }} · Shift+Enter for a new line
    </small>
  </form>
</template>
<style scoped>
.composer {
  padding: 13px 16px 15px;
  border-top: 1px solid var(--border);
  background: #fff;
}
.composer > label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
}
.composer > div {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 9px 8px 12px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: #f8f9fb;
}
.composer textarea {
  flex: 1;
  resize: none;
  border: 0;
  background: transparent;
  outline: 0;
  padding: 3px;
  min-height: 40px;
  max-height: 100px;
}
.composer textarea:focus-visible {
  outline: 3px solid rgba(79, 70, 229, 0.18);
  outline-offset: 2px;
  border-radius: 6px;
}
.composer button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
}
.composer button:disabled {
  background: #d5d8e2;
}
.composer > small {
  display: block;
  text-align: right;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
}
</style>
