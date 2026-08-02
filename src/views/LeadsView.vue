<script setup>
import { ref, computed, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
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

async function finishBulk(ids, results, actionLabel, sessionVersion, requestBusinessId) {
  const summary = summarizeBulkLeadResults(ids, results)
  await store.refreshLeads({ status: selectedStatus.value || undefined })
  if (
    sessionVersion !== store.leadSessionVersion ||
    requestBusinessId !== store.businessId
  ) return
  selectedIds.value = summary.failedIds
  if (summary.failedIds.length === 0) {
    bulkMessage.value = { type: 'success', text: `${actionLabel} updated for ${summary.succeededIds.length} leads` }
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
  if (!selectedIds.value.length || !bulkStatus.value || bulkStatus.value === 'converted') return
  bulkLoading.value = true
  bulkMessage.value = null
  const sessionVersion = store.leadSessionVersion
  const requestBusinessId = store.businessId
  const ids = [...selectedIds.value]
  const results = await Promise.allSettled(
    ids.map((id) => store.updateLead(id, { status: bulkStatus.value }, { silent: true })),
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
            aria-label="Search leads"
            placeholder="Search leads, IDs or interests"
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
          <input type="checkbox" :checked="allVisibleSelected" @change="toggleAllVisible" />
          Select all visible
        </label>
        <strong>{{ selectedIds.length }} selected</strong>
      </div>
      <div v-if="selectedIds.length" class="bulk-actions" aria-label="Bulk lead actions">
        <label>
          Status
          <select v-model="bulkStatus" :disabled="bulkLoading">
            <option value="">Choose status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted" disabled>Converted — edit individually</option>
            <option value="lost">Lost</option>
          </select>
        </label>
        <button type="button" :disabled="bulkLoading || !bulkStatus" :aria-busy="bulkLoading" @click="applyBulkStatus">
          Apply status
        </button>
        <label>
          Assignment
          <select v-model="bulkAssignment" :disabled="bulkLoading">
            <option value="">Choose assignment</option>
            <option value="auto">Auto-assign</option>
            <option v-if="store.agentId" :value="store.agentId">{{ store.agentName }} (current agent)</option>
          </select>
        </label>
        <button type="button" :disabled="bulkLoading || !bulkAssignment" :aria-busy="bulkLoading" @click="applyBulkAssignment">
          Apply assignment
        </button>
        <span v-if="bulkLoading" class="bulk-progress" role="status">
          Updating selected leads…
        </span>
      </div>
      <p v-if="bulkMessage" :class="['bulk-message', bulkMessage.type]" :role="bulkMessage.type === 'error' ? 'alert' : 'status'">
        {{ bulkMessage.text }}
      </p>
      <p v-if="store.loadingLeads && filteredLeads.length === 0" class="muted" role="status">
        Loading leads…
      </p>
      <p v-else-if="store.leadListError" class="muted error" role="alert">
        {{ store.leadListError }}
      </p>
      <p v-else-if="store.leads.length === 0 && selectedStatus" class="muted">
        No leads match this status.
      </p>
      <p v-else-if="store.leads.length === 0" class="muted">
        No leads yet. They appear here as soon as the chatbot or routing
        qualifies one.
      </p>
      <p v-else-if="filteredLeads.length === 0" class="muted">
        No leads match the current search or channel filter.
      </p>
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
.muted {
  padding: 24px;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--border);
  border-radius: 12px;
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
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding-left: 12px;
  color: var(--muted);
}
.toolbar label input {
  border: 0;
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
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
}
.selection-bar {
  justify-content: space-between;
  font-size: 12px;
}
.selection-bar label,
.bulk-actions label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-2);
  font-size: 12px;
}
.bulk-actions {
  flex-wrap: wrap;
  background: var(--primary-soft);
}
.bulk-actions button {
  padding: 8px 11px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: var(--primary);
  font-weight: 700;
}
.bulk-actions button:disabled {
  opacity: 0.55;
}
.bulk-message {
  font-size: 12px;
}
.bulk-progress {
  color: var(--text-2);
  font-size: 12px;
}
.bulk-message.error,
.muted.error {
  color: var(--danger);
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
