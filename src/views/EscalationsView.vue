<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import AppBadge from '../components/common/AppBadge.vue'
import AppButton from '../components/common/AppButton.vue'
import EscalationQueueFilters from '../components/escalations/EscalationQueueFilters.vue'
import EscalationQueueList from '../components/escalations/EscalationQueueList.vue'
import { filterEscalations, sortEscalations } from '../services/escalations'
import { useAppStore } from '../stores/app'
const store = useAppStore(); const router = useRouter(); const search = ref(''); const filter = ref('all'); const sort = ref('default'); const now = ref(Date.now()); let clock
const items = computed(() => sortEscalations(filterEscalations(store.escalations, { filter: filter.value, search: search.value, agentId: store.agentId }), sort.value))
const queuedCount = computed(() => store.escalations.filter((item) => item.status === 'queued').length)
const claimedCount = computed(() => store.escalations.filter((item) => item.status === 'claimed').length)
const connected = computed(() => store.connectionStatus === 'online')
function openInbox(item){ if (!item || item.businessId !== store.businessId) return; store.selectedConversationId = item.conversationId; router.push({ path:'/inbox', query:{ conversation:item.conversationId } }) }
function refresh(){ store.refreshEscalations().catch(() => {}) }
function claim(item){ store.claimEscalation(item.id) }
function release(item){ if (window.confirm(`Release ${item.customerName}'s conversation back to the queue?`)) store.releaseEscalation(item.id) }
onMounted(()=>{ if(store.escalationQueueAvailable) refresh(); clock=setInterval(()=>{now.value=Date.now()},60000) }); onUnmounted(()=>clearInterval(clock))
</script>
<template><AppShell><main class="page"><header class="page-head"><div><h1>Agent escalation queue</h1><p>Conversations waiting for human support.</p></div><template v-if="store.escalationQueueAvailable"><AppBadge tone="warning">Prototype mode</AppBadge><AppButton :disabled="store.escalationsRefreshing" variant="secondary" @click="refresh">Refresh</AppButton></template></header>
<section v-if="!store.escalationQueueAvailable" class="notice" role="status"><p>The escalation queue is ready in the dashboard, but live use requires secure agent authentication and tenant authorization.</p><RouterLink to="/inbox">Back to Inbox</RouterLink></section>
<template v-else>
<section class="notice" role="note">This queue currently relies on prototype agent identity supplied by the dashboard. Production use requires gateway-issued agent authentication and tenant membership checks.</section>
<div class="counts"><span><b>{{ store.escalations.length }}</b> Total</span><span><b>{{ queuedCount }}</b> Queued</span><span><b>{{ claimedCount }}</b> Claimed</span><span>Connection: {{ store.connectionStatus }}</span></div>
<EscalationQueueFilters v-model:search="search" v-model:filter="filter" v-model:sort="sort" />
<p v-if="store.escalationsError" class="error" role="alert">{{ store.escalationsError }}</p><p v-if="store.escalationsLoading" role="status">Loading escalation queue…</p>
<EscalationQueueList v-else-if="items.length" :items="items" :agent-id="store.agentId" :now="now" :connected="connected" :claim-pending-ids="store.escalationClaimPendingIds" :release-pending-ids="store.escalationReleasePendingIds" @claim="claim" @release="release" @open="openInbox" />
<div v-else class="empty">No escalations match this view.</div><small v-if="store.escalationsLastUpdatedAt">Last updated {{ new Date(store.escalationsLastUpdatedAt).toLocaleTimeString() }}</small>
</template>
</main></AppShell></template>
<style scoped>.page{display:grid;gap:18px;padding:28px;max-width:1300px;margin:0 auto}.page-head{display:flex;align-items:center;gap:12px}.page-head>div{flex:1}.page-head h1,.page-head p{margin:0}.page-head p{color:var(--muted)}.notice,.error,.empty{padding:14px;border:1px solid var(--border);border-radius:12px;background:#fff8e3}.error{color:var(--danger);background:var(--danger-bg)}.counts{display:flex;gap:10px;flex-wrap:wrap}.counts span{padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;font-size:12px}.counts b{font-size:16px;margin-right:4px}@media(max-width:600px){.page{padding:16px}.page-head{align-items:flex-start;flex-wrap:wrap}}
</style>
