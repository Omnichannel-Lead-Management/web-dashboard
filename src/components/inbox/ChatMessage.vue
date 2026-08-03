<script setup>
import { Sparkles, Mic, Image as ImageIcon } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
})
const failedImageUrl = ref('')
const imageFailed = computed(
  () =>
    Boolean(props.message.imageUrl) &&
    failedImageUrl.value === props.message.imageUrl,
)

watch(
  () => props.message.imageUrl,
  () => {
    failedImageUrl.value = ''
  },
)

function handleImageError(event) {
  const failedUrl = event?.currentTarget?.dataset?.imageUrl || ''
  if (!failedUrl || failedUrl !== props.message.imageUrl) return
  failedImageUrl.value = failedUrl
}
</script>
<template>
  <article class="message" :class="message.sender">
    <span v-if="message.sender === 'bot'" class="bot-label">
      <i><Sparkles :size="11" /></i>
      Loop Assistant
    </span>
    <span v-if="message.kind" class="media-label">
      <Mic v-if="message.kind === 'voice'" :size="11" />
      <ImageIcon v-else :size="11" />
      {{ message.kind === 'voice' ? 'Voice note' : 'Photo' }}
    </span>
    <img
      v-if="message.kind === 'photo' && message.imageUrl && !imageFailed"
      :key="message.imageUrl"
      class="message-image"
      :src="message.imageUrl"
      :data-image-url="message.imageUrl"
      :alt="message.text || 'Customer image'"
      loading="lazy"
      @error="handleImageError"
    />
    <span
      v-else-if="message.kind === 'photo' && message.imageUrl"
      class="image-unavailable"
      role="status"
    >
      Image unavailable
    </span>
    <p>{{ message.text }}</p>
    <time v-if="message.time" class="mono">{{ message.time }}</time>
  </article>
</template>
<style scoped>
/* Marks text that came from a transcript or an image description rather than
   typing, so an agent knows to allow for the assistant having misheard. */
.media-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--muted);
}
.message {
  width: fit-content;
  max-width: 66%;
  align-self: flex-start;
}
.message p {
  margin: 0;
  background: #f1f2f6;
  border-radius: 4px 18px 18px;
  padding: 11px 15px;
  font-size: 14px;
  line-height: 1.55;
}
.message-image {
  display: block;
  width: min(360px, 100%);
  max-height: 320px;
  object-fit: contain;
  border-radius: 14px;
  margin-bottom: 6px;
  background: #f1f2f6;
}
.image-unavailable {
  display: block;
  padding: 20px;
  margin-bottom: 6px;
  border-radius: 12px;
  color: var(--muted);
  background: #f1f2f6;
}
.message time {
  font-size: 9.5px;
  color: var(--muted);
  display: block;
  margin-top: 4px;
}
.message.agent {
  align-self: flex-end;
}
.message.agent p {
  background: var(--primary);
  color: #fff;
  border-radius: 16px 4px 16px 16px;
}
.message.agent time {
  text-align: right;
}
.message.bot p {
  background: #f2f0ff;
  border: 1px solid #e7e3ff;
}
.bot-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--primary);
  font-size: 10.5px;
  font-weight: 700;
  margin-bottom: 4px;
}
.bot-label i {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  background: #ece9ff;
  border-radius: 6px;
}
@media (max-width: 600px) {
  .message {
    max-width: 88%;
  }
}
</style>
