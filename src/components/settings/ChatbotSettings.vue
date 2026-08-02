<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw, Sparkles } from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import TemplatePicker from './TemplatePicker.vue'
import { useAppStore } from '../../stores/app'
import { toChatbotConfigPatch } from '../../services/mappers'

const MESSAGE_LIMIT = 1000
const props = defineProps({
  businessName: { type: String, default: 'Your business' },
})

const store = useAppStore()
const welcomeDraft = ref('')
const escalationDraft = ref('')
const draftsTouched = ref(false)
const saveError = ref('')
const initialLoadComplete = ref(false)

const normalizedDrafts = computed(() =>
  toChatbotConfigPatch({
    welcomeMessage: welcomeDraft.value,
    escalationMessage: escalationDraft.value,
  }),
)
const normalizedConfirmed = computed(() =>
  toChatbotConfigPatch({
    welcomeMessage: store.chatbotConfig.welcomeMessage,
    escalationMessage: store.chatbotConfig.escalationMessage,
  }),
)
const messagesChanged = computed(
  () =>
    JSON.stringify(normalizedDrafts.value) !==
    JSON.stringify(normalizedConfirmed.value),
)
const previewText = computed(
  () =>
    welcomeDraft.value.trim() ||
    'Your chatbot’s default welcome message will appear here.',
)

function resetDrafts() {
  welcomeDraft.value = store.chatbotConfig.welcomeMessage
  escalationDraft.value = store.chatbotConfig.escalationMessage
  draftsTouched.value = false
  saveError.value = ''
}

watch(
  () => store.chatbotConfig,
  () => {
    if (!draftsTouched.value) resetDrafts()
  },
  { immediate: true, deep: true },
)

async function loadConfig() {
  initialLoadComplete.value = false
  saveError.value = ''
  try {
    await store.refreshChatbotConfig()
    resetDrafts()
  } catch {
    // Store exposes the gateway error and retry state.
  } finally {
    initialLoadComplete.value = true
  }
}

async function toggleAutomaticReplies() {
  if (store.savingChatbotConfig) return
  try {
    await store.updateChatbotEnabled(!store.chatbotConfig.chatbotEnabled)
  } catch {
    // Store rolls back the optimistic state and reports the backend error.
  }
}

async function saveMessages() {
  if (!messagesChanged.value || store.savingChatbotConfig) return
  saveError.value = ''
  try {
    await store.saveChatbotMessages({
      welcomeMessage: welcomeDraft.value,
      escalationMessage: escalationDraft.value,
    })
    resetDrafts()
  } catch (error) {
    saveError.value = error.message || 'Chatbot messages could not be saved.'
  }
}

onMounted(loadConfig)
</script>

