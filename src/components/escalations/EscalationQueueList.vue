<script setup>
import EscalationQueueItem from './EscalationQueueItem.vue'
defineProps({ items: { type: Array, default: () => [] }, agentId: { type: String, default: '' }, now: { type: Number, required: true }, connected: Boolean, claimPendingIds: { type: Array, default: () => [] }, releasePendingIds: { type: Array, default: () => [] } })
defineEmits(['claim', 'release', 'open'])
</script>
<template><ul class="queue-list"><EscalationQueueItem v-for="item in items" :key="item.id" :item="item" :agent-id="agentId" :now="now" :connected="connected" :claim-pending="claimPendingIds.includes(item.id)" :release-pending="releasePendingIds.includes(item.id)" @claim="$emit('claim',$event)" @release="$emit('release',$event)" @open="$emit('open',$event)" /></ul></template>
<style scoped>.queue-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0;margin:0;list-style:none}@media(max-width:850px){.queue-list{grid-template-columns:1fr}}</style>
