<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Send, MessageCircleMore, Globe2 } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import SettingsNavigation from '../components/settings/SettingsNavigation.vue'
import FaqManager from '../components/settings/FaqManager.vue'
import ChatbotSettings from '../components/settings/ChatbotSettings.vue'
import WhatsAppConnect from '../components/settings/WhatsAppConnect.vue'
import TelegramConnect from '../components/settings/TelegramConnect.vue'
import BusinessProfileSettings from '../components/settings/BusinessProfileSettings.vue'
import WebChatSettings from '../components/settings/WebChatSettings.vue'
import NotificationSettings from '../components/settings/NotificationSettings.vue'
import AppButton from '../components/common/AppButton.vue'
import { useAppStore } from '../stores/app'
import { activeBusinessForTenant } from '../services/businessProfile'
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
    store.notify(error.message || 'Failed to load business', 'error')
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
    detail: activeBusiness.value?.whatsapp_instance_name
      ? `Instance ${activeBusiness.value.whatsapp_instance_name}`
      : 'Scan a QR to link a number',
  },
  {
    name: 'Web chat',
    connected: webChatEnabled,
    detail: webChatEnabled ? 'Prototype enabled' : 'Preview unavailable',
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
            <h2>Connected channels</h2>
            <p class="intro">
              Connect the places where your customers already message you.
            </p>
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
                  {{ channel.connected ? '✓ Connected · ' : ''
                  }}{{ channel.detail }}
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
          <template v-else-if="activeSection === 'notifications'">
            <NotificationSettings />
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
  padding: 25px;
  max-width: 760px;
  width: 100%;
  min-height: 520px;
}
.content h2 {
  font-size: 21px;
  margin-bottom: 6px;
}
.intro {
  color: var(--muted);
  font-size: 13.5px;
  margin-bottom: 22px;
}
.channel {
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
}
.channel > span {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: #e3f2fb;
  color: var(--telegram);
}
.channel > span.whatsapp {
  background: #e2f4ec;
  color: #12724d;
}
.channel > span.web {
  background: #eef0f5;
  color: var(--web);
}
.channel > span svg {
  width: 20px;
}
.channel > div {
  display: flex;
  flex: 1;
  flex-direction: column;
}
.channel b {
  font-size: 13.5px;
}
.channel small {
  font-size: 11px;
  color: var(--muted);
  margin-top: 3px;
}
.channel small.connected {
  color: var(--success);
  font-weight: 600;
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
