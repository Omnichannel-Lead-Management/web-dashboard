<script setup>
import { ref, computed, watch } from 'vue'
import { AlertCircle, RefreshCw, Search, Users } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import AppButton from '../components/common/AppButton.vue'
import LeadTable from '../components/leads/LeadTable.vue'
import { useAppStore } from '../stores/app'
import {
  filterVisibleLeads,
  retainVisibleLeadSelection,
  summarizeBulkLeadResults,
} from '../services/mappers'
const store = useAppStore()

const searchText = ref('')
const selectedStatus = ref('')
const selectedChannel = ref('All')
const selectedIds = ref([])
const bulkStatus = ref('')
const bulkAssignment = ref('')
const bulkLoading = ref(false)
const bulkMessage = ref(null)

watch(
  selectedStatus,
  (status) => store.refreshLeads({ status: status || undefined }),
  { immediate: true },
)

const filteredLeads = computed(() => {
  return filterVisibleLeads(store.leads, {
    search: searchText.value,
    status: selectedStatus.value,
    channel: selectedChannel.value,
  })
})

const visibleIds = computed(() => filteredLeads.value.map((lead) => lead.id))
const allVisibleSelected = computed(
  () =>
    visibleIds.value.length > 0 &&
    visibleIds.value.every((id) => selectedIds.value.includes(id)),
)

watch(visibleIds, (ids) => {
  selectedIds.value = retainVisibleLeadSelection(selectedIds.value, ids)
})

function toggleSelection(id) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id]
}

function toggleAllVisible() {
  if (allVisibleSelected.value) selectedIds.value = []
  else selectedIds.value = [...visibleIds.value]
}

async function finishBulk(
  ids,
  results,
  actionLabel,
  sessionVersion,
  requestBusinessId,
) {
  const summary = summarizeBulkLeadResults(ids, results)
  await store.refreshLeads({ status: selectedStatus.value || undefined })
  if (
    sessionVersion !== store.leadSessionVersion ||
    requestBusinessId !== store.businessId
  )
    return
  selectedIds.value = summary.failedIds
  if (summary.failedIds.length === 0) {
    bulkMessage.value = {
      type: 'success',
      text: `${actionLabel} updated for ${summary.succeededIds.length} leads`,
    }
    store.notify(bulkMessage.value.text)
  } else {
    bulkMessage.value = {
      type: 'error',
      text: `${summary.succeededIds.length} succeeded and ${summary.failedIds.length} failed`,
    }
    store.notify(bulkMessage.value.text, 'error')
  }
}

async function applyBulkStatus() {
  if (
    !selectedIds.value.length ||
    !bulkStatus.value ||
    bulkStatus.value === 'converted'
  )
    return
  bulkLoading.value = true
  bulkMessage.value = null
  const sessionVersion = store.leadSessionVersion
  const requestBusinessId = store.businessId
  const ids = [...selectedIds.value]
  const results = await Promise.allSettled(
    ids.map((id) =>
      store.updateLead(id, { status: bulkStatus.value }, { silent: true }),
    ),
  )
  if (
    sessionVersion !== store.leadSessionVersion ||
    requestBusinessId !== store.businessId
  ) {
    bulkLoading.value = false
    return
  }
  await finishBulk(ids, results, 'Status', sessionVersion, requestBusinessId)
  bulkLoading.value = false
}

