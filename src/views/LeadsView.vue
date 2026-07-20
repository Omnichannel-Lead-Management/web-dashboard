<script setup>
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import LeadTable from '../components/leads/LeadTable.vue'
import { useAppStore } from '../stores/app'
const store = useAppStore()
const searchText = ref('')
const selectedStatus = ref('All')
const selectedChannel = ref('All')

const filteredLeads = computed(() => {
  const normalizedSearch = searchText.value.toLowerCase()

  return store.leads.filter((lead) => {
    const searchableText =
      `${lead.name} ${lead.id} ${lead.interest}`.toLowerCase()
    const matchesSearch =
      !normalizedSearch || searchableText.includes(normalizedSearch)
    const matchesStatus =
      selectedStatus.value === 'All' ||
      lead.status === selectedStatus.value.toLowerCase()
    const matchesChannel =
      selectedChannel.value === 'All' || lead.channel === selectedChannel.value

    return matchesSearch && matchesStatus && matchesChannel
  })
})
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
          <option
            v-for="s in [
              'All',
              'New',
              'Contacted',
              'Qualified',
              'Converted',
              'Lost',
            ]"
          >
            {{ s }}
          </option>
        </select>
        <select v-model="selectedChannel" aria-label="Filter by channel">
          <option v-for="c in ['All', 'Telegram', 'WhatsApp', 'Web']">
            {{ c }}
          </option>
        </select>
      </div>
      <LeadTable :leads="filteredLeads" />
    </div>
  </AppShell>
</template>
<style scoped>
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
}
</style>
