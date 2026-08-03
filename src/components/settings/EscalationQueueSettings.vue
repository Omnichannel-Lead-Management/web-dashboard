<script setup>
import { Users } from 'lucide-vue-next'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'
import { agentEscalationQueueEnabled } from '../../config'
</script>
<template><section class="settings"><header><Users :size="22"/><div><h2>Agent escalation queue</h2><p>Human handoff queue and conversation ownership.</p></div><AppBadge :tone="agentEscalationQueueEnabled?'warning':'neutral'">{{ agentEscalationQueueEnabled?'Prototype mode':'Disabled' }}</AppBadge></header><div class="notice" role="note">Production use requires gateway-issued agent authentication and tenant membership checks.</div><dl><div><dt>Agent channel</dt><dd>WS /ws/agents</dd></div><div><dt>Queue</dt><dd>GET /api/agents/queue and queue_snapshot</dd></div><div><dt>Actions</dt><dd>Claim and release supported</dd></div><div><dt>Not supported</dt><dd>Explicit resolve lifecycle, priority model, SLA policy</dd></div></dl><RouterLink to="/escalations"><AppButton>Open escalation queue</AppButton></RouterLink></section></template>
<style scoped>.settings{display:grid;gap:20px}.settings header,.settings dl div{display:flex;align-items:center;gap:12px}.settings header div{flex:1}.settings h2,.settings p{margin:0}.settings p,dd{color:var(--muted)}.notice{padding:13px;border:1px solid #f1e5bd;border-radius:11px;background:#fff8e3;font-size:12px}.settings dl{display:grid;gap:10px;margin:0}.settings dl div{justify-content:space-between;padding-bottom:9px;border-bottom:1px solid var(--border)}dt{font-weight:700}dd{margin:0;text-align:right;font-size:12px}</style>
