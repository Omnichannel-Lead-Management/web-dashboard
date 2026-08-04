<script setup>
import { computed, ref, watch } from 'vue'
import AppButton from '../common/AppButton.vue'
import {
  buildLeadStatusPatch,
  hasConversionValueChanged,
  leadStatusDrafts,
  normalizeConversionValue,
} from '../../services/mappers'

const props = defineProps({
  lead: { type: Object, required: true },
  agents: { type: Array, default: () => [] },
  busyField: { type: String, default: '' },
})

const emit = defineEmits(['update', 'assign'])
const editingNotes = ref(false)
const notesDraft = ref('')
const tagsDraft = ref([])
const tagInput = ref('')
const serviceInterestDraft = ref('')
const budgetDraft = ref('')
const statusDraft = ref('new')
const conversionValueDraft = ref('')
const assignmentDraft = ref('')

function resetDrafts() {
  notesDraft.value = props.lead.notes || ''
  tagsDraft.value = [...(props.lead.tags || [])]
  tagInput.value = ''
  serviceInterestDraft.value = props.lead.serviceInterest || ''
  budgetDraft.value = props.lead.budgetRange || ''
  const statusDrafts = leadStatusDrafts(props.lead)
  statusDraft.value = statusDrafts.status
  conversionValueDraft.value = statusDrafts.conversionValue
  assignmentDraft.value = props.lead.assignedAgentId || ''
}

watch(() => props.lead, resetDrafts, { immediate: true, deep: true })
watch(
  () => props.busyField,
  (current, previous) => {
    if (
      previous === 'notes' &&
      !current &&
      notesDraft.value.trim() === (props.lead.notes || '').trim()
    ) {
      editingNotes.value = false
    }
  },
)

const notesChanged = computed(
  () => notesDraft.value.trim() !== (props.lead.notes || '').trim(),
)
const normalizedTags = computed(() =>
  tagsDraft.value.map((tag) => tag.trim()).filter(Boolean),
)
const tagsChanged = computed(
  () =>
    JSON.stringify(normalizedTags.value) !==
    JSON.stringify(props.lead.tags || []),
)
const conversionValueValid = computed(() => {
  const value = normalizeConversionValue(conversionValueDraft.value)
  return value !== null && Number.isFinite(value) && value >= 0
})
const statusChanged = computed(() => statusDraft.value !== props.lead.status)
const conversionValueChanged = computed(() =>
  hasConversionValueChanged(
    conversionValueDraft.value,
    props.lead.conversionValue,
  ),
)
const statusEditorChanged = computed(
  () =>
    statusChanged.value ||
    (statusDraft.value === 'converted' && conversionValueChanged.value),
)
const statusPatchState = computed(() =>
  buildLeadStatusPatch({
    currentStatus: props.lead.status,
    currentConversionValue: props.lead.conversionValue,
    status: statusDraft.value,
    conversionValue: conversionValueDraft.value,
  }),
)

function addTag() {
  const tag = tagInput.value.trim()
  if (!tag) return
  if (
    !tagsDraft.value.some((item) => item.toLowerCase() === tag.toLowerCase())
  ) {
    tagsDraft.value.push(tag)
  }
  tagInput.value = ''
}

function removeTag(index) {
  tagsDraft.value.splice(index, 1)
}

function saveNotes() {
  if (!notesChanged.value || props.busyField) return
  emit('update', { kind: 'notes', patch: { notes: notesDraft.value.trim() } })
}

function cancelNotes() {
  notesDraft.value = props.lead.notes || ''
  editingNotes.value = false
}

function saveTags() {
  if (!tagsChanged.value || props.busyField) return
  emit('update', { kind: 'tags', patch: { tags: normalizedTags.value } })
}

function saveServiceInterest() {
  const value = serviceInterestDraft.value.trim()
  if (value === props.lead.serviceInterest || props.busyField) return
  emit('update', { kind: 'service', patch: { service_interest: value } })
}

function saveBudget() {
  const value = budgetDraft.value || null
  if (value === props.lead.budgetRange || props.busyField) return
  emit('update', { kind: 'budget', patch: { budget_range: value } })
}

function saveStatus() {
  if (!statusPatchState.value.patch || props.busyField) return
  emit('update', { kind: 'status', patch: statusPatchState.value.patch })
}

function cancelStatus() {
  const drafts = leadStatusDrafts(props.lead)
  statusDraft.value = drafts.status
  conversionValueDraft.value = drafts.conversionValue
}

function applyAssignment() {
  if (!assignmentDraft.value || props.busyField) return
  emit('assign', {
    agentId: assignmentDraft.value === 'auto' ? null : assignmentDraft.value,
  })
}
</script>