<template>
  <section class="chatbot-settings" aria-labelledby="chatbot-settings-title">
    <header>
      <h2 id="chatbot-settings-title">Chatbot settings</h2>
      <p>
        Let Loop answer common questions and qualify leads automatically.
      </p>
    </header>

    <div v-if="!store.businessId" class="notice" role="alert">
      Select a business before managing chatbot settings.
    </div>
    <div
      v-else-if="
        !initialLoadComplete ||
        (store.loadingChatbotConfig && !store.chatbotConfig.businessId)
      "
      class="state"
      role="status"
    >
      <RefreshCw class="spin" :size="18" />
      Loading chatbot settings…
    </div>
    <div
      v-else-if="store.chatbotConfigError && !store.chatbotConfig.businessId"
      class="notice error"
      role="alert"
    >
      <span>{{ store.chatbotConfigError }}</span>
      <AppButton size="sm" variant="outline" @click="loadConfig">
        Retry
      </AppButton>
    </div>

    <template v-else>
      <div class="toggle-row">
        <div>
          <b>Automatic replies</b>
          <small>
            When automatic replies are off, new customer messages are handed
            to a human agent instead of receiving chatbot replies.
          </small>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="store.chatbotConfig.chatbotEnabled"
          :aria-busy="store.savingChatbotConfig"
          :disabled="store.savingChatbotConfig || store.loadingChatbotConfig"
          class="toggle"
          :class="{ on: store.chatbotConfig.chatbotEnabled }"
          @click="toggleAutomaticReplies"
        >
          <span />
        </button>
      </div>

      <form @submit.prevent="saveMessages">
        <label class="field">
          Welcome message
          <textarea
            v-model="welcomeDraft"
            rows="4"
            :maxlength="MESSAGE_LIMIT"
            placeholder="Enter the greeting customers should receive"
            :disabled="store.savingChatbotConfig"
            @input="draftsTouched = true"
          />
          <small class="counter">
            {{ welcomeDraft.length }}/{{ MESSAGE_LIMIT }}
          </small>
          <small v-if="welcomeDraft.length > 600" class="warning">
            Long messages may be harder for customers to scan.
          </small>
        </label>

        <div class="preview" aria-live="polite">
          <span class="preview-label">Preview — unsaved changes are not active</span>
          <span class="bot-label"><i><Sparkles :size="11" /></i>Loop Assistant</span>
          <p>{{ previewText }}</p>
          <small>{{ props.businessName || 'Your business' }}</small>
        </div>

        <label class="field">
          Escalation message
          <textarea
            v-model="escalationDraft"
            rows="4"
            :maxlength="MESSAGE_LIMIT"
            placeholder="Enter the message shown before a human handoff"
            :disabled="store.savingChatbotConfig"
            @input="draftsTouched = true"
          />
          <small class="counter">
            {{ escalationDraft.length }}/{{ MESSAGE_LIMIT }}
          </small>
          <small v-if="escalationDraft.length > 600" class="warning">
            Long messages may be harder for customers to scan.
          </small>
        </label>

        <p class="default-note">
          Leave a message blank to use the chatbot’s default message.
        </p>
        <p v-if="saveError" class="notice error" role="alert">
          {{ saveError }}
        </p>
        <div class="actions">
          <AppButton
            type="button"
            variant="outline"
            :disabled="!messagesChanged || store.savingChatbotConfig"
            @click="resetDrafts"
          >
            Cancel
          </AppButton>
          <AppButton
            type="submit"
            :loading="store.savingChatbotConfig"
            :disabled="!messagesChanged || store.savingChatbotConfig"
          >
            {{ store.savingChatbotConfig ? 'Saving…' : 'Save messages' }}
          </AppButton>
        </div>
      </form>
    </template>

    <TemplatePicker />
  </section>
</template>

<style scoped>
.chatbot-settings header p,
.default-note {
  color: var(--muted);
  font-size: 12.5px;
}
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin: 20px 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 11px;
}
.toggle-row div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.toggle-row small {
  max-width: 570px;
  color: var(--muted);
}
.toggle {
  width: 43px;
  height: 24px;
  flex: none;
  padding: 3px;
  border: 0;
  border-radius: 999px;
  background: #d5d8e2;
}
.toggle span {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s ease;
}
.toggle.on {
  background: var(--primary);
}
.toggle.on span {
  transform: translateX(19px);
}
.toggle:disabled {
  opacity: 0.55;
}
form,
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
form {
  gap: 18px;
}
.field {
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}
.field textarea {
  width: 100%;
  resize: vertical;
}
.counter {
  align-self: flex-end;
  color: var(--muted);
  font-weight: 500;
}
.warning {
  color: #8a6512;
  font-weight: 500;
}
.preview {
  max-width: 620px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fafbfe;
}
.preview-label {
  display: block;
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.bot-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--primary);
  font-size: 10.5px;
  font-weight: 700;
}
.bot-label i {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 6px;
  background: #ece9ff;
}
.preview p {
  width: fit-content;
  max-width: 88%;
  margin: 5px 0;
  padding: 11px 15px;
  border: 1px solid #e7e3ff;
  border-radius: 4px 18px 18px;
  background: #f2f0ff;
  color: var(--text);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.preview > small {
  color: var(--muted);
}
.actions,
.notice,
.state {
  display: flex;
  align-items: center;
  gap: 9px;
}
.actions {
  justify-content: flex-end;
}
.notice,
.state {
  margin-top: 18px;
  padding: 13px;
  border-radius: 10px;
  background: #f1f2f6;
  color: var(--text-2);
}
.notice.error {
  justify-content: space-between;
  background: var(--danger-bg);
  color: var(--danger);
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@media (max-width: 600px) {
  .toggle-row {
    align-items: flex-start;
  }
  .actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
