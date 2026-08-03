<script setup>
import WebChatHeader from './WebChatHeader.vue'
defineProps({ prototype: { type: Boolean, default: false } })
defineEmits(['new-conversation'])
</script>
<template>
  <section class="shell">
    <WebChatHeader
      :prototype="prototype"
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
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 20px 60px rgba(33, 37, 54, 0.12);
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
