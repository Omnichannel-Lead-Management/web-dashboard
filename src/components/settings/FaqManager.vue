<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  BookOpenText,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import { useAppStore } from '../../stores/app'
import {
  faqEditorDraft,
  faqPayloadWithPendingKeyword,
  toFaqPayload,
} from '../../services/mappers'
import { friendlyErrorMessage } from '../../services/displayText'

const QUESTION_LIMIT = 160
const ANSWER_LIMIT = 1000
const KEYWORD_LIMIT = 40
const props = defineProps({
  sector: { type: String, default: '' },
})

const STARTERS = {
  salon: [
    'What salon services do you offer?',
    'How can I book a salon appointment?',
    'What are your opening hours?',
  ],
  tutor: [
    'Which subjects and levels do you teach?',
    'How much does a tutoring session cost?',
    'Do you offer online tutoring?',
  ],
  photography: [
    'Which photography packages do you offer?',
    'How far in advance should I book?',
    'When will my edited photos be ready?',
  ],
  generic: [
    'What services do you offer?',
    'What are your opening hours?',
    'How can I make a booking?',
  ],
}

const store = useAppStore()
const search = ref('')
const loadError = ref('')
const formError = ref('')
const keywordInput = ref('')
const saving = ref(false)
const deletingId = ref('')
const confirmingDeleteId = ref('')
const togglingId = ref('')
const showForm = ref(false)
const editingId = ref('')
const originalEdit = ref(null)
const form = reactive({ question: '', answer: '', keywords: [], enabled: true })

const starterSuggestions = computed(() => {
  const sector = props.sector.trim().toLowerCase()
  if (sector.includes('salon')) return STARTERS.salon
  if (sector.includes('tutor') || sector.includes('education'))
    return STARTERS.tutor
  if (sector.includes('photo')) return STARTERS.photography
  return STARTERS.generic
})

const filteredFaqs = computed(() => {
  const query = store.faqs.length > 8 ? search.value.trim().toLowerCase() : ''
  if (!query) return store.faqs
  return store.faqs.filter((faq) =>
    [faq.question, faq.answer, ...faq.keywords].some((value) =>
      value.toLowerCase().includes(query),
    ),
  )
})

const formValid = computed(
  () =>
    form.question.trim().length > 0 &&
    form.question.length <= QUESTION_LIMIT &&
    form.answer.trim().length > 0 &&
    form.answer.length <= ANSWER_LIMIT,
)
const formChanged = computed(() => {
  if (!editingId.value || !originalEdit.value) return true
  return (
    JSON.stringify(faqPayloadWithPendingKeyword(form, keywordInput.value)) !==
    JSON.stringify(toFaqPayload(originalEdit.value))
  )
})

async function loadFaqs() {
  loadError.value = ''
  try {
    await store.refreshFaqs()
  } catch (error) {
    loadError.value = friendlyErrorMessage(
      error,
      'We could not load your FAQs. Please try again.',
    )
  }
}

function resetForm() {
  const draft = faqEditorDraft()
  form.question = draft.question
  form.answer = draft.answer
  form.keywords = draft.keywords
  form.enabled = draft.enabled
  keywordInput.value = draft.keywordInput
  editingId.value = ''
  originalEdit.value = null
  formError.value = ''
}

function openCreate(question = '') {
  confirmingDeleteId.value = ''
  resetForm()
  form.question = question
  showForm.value = true
}

function openEdit(faq) {
  confirmingDeleteId.value = ''
  showForm.value = false
  const draft = faqEditorDraft(faq)
  form.question = draft.question
  form.answer = draft.answer
  form.keywords = draft.keywords
  form.enabled = draft.enabled
  editingId.value = faq.id
  keywordInput.value = draft.keywordInput
  formError.value = ''
  originalEdit.value = {
    question: faq.question,
    answer: faq.answer,
    keywords: [...faq.keywords],
    enabled: faq.enabled,
  }
  showForm.value = true
}

function closeForm() {
  confirmingDeleteId.value = ''
  showForm.value = false
  resetForm()
}

function addKeyword() {
  const keyword = keywordInput.value.replace(/,$/, '').trim()
  if (!keyword || keyword.length > KEYWORD_LIMIT) return
  if (
    !form.keywords.some((item) => item.toLowerCase() === keyword.toLowerCase())
  ) {
    form.keywords.push(keyword)
  }
  keywordInput.value = ''
}

function handleKeywordKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addKeyword()
  }
}

async function saveFaq() {
  if (saving.value) return
  addKeyword()
  if (!formValid.value || (editingId.value && !formChanged.value)) return
  saving.value = true
  formError.value = ''
  try {
    if (editingId.value) {
      await store.updateFaq(editingId.value, form)
    } else {
      await store.createFaq(form)
    }
    closeForm()
  } catch (error) {
    formError.value = friendlyErrorMessage(
      error,
      'We could not save that FAQ. Please try again.',
    )
  } finally {
    saving.value = false
  }
}

