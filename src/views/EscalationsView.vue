<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Inbox, RefreshCw } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import AppButton from '../components/common/AppButton.vue'
import EscalationQueueFilters from '../components/escalations/EscalationQueueFilters.vue'
import EscalationQueueList from '../components/escalations/EscalationQueueList.vue'
import { filterEscalations, sortEscalations } from '../services/escalations'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const router = useRouter()

const search = ref('')
const filter = ref('all')
const sort = ref('default')
const now = ref(Date.now())
let clock

const items = computed(() =>
  sortEscalations(
    filterEscalations(store.escalations, {
      filter: filter.value,
      search: search.value,
      agentId: store.agentId,
    }),
    sort.value,
  ),
)
const queuedCount = computed(
  () => store.escalations.filter((item) => item.status === 'queued').length,
)
const claimedCount = computed(
  () => store.escalations.filter((item) => item.status === 'claimed').length,
)
const connected = computed(() => store.connectionStatus === 'online')

const stats = computed(() => [
  { label: 'In queue', value: store.escalations.length },
  { label: 'Waiting', value: queuedCount.value, tone: 'warning' },
  { label: 'Being handled', value: claimedCount.value, tone: 'success' },
])

const lastUpdatedLabel = computed(() =>
  store.escalationsLastUpdatedAt
    ? new Date(store.escalationsLastUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)

function openInbox(item) {
  if (!item || item.businessId !== store.businessId) return
  store.selectedConversationId = item.conversationId
  router.push({ path: '/inbox', query: { conversation: item.conversationId } })
}

function refresh() {
  store.refreshEscalations().catch(() => {})
}

function claim(item) {
  store.claimEscalation(item.id)
}

function release(item) {
  if (
    window.confirm(
      `Release ${item.customerName}'s conversation back to the queue?`,
    )
  ) {
    store.releaseEscalation(item.id)
  }
}

onMounted(() => {
  if (store.escalationQueueAvailable) refresh()
  clock = setInterval(() => {
    now.value = Date.now()
  }, 60000)
})
onUnmounted(() => clearInterval(clock))
</script>

<template>
  <AppShell>
    <main class="page">
      <header class="page-head">
        <div>
          <h1>Escalation queue</h1>
          <p>Conversations waiting for someone on your team.</p>
        </div>
        <template v-if="store.escalationQueueAvailable">
          <span
            class="live-dot"
            :class="{ offline: !connected }"
            :title="connected ? 'Updating live' : 'Reconnecting'"
          >
            <i />
            {{ connected ? 'Live' : 'Reconnecting' }}
          </span>
          <AppButton
            :disabled="store.escalationsRefreshing"
            variant="outline"
            @click="refresh"
          >
            <RefreshCw
              :size="15"
              :class="{ spin: store.escalationsRefreshing }"
            />
            {{ store.escalationsRefreshing ? 'Refreshing…' : 'Refresh' }}
          </AppButton>
        </template>
      </header>

      <section
        v-if="!store.escalationQueueAvailable"
        class="card unavailable"
        role="status"
      >
        <div class="empty-state">
          <span class="empty-icon"><Inbox :size="24" /></span>
          <h3>The escalation queue is turned off</h3>
          <p>
            Customer conversations still arrive in your Inbox. Contact your
            administrator to turn the queue on for your team.
          </p>
          <RouterLink to="/inbox">
            <AppButton variant="outline">Back to Inbox</AppButton>
          </RouterLink>
        </div>
      </section>

      <template v-else>
        <div class="counts">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="stat"
            :class="stat.tone"
          >
            <b>{{ stat.value }}</b>
            <span>{{ stat.label }}</span>
          </div>
        </div>

        <EscalationQueueFilters
          v-model:search="search"
          v-model:filter="filter"
          v-model:sort="sort"
        />

        <p
          v-if="store.escalationsError"
          class="notice notice--danger"
          role="alert"
        >
          {{ store.escalationsError }}
        </p>

        <div v-if="store.escalationsLoading" class="loading" role="status">
          <RefreshCw class="spin" :size="18" />
          Loading the queue…
        </div>

        <EscalationQueueList
          v-else-if="items.length"
          :items="items"
          :agent-id="store.agentId"
          :now="now"
          :connected="connected"
          :claim-pending-ids="store.escalationClaimPendingIds"
          :release-pending-ids="store.escalationReleasePendingIds"
          @claim="claim"
          @release="release"
          @open="openInbox"
        />

        <div v-else class="card">
          <div class="empty-state">
            <span class="empty-icon"><Inbox :size="24" /></span>
            <h3>
              {{
                store.escalations.length
                  ? 'Nothing matches this view'
                  : 'Nobody is waiting'
              }}
            </h3>
            <p>
              {{
                store.escalations.length
                  ? 'Try a different filter or clear your search.'
                  : 'Every conversation is being handled automatically right now.'
              }}
            </p>
          </div>
        </div>

        <p v-if="lastUpdatedLabel" class="updated">
          Last updated {{ lastUpdatedLabel }}
        </p>
      </template>
    </main>
  </AppShell>
</template>

<style scoped>
.page {
  display: grid;
  gap: 18px;
  align-content: start;
  padding: 28px;
  max-width: 1300px;
  width: 100%;
  margin: 0 auto;
}
.page-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-head > div {
  flex: 1;
  min-width: 0;
}
.page-head h1 {
  font-size: var(--fs-2xl);
  margin: 0 0 4px;
}
.page-head p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.live-dot {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 11px;
  border-radius: var(--radius-pill);
  background: var(--success-bg);
  color: var(--success);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.live-dot i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #17b877;
  animation: pulse 2s infinite;
}
.live-dot.offline {
  background: var(--surface-3);
  color: var(--muted);
}
.live-dot.offline i {
  background: var(--muted);
  animation: none;
}

.counts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.stat {
  display: grid;
  gap: 2px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
}
.stat b {
  font-size: 26px;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.stat span {
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.stat.warning b {
  color: var(--warning);
}
.stat.success b {
  color: var(--success);
}

.unavailable {
  padding: 8px;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px;
  color: var(--muted);
  font-size: var(--fs-base);
}
.updated {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-xs);
}

@media (max-width: 600px) {
  .page {
    padding: 16px;
  }
  .page-head {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
