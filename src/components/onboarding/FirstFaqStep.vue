<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import { toFaqPayload } from '../../services/mappers'
import { useAppStore } from '../../stores/app'
import { friendlyErrorMessage } from '../../services/displayText'

const emit = defineEmits(['confirmed', 'blocked'])
const store = useAppStore()
const question = ref('')
const answer = ref('')
const keywordsText = ref('')
const error = ref('')
const backendBlocked = ref(false)
const saving = ref(false)
let active = true

const payload = computed(() =>
  toFaqPayload({
    question: question.value,
    answer: answer.value,
    keywords: keywordsText.value.split(','),
  }),
)
const valid = computed(() =>
  Boolean(payload.value.question && payload.value.answer),
)

async function submit() {
  if (!valid.value || saving.value) return
  const requestBusinessId = store.businessId
  saving.value = true
  error.value = ''
  backendBlocked.value = false
  try {
    const created = await store.createFaq(payload.value)
    if (!active || requestBusinessId !== store.businessId || !created?.id)
      return
    question.value = ''
    answer.value = ''
    keywordsText.value = ''
    emit('confirmed', created)
  } catch (saveError) {
    if (!active || requestBusinessId !== store.businessId) return
    error.value = friendlyErrorMessage(
      saveError,
      'We could not save that FAQ. Please try again.',
    )
    backendBlocked.value = [404, 502, 503].includes(saveError.status)
    if (backendBlocked.value) emit('blocked', error.value)
  } finally {
    if (active && requestBusinessId === store.businessId) saving.value = false
  }
}

watch(
  () => store.businessId,
  () => {
    question.value = ''
    answer.value = ''
    keywordsText.value = ''
    error.value = ''
    backendBlocked.value = false
    saving.value = false
  },
)
onBeforeUnmount(() => {
  active = false
  question.value = ''
  answer.value = ''
  keywordsText.value = ''
})
</script>

<template>
  <section aria-labelledby="first-faq-title">
    <p v-if="store.loadingFaqs" class="loading-note" role="status">
      Checking existing FAQs…
    </p>
    <template v-else-if="store.faqError">
      <p class="error" role="alert">{{ store.faqError }}</p>
      <p class="blocked-note">
        FAQs cannot be saved right now. You can skip this step and add answers
        later from Settings.
      </p>
    </template>
    <form @submit.prevent="submit">
      <label class="field">
        Question
        <input v-model="question" required maxlength="300" />
      </label>
      <label class="field">
        Answer
        <textarea v-model="answer" required rows="5" maxlength="3000" />
      </label>
      <label class="field">
        Keywords
        <input v-model="keywordsText" placeholder="hours, opening, time" />
        <small>
          Separate keywords with commas. Duplicates and extra whitespace are
          removed.
        </small>
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="backendBlocked" class="blocked-note">
        FAQs cannot be saved right now. You can skip this step and add answers
        later from Settings.
      </p>
      <AppButton type="submit" :loading="saving" :disabled="!valid || saving">
        <Plus :size="16" />
        {{ saving ? 'Saving…' : 'Create first FAQ' }}
      </AppButton>
    </form>
  </section>
</template>

<style scoped>
form {
  max-width: 650px;
  display: grid;
  gap: 16px;
}
.field small {
  color: var(--muted);
  font-weight: 500;
}
.error {
  color: var(--danger);
  margin: 0;
  font-size: 13px;
}
.loading-note {
  color: var(--muted);
  margin: 0 0 16px;
  font-size: 13px;
}
.blocked-note {
  margin: 0;
  padding: 12px;
  background: var(--danger-bg);
  border-radius: 10px;
  color: var(--text-2);
  font-size: 12px;
}
</style>
