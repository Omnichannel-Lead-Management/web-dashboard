<script setup>
import { computed, ref } from 'vue'
import { ImagePlus, RotateCcw, Send, X } from 'lucide-vue-next'
import { IMAGE_ATTACHMENT_ACCEPTED_TYPES } from '../../services/imageAttachments'
const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  processing: { type: Boolean, default: false },
  limit: { type: Number, default: 1000 },
  attachmentsEnabled: { type: Boolean, default: false },
  attachment: { type: Object, default: null },
  attachmentDisabled: { type: Boolean, default: false },
})
const emit = defineEmits([
  'update:modelValue',
  'send',
  'select-image',
  'remove-image',
  'retry-image',
])
const input = ref(null)
const valid = computed(
  () =>
    Boolean(props.modelValue.trim() || props.attachment) &&
    !props.disabled &&
    !props.processing,
)
function chooseImage() {
  if (!props.attachmentsEnabled || props.attachmentDisabled) return
  input.value?.click()
}
function selected(event) {
  const files = event.target.files
  if (files?.length === 1) emit('select-image', files[0])
  event.target.value = ''
}
function submit() {
  if (valid.value) emit('send', props.modelValue.trim())
}
</script>
<template>
  <form class="composer" @submit.prevent="submit">
    <div v-if="attachment" class="attachment-preview">
      <img :src="attachment.previewUrl" alt="Selected image preview" />
      <span>
        <b>{{ attachment.fileName }}</b>
        <small>
          {{ Math.ceil(attachment.size / 1024) }} KB · {{ attachment.status }}
        </small>
      </span>
      <button
        v-if="attachment.status === 'failed'"
        type="button"
        aria-label="Retry image"
        @click="$emit('retry-image')"
      >
        <RotateCcw :size="16" />
      </button>
      <button
        type="button"
        aria-label="Remove selected image"
        :disabled="processing"
        @click="$emit('remove-image')"
      >
        <X :size="16" />
      </button>
    </div>
    <p v-if="attachment?.error" class="attachment-error" role="alert">
      {{ attachment.error }}
    </p>
    <p v-else-if="!attachmentsEnabled" class="attachment-note" role="note">
      Sending photos is turned off for this chat.
    </p>
    <label for="web-chat-message">Message</label>
    <div>
      <input
        ref="input"
        class="file-input"
        type="file"
        :accept="IMAGE_ATTACHMENT_ACCEPTED_TYPES.join(',')"
        aria-label="Choose an image attachment"
        @change="selected"
      />
      <button
        type="button"
        class="attach"
        aria-label="Attach image"
        :disabled="!attachmentsEnabled || attachmentDisabled"
        @click="chooseImage"
      >
        <ImagePlus :size="18" />
      </button>
      <textarea
        id="web-chat-message"
        :value="modelValue"
        rows="2"
        :maxlength="limit"
        :disabled="disabled || processing"
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
.file-input {
  display: none;
}
.attachment-preview {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.attachment-preview img {
  width: 54px;
  height: 54px;
  object-fit: cover;
  border-radius: 8px;
}
.attachment-preview span {
  min-width: 0;
  flex: 1;
  display: grid;
  text-align: left;
  font-size: 11px;
}
.attachment-preview b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachment-preview small,
.attachment-note {
  color: var(--muted);
  font-size: 10px;
}
.attachment-error {
  color: var(--danger);
  font-size: 11px;
}
.attachment-note {
  margin: 0 0 7px;
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
.composer > div > button,
.attachment-preview button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
}
.composer > div > .attach {
  background: #fff;
  color: var(--primary);
  border: 1px solid var(--border);
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
