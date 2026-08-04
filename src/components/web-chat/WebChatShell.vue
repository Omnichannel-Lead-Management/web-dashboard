<script setup>
import WebChatHeader from './WebChatHeader.vue'

defineProps({
  live: { type: Boolean, default: false },
  businessName: { type: String, default: '' },
})
defineEmits(['new-conversation'])
</script>
<template>
  <section class="shell">
    <WebChatHeader
      :live="live"
      :business-name="businessName"
      @new-conversation="$emit('new-conversation')"
    />
    <slot />
  </section>
</template>
<style scoped>
.shell {
  width: min(100%, 720px);
  height: min(780px, calc(100dvh - 48px));
  min-height: 560px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
@media (max-width: 600px) {
  .shell {
    height: 100dvh;
    min-height: 0;
    border: 0;
    border-radius: 0;
  }
}
</style>
