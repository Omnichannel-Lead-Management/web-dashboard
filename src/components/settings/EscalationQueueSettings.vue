<script setup>
import { Users, ArrowRight } from 'lucide-vue-next'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'
import { agentEscalationQueueEnabled } from '../../config'

const capabilities = [
  {
    title: 'Hand off to a person',
    detail:
      'When the chatbot cannot help, the conversation moves to a shared queue your team can pick up.',
  },
  {
    title: 'One owner per conversation',
    detail:
      'Claiming a chat assigns it to that team member so two people never reply to the same customer.',
  },
  {
    title: 'Give it back at any time',
    detail:
      'Releasing a chat returns it to the queue for whoever is free next.',
  },
]
</script>

<template>
  <section class="escalation-settings">
    <header class="section-head">
      <span class="section-icon"><Users :size="22" /></span>
      <div>
        <h2>Escalation queue</h2>
        <p>How conversations reach a person on your team.</p>
      </div>
      <AppBadge :tone="agentEscalationQueueEnabled ? 'success' : 'neutral'">
        {{ agentEscalationQueueEnabled ? 'Active' : 'Off' }}
      </AppBadge>
    </header>

    <ul class="capabilities">
      <li v-for="item in capabilities" :key="item.title">
        <b>{{ item.title }}</b>
        <span>{{ item.detail }}</span>
      </li>
    </ul>

    <p v-if="!agentEscalationQueueEnabled" class="notice">
      The escalation queue is switched off for this workspace. Contact your
      administrator to turn it on.
    </p>

    <RouterLink v-else to="/escalations" class="cta">
      <AppButton>
        Open escalation queue
        <ArrowRight :size="16" />
      </AppButton>
    </RouterLink>
  </section>
</template>

<style scoped>
.escalation-settings {
  display: grid;
  gap: 20px;
}
.capabilities {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.capabilities li {
  display: grid;
  gap: 3px;
  padding: 14px 16px;
  background: var(--surface);
}
.capabilities li + li {
  border-top: 1px solid var(--border-soft);
}
.capabilities b {
  font-size: var(--fs-base);
}
.capabilities span {
  color: var(--muted);
  font-size: var(--fs-sm);
  line-height: 1.55;
}
.cta {
  justify-self: start;
}
</style>
