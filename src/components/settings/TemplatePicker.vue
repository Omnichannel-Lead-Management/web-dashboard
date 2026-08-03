<script setup>
import { computed, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import AppBadge from '../common/AppBadge.vue'
import { useAppStore } from '../../stores/app'
import { mapFlowSteps } from '../../services/mappers'
import { isCurrentTemplateAttachment } from '../../services/templateAttachment'

const props = defineProps({
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['attached'])
const store = useAppStore()
const attaching = ref(new Set())
const mutating = ref(new Set())
const confirmingDelete = ref('')
const expandedFlow = ref('')
const stepCache = ref({})

const businessSector = computed(() =>
  String(
    store.business?.id === store.businessId ? store.business?.sector || '' : '',
  )
    .trim()
    .toLowerCase(),
)
const attachedSectors = computed(
  () => new Set(store.businessFlows.map((flow) => flow.sector.toLowerCase())),
)
const templates = computed(() =>
  [...store.conversationTemplates].sort((a, b) => {
    const aMatch = a.sector.toLowerCase() === businessSector.value ? 0 : 1
    const bMatch = b.sector.toLowerCase() === businessSector.value ? 0 : 1
    return aMatch - bMatch || a.name.localeCompare(b.name)
  }),
)

async function loadTemplates() {
  try {
    await store.refreshConversationTemplates()
  } catch {
    // Store exposes the real gateway error and retry state.
  }
}

async function loadFlows() {
  try {
    await store.refreshBusinessFlows()
  } catch {
    // Store exposes the real gateway error and retry state.
  }
}

async function attach(template) {
  if (attaching.value.has(template.sector)) return
  const requestBusinessId = store.businessId
  attaching.value = new Set(attaching.value).add(template.sector)
  try {
    const flow = await store.attachConversationTemplate(template)
    if (
      isCurrentTemplateAttachment({
        requestBusinessId,
        activeBusinessId: store.businessId,
        flow,
      })
    ) {
      emit('attached', flow)
    }
  } catch {
    // Inline store error preserves the gateway response message.
  } finally {
    const next = new Set(attaching.value)
    next.delete(template.sector)
    attaching.value = next
  }
}

async function toggleFlow(flow) {
  if (mutating.value.has(flow.id)) return
  mutating.value = new Set(mutating.value).add(flow.id)
  try {
    await store.updateBusinessFlow(flow.id, { isActive: !flow.isActive })
  } catch {
    // Store rolls the complete flow back and exposes the backend error.
  } finally {
    const next = new Set(mutating.value)
    next.delete(flow.id)
    mutating.value = next
  }
}

function requestDelete(flowId) {
  confirmingDelete.value = flowId
}

function keepFlow() {
  confirmingDelete.value = ''
}

async function confirmDelete(flowId) {
  if (mutating.value.has(flowId)) return
  mutating.value = new Set(mutating.value).add(flowId)
  try {
    await store.deleteBusinessFlow(flowId)
    if (expandedFlow.value === flowId) expandedFlow.value = ''
  } catch {
    // Store exposes the real gateway error.
  } finally {
    confirmingDelete.value = ''
    const next = new Set(mutating.value)
    next.delete(flowId)
    mutating.value = next
  }
}

function toggleSteps(flow) {
  if (expandedFlow.value === flow.id) {
    expandedFlow.value = ''
    return
  }
  try {
    stepCache.value = {
      ...stepCache.value,
      [flow.id]: { steps: mapFlowSteps(flow.flowJson), error: '' },
    }
  } catch (error) {
    stepCache.value = {
      ...stepCache.value,
      [flow.id]: { steps: [], error: error.message },
    }
  }
  expandedFlow.value = flow.id
}

function formatUpdated(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

watch(
  () => [store.authenticated, store.businessId],
  ([authenticated, businessId]) => {
    store.resetFlowTemplateState()
    confirmingDelete.value = ''
    expandedFlow.value = ''
    stepCache.value = {}
    if (authenticated && businessId) {
      loadTemplates()
      loadFlows()
    }
  },
  { immediate: true },
)
</script>

<template>
  <section
    class="template-picker"
    :class="{ compact: props.compact }"
    aria-labelledby="templates-heading"
  >
    <header>
      <h3 id="templates-heading">Conversation templates</h3>
      <p>
        Attach a prepared conversation without editing its underlying graph.
      </p>
    </header>

    <p
      v-if="!store.authenticated || !store.businessId"
      class="notice error"
      role="alert"
    >
      Select an authenticated business before managing conversation flows.
    </p>

    <template v-else>
      <div v-if="store.loadingTemplates" class="loading" role="status">
        <RefreshCw class="spin" :size="17" />
        Loading templates…
      </div>
      <div v-else-if="store.templateError" class="notice error" role="alert">
        <span>{{ store.templateError }}</span>
        <AppButton size="sm" variant="outline" @click="loadTemplates">
          Retry
        </AppButton>
      </div>
      <div v-else-if="templates.length" class="template-grid">
        <article
          v-for="template in templates"
          :key="template.id"
          class="template-card"
        >
          <div class="card-heading">
            <div>
              <h4>{{ template.name }}</h4>
              <small>{{ template.sector }}</small>
            </div>
            <AppBadge
              v-if="template.sector.toLowerCase() === businessSector"
              tone="primary"
            >
              Recommended
            </AppBadge>
          </div>
          <p v-if="template.triggerIntents.length">
            Helps with
            {{ template.triggerIntents.join(', ').replaceAll('_', ' ') }}.
          </p>
          <AppButton
            size="sm"
            :variant="
              attachedSectors.has(template.sector.toLowerCase())
                ? 'outline'
                : 'primary'
            "
            :disabled="
              attachedSectors.has(template.sector.toLowerCase()) ||
              attaching.has(template.sector)
            "
            @click="attach(template)"
          >
            {{
              attachedSectors.has(template.sector.toLowerCase())
                ? 'Attached'
                : attaching.has(template.sector)
                  ? 'Attaching…'
                  : 'Attach template'
            }}
          </AppButton>
        </article>
      </div>
      <p v-else class="empty">No conversation templates are available.</p>

      <div class="flows-heading">
        <h3>Attached flows</h3>
        <AppButton
          size="sm"
          variant="outline"
          :disabled="store.loadingFlows"
          @click="loadFlows"
        >
          <RefreshCw :size="14" />
          Refresh
        </AppButton>
      </div>
      <div
        v-if="store.flowError && store.businessFlows.length"
        class="notice error"
        role="alert"
      >
        {{ store.flowError }}
      </div>
      <div v-if="store.loadingFlows" class="loading" role="status">
        <RefreshCw class="spin" :size="17" />
        Loading attached flows…
      </div>
      <div
        v-else-if="store.flowError && !store.businessFlows.length"
        class="notice error"
        role="alert"
      >
        <span>{{ store.flowError }}</span>
        <AppButton size="sm" variant="outline" @click="loadFlows">
          Retry
        </AppButton>
      </div>
      <p v-else-if="!store.businessFlows.length" class="empty">
        No conversation flow is attached yet.
      </p>
      <article
        v-for="flow in store.businessFlows"
        v-else
        :key="flow.id"
        class="flow-card"
      >
        <div class="flow-summary">
          <div>
            <div class="flow-title">
              <h4>{{ flow.name }}</h4>
              <AppBadge :tone="flow.isActive ? 'success' : 'neutral'">
                {{ flow.isActive ? 'Active' : 'Inactive' }}
              </AppBadge>
            </div>
            <small>
              {{ flow.sector }}
              <template v-if="flow.createdBy">
                · Added by {{ flow.createdBy }}
              </template>
              <template v-if="flow.updatedAt">
                · Updated {{ formatUpdated(flow.updatedAt) }}
              </template>
            </small>
          </div>
          <button
            type="button"
            role="switch"
            class="toggle"
            :class="{ on: flow.isActive }"
            :aria-checked="flow.isActive"
            :aria-label="`${flow.isActive ? 'Disable' : 'Enable'} ${flow.name}`"
            :disabled="mutating.has(flow.id)"
            @click="toggleFlow(flow)"
          >
            <span />
          </button>
        </div>
        <div class="flow-actions">
          <AppButton size="sm" variant="outline" @click="toggleSteps(flow)">
            <ChevronUp v-if="expandedFlow === flow.id" :size="14" />
            <ChevronDown v-else :size="14" />
            {{ expandedFlow === flow.id ? 'Hide steps' : 'View steps' }}
          </AppButton>
          <template v-if="confirmingDelete === flow.id">
            <AppButton
              size="sm"
              variant="danger"
              :disabled="mutating.has(flow.id)"
              @click="confirmDelete(flow.id)"
            >
              Confirm delete
            </AppButton>
            <AppButton
              size="sm"
              variant="outline"
              :disabled="mutating.has(flow.id)"
              @click="keepFlow"
            >
              Keep flow
            </AppButton>
          </template>
          <AppButton
            v-else
            size="sm"
            variant="outline"
            @click="requestDelete(flow.id)"
          >
            <Trash2 :size="14" />
            Delete
          </AppButton>
        </div>
        <div v-if="expandedFlow === flow.id" class="steps-panel">
          <h5>{{ flow.name }} steps</h5>
          <p v-if="stepCache[flow.id]?.error" class="step-error" role="alert">
            {{ stepCache[flow.id].error }}
          </p>
          <ol v-else>
            <li
              v-for="step in stepCache[flow.id]?.steps || []"
              :key="`${step.id}-${step.branchLabel}`"
            >
              <span>{{ step.order }}</span>
              <div>
                <small v-if="step.branchLabel" class="branch-label">
                  {{ step.branchLabel }}
                </small>
                <b>{{ step.title }}</b>
                <p>{{ step.text }}</p>
                <small>{{ step.type }}</small>
              </div>
            </li>
          </ol>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.template-picker {
  margin-top: 34px;
  padding-top: 26px;
  border-top: 1px solid var(--border);
}
header p,
.template-card p,
.empty {
  color: var(--muted);
  font-size: 12.5px;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.template-card,
.flow-card {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.card-heading,
.flow-summary,
.flow-title,
.flows-heading,
.flow-actions,
.notice,
.loading {
  display: flex;
  align-items: center;
}
.card-heading,
.flow-summary,
.flows-heading {
  justify-content: space-between;
  gap: 12px;
}
h3,
h4,
h5 {
  margin: 0;
}
.card-heading small,
.flow-summary small {
  color: var(--muted);
  font-size: 11px;
  text-transform: capitalize;
}
.flows-heading {
  margin: 28px 0 12px;
}
.flow-card {
  margin-bottom: 10px;
}
.flow-title {
  gap: 8px;
}
.flow-actions {
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 13px;
}
.toggle {
  width: 43px;
  height: 24px;
  display: flex;
  padding: 3px;
  border: 0;
  border-radius: 20px;
  background: #d5d8e2;
}
.toggle.on {
  justify-content: flex-end;
  background: var(--primary);
}
.toggle span {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
}
.notice {
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
}
.notice.error,
.step-error {
  color: var(--danger);
  background: var(--danger-bg);
}
.loading {
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}
.spin {
  animation: spin 0.9s linear infinite;
}
.steps-panel {
  margin-top: 14px;
  padding: 14px;
  border-radius: 10px;
  background: #f7f8fb;
}
.steps-panel ol {
  list-style: none;
  padding: 0;
}
.steps-panel li {
  display: flex;
  gap: 10px;
  margin: 12px 0;
}
.steps-panel li > span {
  width: 25px;
  height: 25px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 50%;
  color: var(--primary);
  background: var(--primary-soft);
  font-size: 11px;
  font-weight: 700;
}
.steps-panel li div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.steps-panel p {
  margin: 0;
  color: var(--text-2);
  font-size: 12px;
  white-space: pre-line;
}
.steps-panel small {
  color: var(--muted);
  font-size: 10px;
}
.branch-label {
  color: var(--primary) !important;
  font-weight: 700;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
  .flow-summary {
    align-items: flex-start;
  }
}
</style>