async function applyBulkAssignment() {
  if (!selectedIds.value.length || !bulkAssignment.value) return
  bulkLoading.value = true
  bulkMessage.value = null
  const sessionVersion = store.leadSessionVersion
  const requestBusinessId = store.businessId
  const ids = [...selectedIds.value]
  const results = await Promise.allSettled(
    ids.map((id) =>
      bulkAssignment.value === 'auto'
        ? store.autoAssignLead(id, { silent: true })
        : store.assignLead(id, bulkAssignment.value, { silent: true }),
    ),
  )
  if (
    sessionVersion !== store.leadSessionVersion ||
    requestBusinessId !== store.businessId
  ) {
    bulkLoading.value = false
    return
  }
  await finishBulk(
    ids,
    results,
    'Assignment',
    sessionVersion,
    requestBusinessId,
  )
  bulkLoading.value = false
}
</script>
<template>
  <AppShell>
    <div class="page">
      <div class="page-title">
        <div>
          <h1>Leads</h1>
          <p>Every inquiry, scored and tracked automatically.</p>
        </div>
      </div>
      <div class="toolbar">
        <label>
          <Search :size="16" />
          <input
            v-model="searchText"
            type="search"
            aria-label="Search leads"
            placeholder="Search by name or interest"
          />
        </label>
        <select v-model="selectedStatus" aria-label="Filter by status">
          <option value="">All</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        <select v-model="selectedChannel" aria-label="Filter by channel">
          <option v-for="c in ['All', 'Telegram', 'WhatsApp', 'Web']">
            {{ c }}
          </option>
        </select>
      </div>
      <div v-if="filteredLeads.length" class="selection-bar">
        <label>
          <input
            type="checkbox"
            :checked="allVisibleSelected"
            @change="toggleAllVisible"
          />
          Select all visible
        </label>
        <strong>{{ selectedIds.length }} selected</strong>
      </div>
      <div
        v-if="selectedIds.length"
        class="bulk-actions"
        aria-label="Bulk lead actions"
      >
        <label>
          Status
          <select v-model="bulkStatus" :disabled="bulkLoading">
            <option value="">Choose status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted" disabled>
              Converted — edit individually
            </option>
            <option value="lost">Lost</option>
          </select>
        </label>
        <AppButton
          size="sm"
          :disabled="bulkLoading || !bulkStatus"
          :aria-busy="bulkLoading"
          @click="applyBulkStatus"
        >
          Apply status
        </AppButton>
        <label>
          Assignment
          <select v-model="bulkAssignment" :disabled="bulkLoading">
            <option value="">Choose assignment</option>
            <option value="auto">Auto-assign</option>
            <option v-if="store.agentId" :value="store.agentId">
              {{ store.agentName }} (current agent)
            </option>
          </select>
        </label>
        <AppButton
          size="sm"
          :disabled="bulkLoading || !bulkAssignment"
          :aria-busy="bulkLoading"
          @click="applyBulkAssignment"
        >
          Apply assignment
        </AppButton>
        <span v-if="bulkLoading" class="bulk-progress" role="status">
          Updating selected leads…
        </span>
      </div>
      <p
        v-if="bulkMessage"
        :class="['bulk-message', bulkMessage.type]"
        :role="bulkMessage.type === 'error' ? 'alert' : 'status'"
      >
        {{ bulkMessage.text }}
      </p>
      <div
        v-if="store.loadingLeads && filteredLeads.length === 0"
        class="card"
        role="status"
      >
        <div class="empty-state">
          <span class="empty-icon"><RefreshCw class="spin" :size="22" /></span>
          <h3>Loading your leads…</h3>
        </div>
      </div>
      <div v-else-if="store.leadListError" class="card" role="alert">
        <div class="empty-state">
          <span class="empty-icon error"><AlertCircle :size="22" /></span>
          <h3>We could not load your leads</h3>
          <p>{{ store.leadListError }}</p>
          <AppButton
            variant="outline"
            @click="store.refreshLeads({ status: selectedStatus || undefined })"
          >
            Try again
          </AppButton>
        </div>
      </div>
      <div v-else-if="filteredLeads.length === 0" class="card">
        <div class="empty-state">
          <span class="empty-icon"><Users :size="22" /></span>
          <h3>
            {{
              store.leads.length === 0
                ? 'No leads yet'
                : 'Nothing matches these filters'
            }}
          </h3>
          <p>
            {{
              store.leads.length === 0
                ? 'Leads appear here automatically as soon as a customer conversation looks promising.'
                : 'Try a different status or channel, or clear your search.'
            }}
          </p>
        </div>
      </div>
      <LeadTable
        v-else
        :leads="filteredLeads"
        :selected-ids="selectedIds"
        @toggle-selection="toggleSelection"
      />
    </div>
  </AppShell>
</template>
<style scoped>
.empty-icon.error {
  background: var(--danger-bg);
  color: var(--danger);
}
.toolbar {
  display: flex;
  gap: 9px;
  margin-bottom: 16px;
}
.toolbar label {
  max-width: 360px;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding-left: 12px;
  color: var(--muted);
  transition:
    border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.toolbar label:focus-within {
  border-color: var(--primary);
  box-shadow: var(--ring);
}
.toolbar label input {
  border: 0;
}
.toolbar label input:focus {
  box-shadow: none;
}
.toolbar select {
  width: 150px;
}
.selection-bar,
.bulk-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.selection-bar {
  justify-content: space-between;
  font-size: var(--fs-sm);
}
.selection-bar label,
.bulk-actions label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-2);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.selection-bar input[type='checkbox'] {
  width: 16px;
  height: 16px;
}
.bulk-actions {
  flex-wrap: wrap;
  background: var(--primary-soft);
  border-color: #dfe3ff;
}
.bulk-actions select {
  width: auto;
  min-width: 170px;
}
.bulk-message {
  padding: 11px 14px;
  border-radius: var(--radius);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.bulk-message.success {
  color: var(--success);
  background: var(--success-bg);
}
.bulk-message.error {
  color: var(--danger);
  background: var(--danger-bg);
}
.bulk-progress {
  color: var(--text-2);
  font-size: var(--fs-sm);
}
@media (max-width: 760px) {
  .bulk-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .bulk-actions label {
    align-items: stretch;
    flex-direction: column;
  }
}
@media (max-width: 600px) {
  .toolbar {
    flex-wrap: wrap;
  }
  .toolbar label {
    max-width: none;
    width: 100%;
    flex-basis: 100%;
  }
  .toolbar select {
    flex: 1;
  }
  .selection-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
