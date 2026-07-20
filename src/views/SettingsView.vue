<script setup>
import { ref, watch, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Send,
  MessageCircleMore,
  Globe2,
  Check,
  Copy,
  ShieldCheck,
} from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import SettingsNavigation from '../components/settings/SettingsNavigation.vue'
import AppButton from '../components/common/AppButton.vue'
import AppBadge from '../components/common/AppBadge.vue'
import { channels, currentBusiness } from '../data/mockData'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const activeSection = ref(route.query.section || 'channels')
const businessProfile = reactive({ ...currentBusiness })

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

function showSavedMessage(message = 'Settings saved') {
  store.notify(message)
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
                      ? 'chatbot'
                      : channel.name.toLowerCase(),
                  )
                "
              >
                {{ channel.connected ? 'Manage' : 'Connect' }}
              </AppButton>
            </article>
          </template>
          <template v-else-if="activeSection === 'telegram'">
            <h2>Telegram setup</h2>
            <p class="intro">
              Your Telegram bot is connected and receiving messages.
            </p>
            <div class="status">
              <Check :size="20" />
              <div>
                <b>@ElegantSalonSupportBot</b>
                <small>Connected · last message 2 minutes ago</small>
              </div>
            </div>
            <h3>Connect a different bot</h3>
            <ol>
              <li>Open @BotFather in Telegram.</li>
              <li>Create a bot and copy its token.</li>
              <li>Paste the token below and connect.</li>
            </ol>
            <label class="field">
              Bot token
              <input
                type="password"
                placeholder="Paste your BotFather token"
                autocomplete="off"
              />
            </label>
            <small class="security">
              <ShieldCheck :size="14" />
              Tokens are sent securely when backend integration is enabled. No
              token is stored in this demo.
            </small>
            <AppButton
              @click="showSavedMessage('Telegram connection test queued')"
            >
              Test connection
            </AppButton>
          </template>
          <template v-else-if="activeSection === 'whatsapp'">
            <h2>Connect WhatsApp</h2>
            <p class="intro">
              Scan the QR code with WhatsApp on your business phone.
            </p>
            <div class="qr">
              <div>
                LOOP
                <br />
                QR
              </div>
              <ol>
                <li>Open WhatsApp → Settings → Linked devices</li>
                <li>Tap “Link a device”</li>
                <li>Point your phone at this screen</li>
              </ol>
            </div>
            <AppButton @click="showSavedMessage('QR code refreshed')">
              Refresh QR code
            </AppButton>
          </template>
          <template v-else-if="activeSection === 'chatbot'">
            <h2>Chatbot settings</h2>
            <p class="intro">
              Let Loop answer common questions and qualify leads automatically.
            </p>
            <div class="toggle-row">
              <div>
                <b>Automatic replies</b>
                <small>Reply instantly using your business information.</small>
              </div>
              <button
                role="switch"
                :aria-checked="store.chatbotEnabled"
                class="toggle"
                :class="{ on: store.chatbotEnabled }"
                @click="store.toggleChatbot"
              >
                <i />
              </button>
            </div>
            <label class="field">
              Welcome message
              <textarea rows="3">
Hi! Welcome to Elegant Salon. How can we help today?</textarea>
            </label>
            <label class="field">
              Escalation message
              <textarea rows="3">
I’ll connect you with a member of our team who can help.</textarea>
            </label>
            <AppButton @click="showSavedMessage('Chatbot messages saved')">
              Save changes
            </AppButton>
          </template>
          <template v-else>
            <h2>Business profile</h2>
            <p class="intro">
              These details help the chatbot give accurate answers.
            </p>
            <form @submit.prevent="showSavedMessage('Business profile saved')">
              <label class="field">
                Business name
                <input v-model="businessProfile.name" required />
              </label>
              <label class="field">
                Sector
                <input v-model="businessProfile.sector" />
              </label>
              <label class="field">
                City
                <input v-model="businessProfile.city" />
              </label>
              <label class="field">
                Business email
                <input v-model="businessProfile.email" type="email" />
              </label>
              <label class="field">
                Phone
                <input v-model="businessProfile.phone" />
              </label>
              <label class="field">
                Business ID
                <div class="readonly">
                  <span class="mono">{{ businessProfile.id }}</span>
                  <Copy :size="15" />
                </div>
              </label>
              <label class="field wide">
                Business description
                <textarea rows="4">
Premium salon services in the heart of Colombo, open Monday to Saturday.</textarea>
              </label>
              <AppButton class="wide">Save profile</AppButton>
            </form>
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
.status {
  display: flex;
  gap: 11px;
  align-items: center;
  background: var(--success-bg);
  color: var(--success);
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 24px;
}
.status div {
  display: flex;
  flex-direction: column;
}
.status small {
  font-size: 10.5px;
  margin-top: 3px;
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
.security {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--muted);
  font-size: 10.5px;
  margin: -8px 0 17px;
}
.qr {
  display: flex;
  align-items: center;
  gap: 28px;
  margin: 20px 0;
}
.qr > div {
  width: 160px;
  height: 160px;
  display: grid;
  place-items: center;
  text-align: center;
  font: 800 20px 'JetBrains Mono';
  background: repeating-linear-gradient(45deg, #1c2033 0 5px, #fff 5px 10px);
  color: var(--primary);
  border: 12px solid #fff;
  outline: 1px solid var(--border);
}
.qr ol {
  flex: 1;
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
  .qr {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
