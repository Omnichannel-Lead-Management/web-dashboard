<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Send, MessageCircleMore, Globe2, Radio } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import SettingsNavigation from '../components/settings/SettingsNavigation.vue'
import FaqManager from '../components/settings/FaqManager.vue'
import ChatbotSettings from '../components/settings/ChatbotSettings.vue'
import WhatsAppConnect from '../components/settings/WhatsAppConnect.vue'
import TelegramConnect from '../components/settings/TelegramConnect.vue'
import BusinessProfileSettings from '../components/settings/BusinessProfileSettings.vue'
import WebChatSettings from '../components/settings/WebChatSettings.vue'
import EscalationQueueSettings from '../components/settings/EscalationQueueSettings.vue'
import AnalyticsSettings from '../components/settings/AnalyticsSettings.vue'
import AppButton from '../components/common/AppButton.vue'
import { useAppStore } from '../stores/app'
import { activeBusinessForTenant } from '../services/businessProfile'
import { friendlyErrorMessage } from '../services/displayText'
import { webChatEnabled } from '../config'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const activeSection = ref(route.query.section || 'channels')

const activeBusiness = computed(() =>
  activeBusinessForTenant(store.business, store.businessId),
)
async function loadBusiness() {
  if (!store.businessId) return
  try {
    await store.refreshBusiness()
  } catch (error) {
    store.notify(
      friendlyErrorMessage(error, 'We could not load your business details.'),
      'error',
    )
  }
}

onMounted(loadBusiness)

const channels = computed(() => [
  {
    name: 'Telegram',
    connected: Boolean(activeBusiness.value?.telegram_connected),
    detail: activeBusiness.value?.telegram_bot_username
      ? `@${activeBusiness.value.telegram_bot_username}`
      : 'Paste a bot token to connect',
  },
  {
    name: 'WhatsApp',
    connected: Boolean(activeBusiness.value?.whatsapp_connected),
    detail: activeBusiness.value?.whatsapp_connected
      ? 'Receiving customer messages'
      : 'Scan a QR to link a number',
  },
  {
    name: 'Web chat',
    connected: webChatEnabled,
    detail: webChatEnabled
      ? 'Live on your website'
      : 'Turned off for this workspace',
  },
])
watch(
  () => route.query.section,
  (section) => {
    if (section) {
      activeSection.value = section
    }
  },
)

function selectSection(sectionId) {
  activeSection.value = sectionId
  router.replace({ query: { section: sectionId } })
}
</script>
<template>
  <AppShell>
    <div class="page">
      <div class="page-title">
        <div>
          <h1>Settings</h1>
          <p>Manage channels, automation and your business.</p>
        </div>
      </div>
      <div class="settings">
        <SettingsNavigation :active="activeSection" @select="selectSection" />
        <section class="card content">
          <template v-if="activeSection === 'channels'">
            <header class="section-head">
              <span class="section-icon"><Radio :size="22" /></span>
              <div>
                <h2>Connected channels</h2>
                <p>
                  Connect the places where your customers already message you.
                </p>
              </div>
            </header>
            <article
              v-for="channel in channels"
              :key="channel.name"
              class="channel"
            >
              <span :class="channel.name.split(' ')[0].toLowerCase()">
                <Send v-if="channel.name === 'Telegram'" />
                <MessageCircleMore v-else-if="channel.name === 'WhatsApp'" />
                <Globe2 v-else />
              </span>
              <div>
                <b>{{ channel.name }}</b>
                <small :class="{ connected: channel.connected }">
                  <Check v-if="channel.connected" :size="13" />
                  {{ channel.detail }}
                </small>
              </div>
              <AppButton
                size="sm"
                variant="outline"
                @click="
                  selectSection(
                    channel.name === 'Web chat'
                      ? 'webchat'
                      : channel.name.toLowerCase(),
                  )
                "
              >
                {{
                  channel.name === 'Web chat'
                    ? 'Preview'
                    : channel.connected
                      ? 'Manage'
                      : 'Connect'
                }}
              </AppButton>
            </article>
          </template>
          <template v-else-if="activeSection === 'telegram'">
            <TelegramConnect />
          </template>
          <template v-else-if="activeSection === 'whatsapp'">
            <WhatsAppConnect />
          </template>
          <template v-else-if="activeSection === 'webchat'">
            <WebChatSettings />
          </template>
          <template v-else-if="activeSection === 'escalations'">
            <EscalationQueueSettings />
          </template>
          <template v-else-if="activeSection === 'analytics'">
            <AnalyticsSettings />
          </template>
          <template v-else-if="activeSection === 'chatbot'">
            <ChatbotSettings :business-name="store.businessName" />
          </template>
          <template v-else-if="activeSection === 'faqs'">
            <FaqManager :sector="activeBusiness?.sector || ''" />
          </template>
          <template v-else>
            <BusinessProfileSettings />
          </template>
        </section>
      </div>
    </div>
  </AppShell>
</template>
<style scoped>
.settings {
  display: flex;
  align-items: flex-start;
  gap: 19px;
}
.content {
  padding: 26px;
  max-width: 760px;
  width: 100%;
  min-height: 520px;
}
.content h2 {
  font-size: var(--fs-xl);
  margin-bottom: 6px;
}
.intro {
  color: var(--muted);
  font-size: var(--fs-base);
  margin-bottom: 22px;
}
.channel {
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 15px;
  margin-bottom: 10px;
  transition:
    border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.channel:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-xs);
}
.channel > span {
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--telegram-bg);
  color: var(--telegram);
}
.channel > span.whatsapp {
  background: var(--whatsapp-bg);
  color: #12724d;
}
.channel > span.web {
  background: var(--web-bg);
  color: var(--web);
}
.channel > span svg {
  width: 20px;
}
.channel > div {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.channel b {
  font-size: var(--fs-base);
}
.channel small {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-xs);
  color: var(--muted);
  margin-top: 3px;
}
.channel small.connected {
  color: var(--success);
  font-weight: 700;
}
.content h3 {
  font-size: 13.5px;
}
.content ol {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.9;
}
.content > .field {
  margin: 17px 0;
  max-width: 520px;
}
.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.toggle-row > div {
  display: flex;
  flex-direction: column;
}
.toggle-row b {
  font-size: 13.5px;
}
.toggle-row small {
  font-size: 11px;
  color: var(--muted);
  margin-top: 3px;
}
.toggle {
  width: 43px;
  height: 24px;
  border: 0;
  border-radius: 20px;
  background: #d5d8e2;
  padding: 3px;
  display: flex;
}
.toggle.on {
  background: var(--primary);
  justify-content: flex-end;
}
.toggle i {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
}
.content form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.wide {
  grid-column: 1/-1;
}
.readonly {
  border: 1px solid var(--border);
  background: #f7f8fb;
  border-radius: 10px;
  padding: 11px 13px;
  display: flex;
  justify-content: space-between;
}
.readonly span {
  font-size: 12px;
}
@media (max-width: 760px) {
  .settings {
    flex-direction: column;
  }
  .content {
    padding: 19px;
    min-height: 0;
  }
  .content form {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
