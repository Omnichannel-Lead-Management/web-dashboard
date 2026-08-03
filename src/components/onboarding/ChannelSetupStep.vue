<script setup>
import { computed, ref } from 'vue'
import AppBadge from '../common/AppBadge.vue'
import TelegramConnect from '../settings/TelegramConnect.vue'
import WhatsAppConnect from '../settings/WhatsAppConnect.vue'
import { useAppStore } from '../../stores/app'

const store = useAppStore()
const emit = defineEmits(['connection-change'])
const active = ref('telegram')
const telegramConnected = ref(false)
const whatsappConnected = ref(false)
const business = computed(() =>
  store.business?.id === store.businessId ? store.business : null,
)

function updateConnection(provider, connected) {
  if (provider === 'telegram') telegramConnected.value = connected
  if (provider === 'whatsapp') whatsappConnected.value = connected
  emit('connection-change', telegramConnected.value || whatsappConnected.value)
}
</script>

<template>
  <section>
    <div class="tabs" role="tablist" aria-label="Channel provider">
      <button
        type="button"
        role="tab"
        :aria-selected="active === 'telegram'"
        @click="active = 'telegram'"
      >
        Telegram
        <AppBadge v-if="business?.telegram_connected" tone="success">
          Configured
        </AppBadge>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="active === 'whatsapp'"
        @click="active = 'whatsapp'"
      >
        WhatsApp
        <AppBadge v-if="business?.whatsapp_connected" tone="success">
          Configured
        </AppBadge>
      </button>
    </div>
    <div v-show="active === 'telegram'" role="tabpanel">
      <TelegramConnect
        @connection-change="updateConnection('telegram', $event)"
      />
    </div>
    <div v-show="active === 'whatsapp'" role="tabpanel">
      <WhatsAppConnect
        @connection-change="updateConnection('whatsapp', $event)"
      />
    </div>
    <p class="limitation">
      Telegram live status and disconnect are not available through the gateway.
    </p>
  </section>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 22px;
}
.tabs button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #fff;
  font-weight: 700;
}
.tabs button[aria-selected='true'] {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-soft);
}
.limitation {
  margin-top: 20px;
  color: var(--muted);
  font-size: 12px;
}
</style>
