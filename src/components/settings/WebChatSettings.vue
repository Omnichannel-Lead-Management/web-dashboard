<script setup>
import { ExternalLink, Globe2, ShieldAlert } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { webChatEnabled } from '../../config'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

const router = useRouter()
</script>

<template>
  <section class="web-chat-settings">
    <div class="heading">
      <span><Globe2 :size="20" /></span>
      <div>
        <h2>Web Chat</h2>
        <p>Preview the public customer chat experience.</p>
      </div>
      <AppBadge :tone="webChatEnabled ? 'warning' : 'neutral'">
        {{ webChatEnabled ? 'Prototype mode' : 'Disabled' }}
      </AppBadge>
    </div>

    <div class="details">
      <div>
        <span>Capability</span>
        <b>{{ webChatEnabled ? 'Enabled' : 'Disabled' }}</b>
      </div>
      <div>
        <span>Gateway route</span>
        <code>WS /ws/chat</code>
      </div>
    </div>

    <div class="warning" role="note">
      <ShieldAlert :size="18" />
      <p>
        <b>Prototype integration only.</b>
        The gateway currently uses its default business. Secure tenant binding
        or a widget token is required before production use.
      </p>
    </div>

    <p v-if="!webChatEnabled" class="disabled-copy">
      Web chat is ready in the dashboard, but live use requires secure tenant
      binding in the gateway.
    </p>

    <AppButton variant="outline" @click="router.push('/web-chat')">
      <ExternalLink :size="16" />
      Open preview
    </AppButton>
  </section>
</template>

<style scoped>
.web-chat-settings {
  display: grid;
  gap: 20px;
}
.heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.heading > span {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: var(--primary);
  background: var(--primary-soft);
}
.heading > div {
  flex: 1;
}
.heading h2,
.heading p,
.warning p {
  margin: 0;
}
.heading p,
.disabled-copy {
  color: var(--muted);
  font-size: 12px;
}
.details {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.details div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.details span {
  color: var(--muted);
}
.warning {
  display: flex;
  gap: 10px;
  padding: 13px;
  color: #795b00;
  background: #fff8e3;
  border: 1px solid #f1e5bd;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1.5;
}
.warning svg {
  flex: none;
}
</style>
