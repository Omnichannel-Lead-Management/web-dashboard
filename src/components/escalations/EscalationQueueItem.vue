<script setup>
import { computed } from 'vue'
import { Clock, MessageSquare } from 'lucide-vue-next'
import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'
import {
  getEscalationOwnership,
  getEscalationQueueAge,
} from '../../services/escalations'

const props = defineProps({
  item: { type: Object, required: true },
  agentId: { type: String, default: '' },
  now: { type: Number, required: true },
  connected: Boolean,
  claimPending: Boolean,
  releasePending: Boolean,
})
defineEmits(['claim', 'release', 'open'])

const ownership = computed(() =>
  getEscalationOwnership(props.item, props.agentId),
)

/** Show where the customer wrote from, not the identifier they wrote with. */
const channelLabel = computed(() => {
  const platform = String(props.item.platform || '').toLowerCase()
  if (platform === 'telegram') return 'Telegram'
  if (platform === 'whatsapp') return 'WhatsApp'
  if (platform === 'web') return 'Web chat'
  return platform ? platform.replace(/^./, (c) => c.toUpperCase()) : 'Chat'
})

const waitingLabel = computed(() =>
  getEscalationQueueAge(props.item.requestedAt, props.now),
)

/** Anything past 30 minutes should visibly ask for attention. */
const urgent = computed(() => {
  const started = props.item.requestedAt
    ? new Date(props.item.requestedAt).getTime()
    : NaN
  if (!Number.isFinite(started)) return false
  return props.now - started > 30 * 60 * 1000 && props.item.status === 'queued'
})
</script>

<template>
  <li class="queue-item" :class="{ urgent, claimed: item.status !== 'queued' }">
    <header>
      <AppAvatar
        :initials="item.avatarText"
        :channel="item.platform"
        :show-dot="false"
      />
      <div class="identity">
        <strong>{{ item.customerName }}</strong>
        <small>
          {{ channelLabel }}
          <template v-if="item.customerHandle">
            · {{ item.customerHandle }}
          </template>
        </small>
      </div>
      <AppBadge :tone="item.status === 'queued' ? 'warning' : 'success'">
        {{ item.status === 'queued' ? 'Waiting' : 'Claimed' }}
      </AppBadge>
    </header>

    <p v-if="item.latestMessage" class="latest">{{ item.latestMessage }}</p>

    <div class="details">
      <span v-if="item.tag" class="tag">{{ item.tag }}</span>
      <span class="waiting">
        <Clock :size="13" />
        {{ waitingLabel }}
      </span>
    </div>

    <p v-if="item.summary" class="summary">{{ item.summary }}</p>

    <p v-if="ownership === 'other'" class="ownership">
      Another team member is handling this conversation.
    </p>
    <p v-else-if="ownership === 'missing-agent'" class="ownership">
      Sign in again to claim conversations from the queue.
    </p>

    <footer>
      <AppButton size="sm" variant="outline" @click="$emit('open', item)">
        <MessageSquare :size="15" />
        Open in Inbox
      </AppButton>
      <AppButton
        v-if="ownership === 'queued'"
        size="sm"
        :disabled="!connected || claimPending || !agentId"
        :aria-busy="claimPending"
        :aria-label="`Claim conversation with ${item.customerName}`"
        @click="$emit('claim', item)"
      >
        {{ claimPending ? 'Claiming…' : 'Claim' }}
      </AppButton>
      <AppButton
        v-else-if="ownership === 'mine'"
        size="sm"
        variant="secondary"
        :disabled="!connected || claimPending || releasePending"
        :aria-busy="releasePending"
        :aria-label="`Return conversation with ${item.customerName} to the AI assistant`"
        @click="$emit('release', item)"
      >
        {{ releasePending ? 'Releasing…' : 'Return to AI assistant' }}
      </AppButton>
    </footer>
  </li>
</template>

<style scoped>
.queue-item {
  display: grid;
  gap: 11px;
  align-content: start;
  padding: 18px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  transition:
    box-shadow var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.queue-item:hover {
  box-shadow: var(--shadow-md);
}
.queue-item.urgent {
  border-left-color: var(--danger);
}
.queue-item.claimed {
  border-left-color: var(--success);
}

header {
  display: flex;
  align-items: center;
  gap: 11px;
}
.identity {
  display: grid;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.identity strong {
  font-size: var(--fs-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.identity small,
.details,
.ownership {
  color: var(--muted);
  font-size: var(--fs-xs);
}

.latest,
.summary,
.ownership {
  margin: 0;
  overflow-wrap: anywhere;
}
.latest {
  color: var(--text-2);
  font-size: var(--fs-sm);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.summary {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: var(--fs-sm);
  line-height: 1.55;
}

.details {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.details .waiting {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
}
.urgent .waiting {
  color: var(--danger);
}
.tag {
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: var(--warning-bg);
  color: var(--warning);
  font-weight: 700;
}

footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 3px;
}

@media (max-width: 600px) {
  footer :deep(.btn) {
    width: 100%;
  }
}
</style>
