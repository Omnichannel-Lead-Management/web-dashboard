<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import { useAppStore } from '../../stores/app'
import { gatewayApi } from '../../services/gatewayApi'
import { mapTelegramConnection } from '../../services/mappers'
import {
  isTelegramRequestCurrent,
  normalizeTelegramToken,
  refreshTelegramBusinessBestEffort,
  telegramSecretReset,
  telegramSafeErrorMessage,
} from '../../services/telegramConnection'

const emit = defineEmits(['connection-change'])
const store = useAppStore()
const state = ref('idle')
const token = ref('')
const showToken = ref(false)
const errorMessage = ref('')
const botUsername = ref('')

let mounted = true
let generation = 0

const currentBusiness = computed(() =>
  store.business?.id === store.businessId ? store.business : null,
)
const normalizedDraft = computed(() => normalizeTelegramToken(token.value))
const connectDisabled = computed(
  () => state.value === 'connecting' || Boolean(normalizedDraft.value.error),
)

function current(requestGeneration, requestBusinessId) {
  return isTelegramRequestCurrent(
    requestGeneration,
    generation,
    requestBusinessId,
    store.businessId,
    mounted && store.authenticated,
  )
}

function initializeSession() {
  generation += 1
  errorMessage.value = ''
  botUsername.value = currentBusiness.value?.telegram_bot_username || ''
  state.value =
    store.authenticated &&
    store.businessId &&
    currentBusiness.value?.telegram_connected
      ? 'connected'
      : 'idle'
  emit('connection-change', state.value === 'connected')
}

function clearSecret() {
  const reset = telegramSecretReset()
  token.value = reset.token
  showToken.value = reset.showToken
}

async function connect() {
  const requestBusinessId = store.businessId
  if (!store.authenticated || !requestBusinessId) {
    state.value = 'error'
    errorMessage.value = 'No active business session'
    return
  }

  const normalized = normalizeTelegramToken(token.value)
  if (normalized.error) {
    state.value = 'error'
    errorMessage.value = normalized.error
    return
  }

  generation += 1
  const requestGeneration = generation
  state.value = 'connecting'
  errorMessage.value = ''
  try {
    const response = await gatewayApi.connectTelegram(
      requestBusinessId,
      normalized.token,
    )
    if (!current(requestGeneration, requestBusinessId)) return
    const mapped = mapTelegramConnection(response)
    if (!current(requestGeneration, requestBusinessId)) return
    botUsername.value = mapped.botUsername
    state.value = 'connected'
    emit('connection-change', true)
    clearSecret()
    await refreshTelegramBusinessBestEffort(() => store.refreshBusiness())
  } catch (error) {
    if (!current(requestGeneration, requestBusinessId)) return
    state.value = 'error'
    errorMessage.value = telegramSafeErrorMessage(error, normalized.token)
  }
}

function retry() {
  state.value = 'idle'
  errorMessage.value = ''
}

watch(
  () => [store.authenticated, store.businessId],
  () => {
    clearSecret()
    initializeSession()
  },
  { immediate: true },
)

watch(
  () => [
    currentBusiness.value?.telegram_connected,
    currentBusiness.value?.telegram_bot_username,
  ],
  () => {
    if (state.value !== 'connecting') initializeSession()
  },
)

onBeforeUnmount(() => {
  mounted = false
  generation += 1
  clearSecret()
})
</script>