async function toggleFaq(faq) {
  confirmingDeleteId.value = ''
  const next = !faq.enabled
  togglingId.value = faq.id
  try {
    await store.updateFaq(faq.id, { enabled: next })
  } catch {
    // The store rolls the optimistic toggle back and reports the API error.
  } finally {
    togglingId.value = ''
  }
}

async function removeFaq(faq) {
  if (confirmingDeleteId.value !== faq.id) {
    confirmingDeleteId.value = faq.id
    return
  }
  editingId.value = ''
  showForm.value = false
  deletingId.value = faq.id
  try {
    await store.deleteFaq(faq.id)
  } catch {
    // The store keeps the FAQ and reports the API error.
  } finally {
    deletingId.value = ''
    confirmingDeleteId.value = ''
  }
}

function keepFaq() {
  confirmingDeleteId.value = ''
}

onMounted(loadFaqs)
</script>

<template>
  <section class="faq-manager" aria-labelledby="faq-title">
    <header class="faq-header">
      <div>
        <h2 id="faq-title">FAQs &amp; answers</h2>
        <p class="intro">
          Teach Loop accurate answers to common customer questions.
        </p>
      </div>
      <AppButton
        :disabled="!store.businessId || showForm || Boolean(editingId)"
        @click="openCreate()"
      >
        <Plus :size="16" />
        Add FAQ
      </AppButton>
    </header>

    <div v-if="!store.businessId" class="notice" role="alert">
      Select a business before managing FAQs.
    </div>

    <div
      v-if="showForm && !editingId"
      class="editor"
      aria-labelledby="faq-editor-title"
    >
      <div class="editor-title">
        <h3 id="faq-editor-title">New FAQ</h3>
        <button
          type="button"
          class="icon-button"
          aria-label="Close FAQ editor"
          @click="closeForm"
        >
          <X :size="18" />
        </button>
      </div>
      <form @submit.prevent="saveFaq">
        <label class="field">
          Question
          <textarea
            v-model="form.question"
            rows="2"
            :maxlength="QUESTION_LIMIT"
            required
            placeholder="What do customers often ask?"
          />
          <small class="counter">
            {{ form.question.length }}/{{ QUESTION_LIMIT }}
          </small>
        </label>
        <label class="field">
          Answer
          <textarea
            v-model="form.answer"
            rows="5"
            :maxlength="ANSWER_LIMIT"
            required
            placeholder="Write the answer Loop should give."
          />
          <small class="counter">
            {{ form.answer.length }}/{{ ANSWER_LIMIT }}
          </small>
          <small
            v-if="form.answer.length > 600"
            class="length-warning"
            role="status"
          >
            Long answers may be harder for customers to scan.
          </small>
        </label>
        <label class="field">
          Keywords
          <small>Optional — press Enter or comma to add</small>
          <input
            v-model="keywordInput"
            :maxlength="KEYWORD_LIMIT"
            placeholder="e.g. hours"
            @keydown="handleKeywordKeydown"
            @blur="addKeyword"
          />
        </label>
        <div
          v-if="form.keywords.length"
          class="chips"
          aria-label="FAQ keywords"
        >
          <span
            v-for="(keyword, index) in form.keywords"
            :key="keyword"
            class="chip"
          >
            {{ keyword }}
            <button
              type="button"
              :aria-label="`Remove ${keyword}`"
              @click="form.keywords.splice(index, 1)"
            >
              <X :size="13" />
            </button>
          </span>
        </div>
        <p v-if="formError" class="notice error" role="alert">
          {{ formError }}
        </p>
        <div class="form-actions">
          <AppButton
            type="button"
            variant="outline"
            :disabled="saving"
            @click="closeForm"
          >
            Cancel
          </AppButton>
          <AppButton type="submit" :loading="saving" :disabled="!formValid">
            {{ saving ? 'Saving…' : 'Create FAQ' }}
          </AppButton>
        </div>
      </form>
    </div>

    <div
      v-if="
        !showForm && !store.loadingFaqs && !loadError && store.faqs.length === 0
      "
      class="starters"
    >
      <span class="starter-icon"><BookOpenText :size="22" /></span>
      <h3>Add your first FAQ</h3>
      <p>
        No FAQs yet — your chatbot will fall back to the AI assistant for every
        question.
      </p>
      <AppButton size="sm" @click="openCreate()">Add your first FAQ</AppButton>
      <p>Or start from a common question:</p>
      <div class="starter-list">
        <button
          v-for="starter in starterSuggestions"
          :key="starter"
          type="button"
          @click="openCreate(starter)"
        >
          <Plus :size="15" />
          {{ starter }}
        </button>
      </div>
    </div>

    <div
      v-if="store.loadingFaqs"
      class="state"
      role="status"
      aria-live="polite"
    >
      <RefreshCw class="spin" :size="20" />
      Loading FAQs…
    </div>
    <div v-else-if="loadError" class="notice error" role="alert">
      <span>{{ loadError }}</span>
      <AppButton size="sm" variant="outline" @click="loadFaqs">
        <RefreshCw :size="14" />
        Retry
      </AppButton>
    </div>

    <template v-else-if="store.faqs.length">
      <label v-if="store.faqs.length > 8" class="search-field">
        <span class="sr-only">Search FAQs</span>
        <Search :size="17" />
        <input
          v-model="search"
          type="search"
          placeholder="Search questions, answers or keywords"
          @input="confirmingDeleteId = ''"
        />
      </label>
      <div v-if="filteredFaqs.length" class="faq-list">
        <article
          v-for="faq in filteredFaqs"
          :key="faq.id"
          class="faq-card"
          :class="{ disabled: !faq.enabled }"
        >
          <div v-if="editingId === faq.id" class="editor row-editor">
            <div class="editor-title">
              <h3 :id="`faq-editor-${faq.id}`">Edit FAQ</h3>
              <button
                type="button"
                class="icon-button"
                :aria-label="`Close editor for ${faq.question}`"
                @click="closeForm"
              >
                <X :size="18" />
              </button>
            </div>
            <form
              :aria-labelledby="`faq-editor-${faq.id}`"
              @submit.prevent="saveFaq"
            >
              <label class="field">
                Question
                <textarea
                  v-model="form.question"
                  rows="2"
                  :maxlength="QUESTION_LIMIT"
                  required
                />
                <small class="counter">
                  {{ form.question.length }}/{{ QUESTION_LIMIT }}
                </small>
              </label>
              <label class="field">
                Answer
                <textarea
                  v-model="form.answer"
                  rows="5"
                  :maxlength="ANSWER_LIMIT"
                  required
                />
                <small class="counter">
                  {{ form.answer.length }}/{{ ANSWER_LIMIT }}
                </small>
                <small
                  v-if="form.answer.length > 600"
                  class="length-warning"
                  role="status"
                >
                  Long answers may be harder for customers to scan.
                </small>
              </label>
              <label class="field">
                Keywords
                <small>Optional — press Enter or comma to add</small>
                <input
                  v-model="keywordInput"
                  :maxlength="KEYWORD_LIMIT"
                  placeholder="e.g. hours"
                  @keydown="handleKeywordKeydown"
                  @blur="addKeyword"
                />
              </label>
              <div
                v-if="form.keywords.length"
                class="chips"
                aria-label="FAQ keywords"
              >
                <span
                  v-for="(keyword, index) in form.keywords"
                  :key="keyword"
                  class="chip"
                >
                  {{ keyword }}
                  <button
                    type="button"
                    :aria-label="`Remove ${keyword}`"
                    @click="form.keywords.splice(index, 1)"
                  >
                    <X :size="13" />
                  </button>
                </span>
              </div>
              <p v-if="formError" class="notice error" role="alert">
                {{ formError }}
              </p>
              <div class="form-actions">
                <AppButton
                  type="button"
                  variant="outline"
                  :disabled="saving"
                  @click="closeForm"
                >
                  Cancel
                </AppButton>
                <AppButton
                  type="submit"
                  :loading="saving"
                  :disabled="!formValid || !formChanged"
                >
                  {{ saving ? 'Saving…' : 'Save changes' }}
                </AppButton>
              </div>
            </form>
          </div>
          <div v-else class="faq-copy">
            <div class="faq-question">
              <h3>{{ faq.question }}</h3>
              <span :class="['status-pill', { enabled: faq.enabled }]">
                <Check v-if="faq.enabled" :size="12" />
                {{ faq.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            <p class="answer-preview">{{ faq.answer }}</p>
            <div v-if="faq.keywords.length" class="chips">
              <span
                v-for="keyword in faq.keywords"
                :key="keyword"
                class="chip static"
              >
                {{ keyword }}
              </span>
            </div>
          </div>
          <div v-if="editingId !== faq.id" class="faq-actions">
            <button
              type="button"
              role="switch"
              :aria-checked="faq.enabled"
              :aria-label="`${faq.enabled ? 'Disable' : 'Enable'} ${faq.question}`"
              class="toggle"
              :class="{ on: faq.enabled }"
              :disabled="togglingId === faq.id"
              @click="toggleFaq(faq)"
            >
              <span />
            </button>
            <button
              type="button"
              class="icon-button"
              :aria-label="`Edit ${faq.question}`"
              @click="openEdit(faq)"
            >
              <Pencil :size="16" />
            </button>
            <button
              type="button"
              class="delete-button"
              :class="{ confirming: confirmingDeleteId === faq.id }"
              :disabled="deletingId === faq.id"
              :aria-label="`${confirmingDeleteId === faq.id ? 'Confirm delete' : 'Delete'} ${faq.question}`"
              @click="removeFaq(faq)"
            >
              <Trash2 :size="16" />
              {{ confirmingDeleteId === faq.id ? 'Confirm delete' : 'Delete' }}
            </button>
            <button
              v-if="confirmingDeleteId === faq.id"
              type="button"
              class="icon-button"
              :aria-label="`Keep ${faq.question}`"
              @click="keepFaq"
            >
              Keep
            </button>
          </div>
        </article>
      </div>
      <div v-else class="state">No FAQs match “{{ search }}”.</div>
    </template>
  </section>
</template>

<style scoped>
.faq-manager {
  width: 100%;
}
.faq-header,
.editor-title,
.faq-question,
.form-actions,
.faq-actions {
  display: flex;
  align-items: center;
}
.faq-header {
  justify-content: space-between;
  gap: 16px;
}
.faq-header h2 {
  margin-bottom: 6px;
}
.intro {
  margin-bottom: 0;
}
.editor {
  margin-top: 22px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: #fafbfe;
}
.editor-title {
  justify-content: space-between;
  margin-bottom: 16px;
}
.editor-title h3 {
  margin: 0;
  font-size: 15px;
}
.editor form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  position: relative;
}
.field > small {
  color: var(--muted);
  font-weight: 500;
}
.counter {
  align-self: flex-end;
  margin-top: -3px;
}
.length-warning {
  align-self: flex-start;
  padding: 7px 9px;
  border-radius: 8px;
  background: #fff7df;
  color: #8a6512 !important;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-size: 11px;
  font-weight: 700;
}
.chip button,
.icon-button {
  border: 0;
  background: transparent;
  display: inline-grid;
  place-items: center;
  padding: 2px;
  color: inherit;
}
.chip.static {
  padding-inline: 9px;
}
.form-actions {
  justify-content: flex-end;
  gap: 8px;
}
.notice {
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f1f2f6;
  color: var(--text-2);
  font-size: 12.5px;
}
.notice.error {
  background: var(--danger-bg);
  color: var(--danger);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.starters,
.state {
  text-align: center;
  padding: 42px 20px;
  color: var(--muted);
}
.starter-icon {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  margin: 0 auto 12px;
  background: var(--primary-soft);
  color: var(--primary);
}
.starters h3 {
  color: var(--text);
  margin-bottom: 6px;
}
.starters p {
  font-size: 12.5px;
}
.starter-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-width: 560px;
  margin: 18px auto 0;
}
.starter-list button {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 10px;
  padding: 10px;
  color: var(--text-2);
  font-size: 12px;
  text-align: left;
  display: flex;
  gap: 7px;
  align-items: center;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 22px 0 12px;
  padding-left: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--muted);
}
.search-field:focus-within {
  outline: 3px solid rgba(79, 70, 229, 0.18);
  border-color: var(--primary);
}
.search-field input {
  border: 0;
  outline: 0;
  padding-left: 0;
}
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.faq-card {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 15px;
}
.faq-card.disabled {
  background: #fafafa;
}
.row-editor {
  flex: 1;
  margin-top: 0;
}
.faq-copy {
  min-width: 0;
  flex: 1;
}
.faq-question {
  gap: 8px;
  align-items: flex-start;
}
.faq-question h3 {
  font-size: 13.5px;
  margin: 0;
}
.faq-copy p {
  color: var(--text-2);
  font-size: 12.5px;
  line-height: 1.55;
  margin: 8px 0 10px;
  white-space: pre-wrap;
}
.answer-preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  border-radius: 999px;
  background: #eef0f5;
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 700;
  white-space: nowrap;
}
.status-pill.enabled {
  background: var(--success-bg);
  color: var(--success);
}
.faq-actions {
  align-self: flex-start;
  gap: 6px;
}
.icon-button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-2);
}
.icon-button.danger {
  color: var(--danger);
}
.delete-button {
  min-height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 8px;
  background: #fff;
  color: var(--danger);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.delete-button.confirming {
  border-color: var(--danger);
  background: var(--danger-bg);
}
.delete-button:disabled {
  opacity: 0.45;
}
.icon-button:disabled {
  opacity: 0.45;
}
.toggle {
  width: 39px;
  height: 22px;
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
.toggle span {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
}
.state {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.spin {
  animation: spin 1s linear infinite;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .faq-header,
  .faq-card {
    align-items: stretch;
    flex-direction: column;
  }
  .faq-header :deep(.btn) {
    align-self: flex-start;
  }
  .starter-list {
    grid-template-columns: 1fr;
  }
  .faq-actions {
    align-self: flex-end;
  }
}
</style>
