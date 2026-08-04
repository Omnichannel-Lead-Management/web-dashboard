<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  CheckCircle2,
  LoaderCircle,
  MessageCircleMore,
  RefreshCw,
} from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import { useAppStore } from '../../stores/app'
import { gatewayApi } from '../../services/gatewayApi'
import {
  mapWhatsAppConnection,
  mapWhatsAppQr,
  mapWhatsAppStatus,
} from '../../services/mappers'
import {
  isWhatsAppRequestCurrent,
  refreshWhatsAppBusinessBestEffort,
  resolveWhatsAppInitialState,
  shouldPollWhatsApp,
} from '../../services/whatsappConnection'
import { friendlyErrorMessage } from '../../services/displayText'

const emit = defineEmits(['connection-change'])
const store = useAppStore()
const state = ref('idle')
const errorMessage = ref('')
const qrImage = ref('')
const instanceName = ref('')
const connectionStatus = ref('Not connected')
const refreshingQr = ref(false)

/** WhatsApp reports machine states; owners need plain words. */
const CONNECTION_LABELS = {
  open: 'Connected',
  connected: 'Connected',
  connecting: 'Connecting…',
  close: 'Not connected',
  closed: 'Not connected',
}
const connectionLabel = computed(
  () =>
    CONNECTION_LABELS[String(connectionStatus.value).toLowerCase()] ||
    'Waiting for you to scan',
)

let mounted = true
let generation = 0
let qrRequestId = 0
let pollTimer = null

const currentBusiness = computed(() =>
  store.business?.id === store.businessId ? store.business : null,
)
const businessLabel = computed(
  () => currentBusiness.value?.name || store.businessName,
)
const activeInstanceName = computed(
  () => currentBusiness.value?.whatsapp_instance_name || instanceName.value,
)

function clearPollTimer() {
  if (pollTimer !== null) clearTimeout(pollTimer)
  pollTimer = null
}

function current(requestGeneration, requestBusinessId) {
  return isWhatsAppRequestCurrent(
    requestGeneration,
    generation,
    requestBusinessId,
    store.businessId,
    mounted && store.authenticated,
  )
}

function invalidateRequests() {
  generation += 1
  qrRequestId += 1
  clearPollTimer()
}

function enterError(error, requestGeneration, requestBusinessId) {
  if (!current(requestGeneration, requestBusinessId)) return
  clearPollTimer()
  state.value = 'error'
  emit('connection-change', false)
  qrImage.value = ''
  errorMessage.value = friendlyErrorMessage(
    error,
    'We could not set up the WhatsApp connection. Please try again.',
  )
}

async function confirmConnected(mapped, requestGeneration, requestBusinessId) {
  if (!current(requestGeneration, requestBusinessId)) return
  state.value = 'connected'
  emit('connection-change', true)
  qrImage.value = ''
  clearPollTimer()
  instanceName.value =
    mapped.instanceName || currentBusiness.value?.whatsapp_instance_name || ''
  connectionStatus.value = mapped.status || 'open'
  qrRequestId += 1
  await refreshWhatsAppBusinessBestEffort(() => store.refreshBusiness())
}

function scheduleStatusPoll(requestGeneration, requestBusinessId) {
  clearPollTimer()
  if (
    !current(requestGeneration, requestBusinessId) ||
    !shouldPollWhatsApp(state.value, mounted)
  )
    return
  pollTimer = setTimeout(
    () => pollStatus(requestGeneration, requestBusinessId),
    3000,
  )
}

async function pollStatus(requestGeneration, requestBusinessId) {
  if (
    !current(requestGeneration, requestBusinessId) ||
    !shouldPollWhatsApp(state.value, mounted)
  )
    return
  try {
    const mapped = mapWhatsAppStatus(
      await gatewayApi.getWhatsAppStatus(requestBusinessId),
    )
    if (!current(requestGeneration, requestBusinessId)) return
    connectionStatus.value = mapped.status || 'Waiting for QR scan'
    if (mapped.connected) {
      await confirmConnected(mapped, requestGeneration, requestBusinessId)
      return
    }
  } catch {
    // A transient poll failure is reflected in status without repeated toasts.
    if (current(requestGeneration, requestBusinessId)) {
      connectionStatus.value = 'Status check temporarily unavailable'
    }
  }
  scheduleStatusPoll(requestGeneration, requestBusinessId)
}

