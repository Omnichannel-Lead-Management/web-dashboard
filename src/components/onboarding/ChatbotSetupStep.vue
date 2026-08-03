<script setup>
import { watch } from 'vue'
import ChatbotSettings from '../settings/ChatbotSettings.vue'
import { useAppStore } from '../../stores/app'

const emit = defineEmits(['blocked'])
const store = useAppStore()
watch(
  () => store.chatbotConfigError,
  (error) => {
    if (error) emit('blocked', error)
  },
)
</script>

<template>
  <section>
    <ChatbotSettings
      compact
      :show-templates="false"
      show-drafts-when-unavailable
      :business-name="store.businessName"
    />
  </section>
</template>