<template>
  <section class="telegram-connect" aria-live="polite">
    <template v-if="state === 'connected'">
      <div class="connected-card">
        <CheckCircle2 :size="28" />
        <div>
          <h2>Telegram connected</h2>
          <p v-if="botUsername">
            Bot username:
            <b>@{{ botUsername }}</b>
          </p>
          <p>Customer Telegram messages can now arrive in the dashboard.</p>
        </div>
      </div>
      <p class="limitation">
        Connection is based on saved gateway configuration; live bot status was
        not checked because the gateway has no Telegram status endpoint.
      </p>
      <p class="limitation">
        Disconnect is not currently supported by the gateway.
      </p>
    </template>

    <template v-else>
      <div class="heading">
        <span><Bot :size="23" /></span>
        <div>
          <h2>Connect Telegram</h2>
          <p>Link a Telegram bot to receive customer conversations.</p>
        </div>
      </div>

      <div v-if="state === 'connecting'" class="loading" role="status">
        <LoaderCircle class="spinner" :size="24" />
        Connecting your Telegram bot…
      </div>

      <p v-if="state === 'error'" class="error-message" role="alert">
        {{ errorMessage }}
      </p>

      <ol>
        <li>Open Telegram.</li>
        <li>
          Search for
          <b>@BotFather</b>
          .
        </li>
        <li>
          Send
          <code>/newbot</code>
          .
        </li>
        <li>Follow the instructions.</li>
        <li>Copy the generated bot token.</li>
        <li>Paste it into the dashboard.</li>
      </ol>

      <form @submit.prevent="connect">
        <label for="telegram-bot-token">Bot token</label>
        <div class="token-field">
          <input
            id="telegram-bot-token"
            v-model="token"
            :type="showToken ? 'text' : 'password'"
            autocomplete="off"
            placeholder="Paste your BotFather token"
            :disabled="state === 'connecting'"
          />
          <button
            type="button"
            class="reveal"
            :aria-label="showToken ? 'Hide bot token' : 'Show bot token'"
            :disabled="state === 'connecting'"
            @click="showToken = !showToken"
          >
            <EyeOff v-if="showToken" :size="17" />
            <Eye v-else :size="17" />
            {{ showToken ? 'Hide' : 'Show' }}
          </button>
        </div>
        <small class="security">
          <ShieldCheck :size="14" />
          The token is sent only to the gateway and is cleared after connection.
        </small>
        <div class="actions">
          <AppButton type="submit" :disabled="connectDisabled">
            {{ state === 'connecting' ? 'Connecting…' : 'Connect Telegram' }}
          </AppButton>
          <AppButton
            v-if="state === 'error'"
            type="button"
            variant="outline"
            @click="retry"
          >
            Retry
          </AppButton>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.telegram-connect {
  max-width: 650px;
}
.heading,
.connected-card,
.loading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.heading > span {
  width: 44px;
  height: 44px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 11px;
  color: var(--telegram);
  background: #e3f2fb;
}
.heading h2,
.connected-card h2 {
  margin: 0 0 5px;
}
.heading p,
.connected-card p {
  margin: 3px 0;
  color: var(--muted);
  font-size: 13px;
}
ol {
  margin: 20px 0;
  padding-left: 22px;
  color: var(--text-2);
  font-size: 12.5px;
  line-height: 1.9;
}
form > label {
  display: block;
  margin-bottom: 7px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}
.token-field {
  display: flex;
  align-items: stretch;
  max-width: 560px;
}
.token-field input {
  min-width: 0;
  flex: 1;
  border-radius: 10px 0 0 10px;
}
.reveal {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border);
  border-left: 0;
  border-radius: 0 10px 10px 0;
  padding: 0 12px;
  color: var(--text-2);
  background: #fff;
  font-size: 12px;
  font-weight: 600;
}
.security {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 16px;
  color: var(--muted);
  font-size: 10.5px;
}
.loading {
  align-items: center;
  margin: 17px 0;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}
.spinner {
  animation: spin 0.9s linear infinite;
}
.connected-card {
  padding: 17px;
  border-radius: 12px;
  color: var(--success);
  background: var(--success-bg);
}
.limitation {
  color: var(--muted);
  font-size: 12px;
}
.error-message {
  padding: 12px;
  border-radius: 10px;
  color: var(--danger, #a62b2b);
  background: #fff0f0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .token-field {
    flex-direction: column;
  }
  .token-field input,
  .reveal {
    min-height: 42px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .reveal {
    justify-content: center;
    margin-top: 7px;
  }
}
</style>
