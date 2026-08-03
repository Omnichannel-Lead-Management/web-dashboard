<script setup>
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'
import { getEscalationOwnership, getEscalationQueueAge } from '../../services/escalations'
import { computed } from 'vue'
const props = defineProps({ item: { type: Object, required: true }, agentId: { type: String, default: '' }, now: { type: Number, required: true }, connected: Boolean, claimPending: Boolean, releasePending: Boolean })
defineEmits(['claim', 'release', 'open'])
const ownership = computed(() => getEscalationOwnership(props.item, props.agentId))
</script>
<template>
  <li class="queue-item">
    <header><div><strong>{{ item.customerName }}</strong><small>{{ item.platform }} · {{ item.messengerId }}</small></div><AppBadge :tone="item.status === 'queued' ? 'warning' : 'success'">{{ item.status === 'queued' ? 'Queued' : 'Claimed' }}</AppBadge></header>
    <p v-if="item.latestMessage" class="latest">{{ item.latestMessage }}</p>
    <div class="details"><span v-if="item.tag" class="tag">{{ item.tag }}</span><span>{{ getEscalationQueueAge(item.requestedAt, now) }}</span></div>
    <p v-if="item.summary" class="summary">{{ item.summary }}</p>
    <p v-if="ownership === 'other'" class="ownership">Claimed by another agent<span v-if="item.claimedByAgentId"> · {{ item.claimedByAgentId }}</span></p>
    <p v-else-if="ownership === 'missing-agent'" class="ownership">Agent identity is required for queue actions.</p>
    <footer>
      <AppButton size="sm" variant="secondary" @click="$emit('open', item)">Open in Inbox</AppButton>
      <AppButton v-if="ownership === 'queued'" size="sm" :disabled="!connected || claimPending || !agentId" :aria-busy="claimPending" :aria-label="`Claim conversation with ${item.customerName}`" @click="$emit('claim', item)">{{ claimPending ? 'Claiming…' : 'Claim' }}</AppButton>
      <AppButton v-else-if="ownership === 'mine'" size="sm" variant="secondary" :disabled="!connected || claimPending || releasePending" :aria-busy="releasePending" :aria-label="`Release conversation with ${item.customerName} back to queue`" @click="$emit('release', item)">{{ releasePending ? 'Releasing…' : 'Release back to queue' }}</AppButton>
    </footer>
  </li>
</template>
<style scoped>
.queue-item{display:grid;gap:11px;padding:18px;border:1px solid var(--border);border-left:4px solid var(--warning);border-radius:14px;background:#fff}.queue-item header,.queue-item footer,.details{display:flex;align-items:center;gap:10px}.queue-item header>div{display:grid;gap:3px;flex:1}.queue-item small,.details,.ownership{color:var(--muted);font-size:11px}.latest,.summary,.ownership{margin:0;overflow-wrap:anywhere}.summary{padding:10px;border-radius:9px;background:var(--surface-2,#f7f7fa);font-size:12px}.tag{padding:3px 8px;border-radius:999px;background:#fff3d6;color:#795b00}.queue-item footer{justify-content:flex-end;flex-wrap:wrap}@media(max-width:600px){.queue-item footer :deep(.btn){width:100%}}
</style>