<template>
  <section class="edit-panel" aria-labelledby="edit-lead-title">
    <h2 id="edit-lead-title">Edit lead</h2>
    <div class="edit-grid">
      <div class="editor wide">
        <div class="editor-heading">
          <label for="lead-notes">Notes</label>
          <button
            v-if="!editingNotes"
            type="button"
            class="text-action"
            @click="editingNotes = true"
          >
            Edit
          </button>
        </div>
        <textarea
          id="lead-notes"
          v-model="notesDraft"
          rows="4"
          :readonly="!editingNotes"
        />
        <div v-if="editingNotes" class="actions">
          <AppButton
            type="button"
            size="sm"
            variant="outline"
            @click="cancelNotes"
          >
            Cancel
          </AppButton>
          <AppButton
            type="button"
            size="sm"
            :disabled="!notesChanged || Boolean(busyField)"
            :loading="busyField === 'notes'"
            :aria-busy="busyField === 'notes'"
            @click="saveNotes"
          >
            {{ busyField === 'notes' ? 'Saving…' : 'Save notes' }}
          </AppButton>
        </div>
      </div>

      <div class="editor wide">
        <label for="lead-tag">Tags</label>
        <div class="tags">
          <span
            v-for="(tag, index) in tagsDraft"
            :key="`${tag}-${index}`"
            class="tag"
          >
            {{ tag }}
            <button
              type="button"
              :aria-label="`Remove tag ${tag}`"
              @click="removeTag(index)"
            >
              ×
            </button>
          </span>
        </div>
        <div class="inline-control">
          <input
            id="lead-tag"
            v-model="tagInput"
            placeholder="Add a tag"
            @keydown.enter.prevent="addTag"
          />
          <AppButton type="button" size="sm" variant="outline" @click="addTag">
            Add
          </AppButton>
          <AppButton
            type="button"
            size="sm"
            :disabled="!tagsChanged || Boolean(busyField)"
            :loading="busyField === 'tags'"
            @click="saveTags"
          >
            {{ busyField === 'tags' ? 'Saving…' : 'Save tags' }}
          </AppButton>
        </div>
      </div>

      <div class="editor">
        <label for="lead-interest">Service interest</label>
        <input id="lead-interest" v-model="serviceInterestDraft" />
        <AppButton
          type="button"
          size="sm"
          :disabled="
            serviceInterestDraft.trim() === lead.serviceInterest ||
            Boolean(busyField)
          "
          :loading="busyField === 'service'"
          @click="saveServiceInterest"
        >
          {{ busyField === 'service' ? 'Saving…' : 'Save interest' }}
        </AppButton>
      </div>

      <div class="editor">
        <label for="lead-budget">Budget range</label>
        <select id="lead-budget" v-model="budgetDraft">
          <option value="">Not set</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <AppButton
          type="button"
          size="sm"
          :disabled="
            (budgetDraft || null) === lead.budgetRange || Boolean(busyField)
          "
          :loading="busyField === 'budget'"
          @click="saveBudget"
        >
          {{ busyField === 'budget' ? 'Saving…' : 'Save budget' }}
        </AppButton>
      </div>

      <div class="editor">
        <label for="lead-status">Status</label>
        <select id="lead-status" v-model="statusDraft">
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        <label v-if="statusDraft === 'converted'" for="conversion-value">
          Conversion value
        </label>
        <input
          v-if="statusDraft === 'converted'"
          id="conversion-value"
          v-model="conversionValueDraft"
          type="number"
          min="0"
          step="0.01"
          required
        />
        <p
          v-if="statusEditorChanged && statusPatchState.error"
          class="inline-error"
          role="alert"
        >
          {{ statusPatchState.error }}
        </p>
        <div class="actions">
          <AppButton
            v-if="statusEditorChanged"
            type="button"
            size="sm"
            variant="outline"
            @click="cancelStatus"
          >
            Cancel
          </AppButton>
          <AppButton
            type="button"
            size="sm"
            :disabled="
              !statusEditorChanged ||
              (statusDraft === 'converted' && !conversionValueValid) ||
              Boolean(busyField)
            "
            :loading="busyField === 'status'"
            @click="saveStatus"
          >
            {{ busyField === 'status' ? 'Applying…' : 'Apply status' }}
          </AppButton>
        </div>
      </div>

      <div class="editor">
        <label for="lead-assignment">Assignment</label>
        <small>Current: {{ lead.agent }}</small>
        <select
          id="lead-assignment"
          v-model="assignmentDraft"
          :disabled="Boolean(busyField)"
        >
          <option v-if="!lead.assignedAgentId" value="" disabled>
            Unassigned
          </option>
          <option value="auto">Auto-assign</option>
          <option v-for="agent in agents" :key="agent.id" :value="agent.id">
            {{ agent.name }} (current agent)
          </option>
        </select>
        <AppButton
          type="button"
          size="sm"
          :disabled="
            !assignmentDraft ||
            assignmentDraft === lead.assignedAgentId ||
            Boolean(busyField)
          "
          :loading="busyField === 'assignment'"
          @click="applyAssignment"
        >
          {{ busyField === 'assignment' ? 'Assigning…' : 'Update assignment' }}
        </AppButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.edit-panel {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}
.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.editor {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 8px;
}
.wide {
  grid-column: 1 / -1;
}
.editor label,
.editor-heading label {
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}
.editor input,
.editor select,
.editor textarea {
  width: 100%;
}
.editor textarea[readonly] {
  color: var(--text-2);
  background: #f8f9fb;
}
.editor-heading,
.inline-control,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.editor-heading {
  justify-content: space-between;
}
.actions {
  justify-content: flex-end;
}
.text-action {
  border: 0;
  padding: 3px;
  color: var(--primary);
  background: transparent;
  font-weight: 700;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: 99px;
  color: var(--primary);
  background: var(--primary-soft);
  font-size: 11px;
  font-weight: 700;
}
.tag button {
  border: 0;
  padding: 0 2px;
  color: inherit;
  background: transparent;
  font-size: 15px;
}
.editor small {
  color: var(--muted);
}
.inline-error {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
}
@media (max-width: 760px) {
  .edit-grid {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
@media (max-width: 600px) {
  .inline-control,
  .actions {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .inline-control input {
    flex-basis: 100%;
  }
}
</style>
