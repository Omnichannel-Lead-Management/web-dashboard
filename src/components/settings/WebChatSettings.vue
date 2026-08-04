<script setup>
import { ExternalLink, Globe2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { webChatEnabled } from '../../config'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

const router = useRouter()
</script>

<template>
  <section class="web-chat-settings">
    <header class="section-head">
      <span class="section-icon"><Globe2 :size="22" /></span>
      <div>
        <h2>Web chat</h2>
        <p>The chat window customers use on your website.</p>
      </div>
      <AppBadge :tone="webChatEnabled ? 'success' : 'neutral'">
        {{ webChatEnabled ? 'Active' : 'Off' }}
      </AppBadge>
    </header>

    <p class="lead">
      Customers can start a conversation without installing anything. Those
      chats arrive in your Inbox alongside Telegram and WhatsApp, and can be
      handed to a person on your team at any point.
    </p>

    <p v-if="!webChatEnabled" class="notice">
      Web chat is switched off for this workspace. Contact your administrator to
      turn it on.
    </p>

    <AppButton variant="outline" class="cta" @click="router.push('/web-chat')">
      <ExternalLink :size="16" />
      See what customers see
    </AppButton>
  </section>
</template>

<style scoped>
.web-chat-settings {
  display: grid;
  gap: 20px;
}
.lead {
  margin: 0;
  color: var(--text-2);
  font-size: var(--fs-base);
  line-height: 1.65;
  max-width: 60ch;
}
.cta {
  justify-self: start;
}
</style>