async function loadQr(requestGeneration, requestBusinessId, response = null) {
  const requestId = ++qrRequestId
  refreshingQr.value = true
  try {
    let mapped = response ? mapWhatsAppConnection(response) : null
    if (!mapped?.qrImage) {
      mapped = mapWhatsAppQr(await gatewayApi.getWhatsAppQr(requestBusinessId))
    }
    if (
      !current(requestGeneration, requestBusinessId) ||
      requestId !== qrRequestId ||
      state.value === 'connected'
    )
      return
    qrImage.value = mapped.qrImage
    state.value = 'awaiting-scan'
    errorMessage.value = ''
    connectionStatus.value = 'Waiting for QR scan'
    scheduleStatusPoll(requestGeneration, requestBusinessId)
  } catch (error) {
    if (requestId === qrRequestId) {
      enterError(error, requestGeneration, requestBusinessId)
    }
  } finally {
    if (
      current(requestGeneration, requestBusinessId) &&
      requestId === qrRequestId
    ) {
      refreshingQr.value = false
    }
  }
}

async function connect() {
  const requestBusinessId = store.businessId
  if (!store.authenticated || !requestBusinessId) {
    state.value = 'error'
    errorMessage.value = 'No active business session'
    return
  }
  invalidateRequests()
  const requestGeneration = generation
  state.value = 'generating'
  errorMessage.value = ''
  qrImage.value = ''
  try {
    if (instanceName.value || currentBusiness.value?.whatsapp_instance_name) {
      await loadQr(requestGeneration, requestBusinessId)
      return
    }
    const response = await gatewayApi.connectWhatsApp(requestBusinessId)
    if (!current(requestGeneration, requestBusinessId)) return
    const mapped = mapWhatsAppConnection(response)
    instanceName.value = mapped.instanceName
    if (mapped.connected) {
      await confirmConnected(mapped, requestGeneration, requestBusinessId)
      return
    }
    await loadQr(requestGeneration, requestBusinessId, response)
  } catch (error) {
    enterError(error, requestGeneration, requestBusinessId)
  }
}

async function refreshQr() {
  const requestBusinessId = store.businessId
  const requestGeneration = generation
  await loadQr(requestGeneration, requestBusinessId)
}

function returnToIdle() {
  invalidateRequests()
  qrImage.value = ''
  errorMessage.value = ''
  connectionStatus.value = 'Not connected'
  state.value = 'idle'
  emit('connection-change', false)
}

async function initializeSession() {
  invalidateRequests()
  const requestGeneration = generation
  const requestBusinessId = store.businessId
  qrImage.value = ''
  errorMessage.value = ''
  instanceName.value = currentBusiness.value?.whatsapp_instance_name || ''
  if (!store.authenticated || !requestBusinessId) {
    state.value = 'idle'
    emit('connection-change', false)
    return
  }
  state.value = 'generating'
  try {
    const mapped = mapWhatsAppStatus(
      await gatewayApi.getWhatsAppStatus(requestBusinessId),
    )
    if (!current(requestGeneration, requestBusinessId)) return
    const initial = resolveWhatsAppInitialState(currentBusiness.value, mapped)
    instanceName.value = initial.instanceName
    if (initial.state === 'connected') {
      await confirmConnected(mapped, requestGeneration, requestBusinessId)
    } else {
      connectionStatus.value = mapped.status || 'Not connected'
      state.value = initial.state
      emit('connection-change', false)
    }
  } catch (error) {
    enterError(error, requestGeneration, requestBusinessId)
  }
}

watch(() => [store.authenticated, store.businessId], initializeSession, {
  immediate: true,
})

onBeforeUnmount(() => {
  mounted = false
  invalidateRequests()
})
</script>

<template>
  <section class="whatsapp-connect" aria-live="polite">
    <template v-if="state === 'idle'">
      <div class="heading-icon"><MessageCircleMore :size="24" /></div>
      <h2>Connect WhatsApp</h2>
      <p class="intro">
        Link {{ businessLabel || 'your business' }} to receive customer
        conversations in this dashboard.
      </p>
      <p v-if="activeInstanceName" class="existing-instance">
        This business was linked to WhatsApp before but is not connected right
        now. Continue to get a new QR code.
      </p>
      <AppButton @click="connect">Connect WhatsApp</AppButton>
    </template>

    <template v-else-if="state === 'generating'">
      <div class="loading" role="status">
        <LoaderCircle class="spinner" :size="28" />
        <div>
          <h2>Preparing your WhatsApp connection…</h2>
          <p>Please wait while the secure QR code is requested.</p>
        </div>
      </div>
      <AppButton disabled>Preparing…</AppButton>
    </template>

    <template v-else-if="state === 'awaiting-scan'">
      <h2>Scan with WhatsApp</h2>
      <p class="intro">Use the business phone you want to connect.</p>
      <div class="scan-layout">
        <img
          :src="qrImage"
          class="qr-image"
          alt="WhatsApp connection QR code"
          width="220"
          height="220"
        />
        <div>
          <ol>
            <li>Open WhatsApp</li>
            <li>Open Settings or menu</li>
            <li>Choose Linked devices</li>
            <li>Scan the QR code</li>
          </ol>
          <p class="status-text">
            Status:
            <b>{{ connectionLabel }}</b>
          </p>
          <p class="expiry">
            QR codes expire after a few minutes. If WhatsApp says the code has
            expired, choose Refresh QR for a new one.
          </p>
        </div>
      </div>
      <div class="actions">
        <AppButton :disabled="refreshingQr" @click="refreshQr">
          <RefreshCw :size="15" />
          {{ refreshingQr ? 'Refreshing…' : 'Refresh QR' }}
        </AppButton>
        <AppButton variant="outline" @click="returnToIdle">
          Cancel and return
        </AppButton>
      </div>
    </template>

    <template v-else-if="state === 'connected'">
      <div class="connected-card">
        <CheckCircle2 :size="28" />
        <div>
          <h2>WhatsApp connected</h2>
          <p>Customer messages can now arrive through WhatsApp.</p>
        </div>
      </div>
      <p class="disconnect-note">
        To stop receiving WhatsApp messages, unlink this dashboard from
        <b>Linked devices</b>
        in your WhatsApp app.
      </p>
    </template>

    <template v-else>
      <h2>WhatsApp connection unavailable</h2>
      <p role="alert" class="error-message">{{ errorMessage }}</p>
      <div class="actions">
        <AppButton @click="connect">Retry</AppButton>
        <AppButton variant="outline" @click="returnToIdle">Return</AppButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.whatsapp-connect {
  max-width: 680px;
}
.heading-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  border-radius: 12px;
  color: #12724d;
  background: #e2f4ec;
}
.intro,
.existing-instance,
.loading p,
.connected-card p,
.disconnect-note {
  color: var(--muted);
  font-size: 13px;
}
.loading,
.connected-card {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  margin-bottom: 20px;
  padding: 17px;
  border-radius: 12px;
  background: var(--primary-soft);
}
.loading h2,
.connected-card h2 {
  margin: 0 0 5px;
}
.loading p,
.connected-card p {
  margin: 3px 0;
}
.spinner {
  flex: none;
  animation: spin 0.9s linear infinite;
}
.scan-layout {
  display: flex;
  align-items: center;
  gap: 28px;
  margin: 20px 0;
}
.qr-image {
  flex: none;
  width: 220px;
  height: 220px;
  object-fit: contain;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
}
.scan-layout ol {
  margin: 0 0 14px;
  padding-left: 22px;
}
.status-text,
.expiry {
  font-size: 12px;
  color: var(--text-2);
}
.expiry {
  color: var(--muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
.connected-card {
  color: var(--success);
  background: var(--success-bg);
}
.error-message {
  padding: 13px;
  border-radius: 10px;
  color: var(--danger, #a62b2b);
  background: #fff0f0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .scan-layout {
    align-items: flex-start;
    flex-direction: column;
  }
  .qr-image {
    width: min(100%, 260px);
    height: auto;
    aspect-ratio: 1;
  }
}
</style>
