<script setup>
import {
  getEscalationOwnership,
  getEscalationQueueAge,
} from '../../services/escalations'
import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  agentId: { type: String, default: '' },
  connected: { type: Boolean, default: false },
  claimPendingIds: { type: Array, default: () => [] },
  releasePendingIds: { type: Array, default: () => [] },
})
defineEmits(['open', 'claim', 'release'])

/**
 * Reuse the queue's ownership rules so the inbox and the escalations page can
 * never disagree about who is allowed to act on a chat.
 */
function ownershipOf(conversation) {
  return getEscalationOwnership(
    {
      status: conversation.claimedByAgentId ? 'claimed' : 'queued',
      claimedByAgentId: conversation.claimedByAgentId || '',
    },
    props.agentId,
  )
}

const isClaiming = (id) => props.claimPendingIds.includes(id)
const isReleasing = (id) => props.releasePendingIds.includes(id)
</script>

<template>
  <section class="triage">
    <h2>
      ⚡ Escalation queue · {{ conversations.length }}
      <RouterLink to="/escalations">View full queue</RouterLink>
    </h2>
    <article
      v-for="conversation in conversations"
      :key="conversation.id"
      class="row"
      :class="{ mine: ownershipOf(conversation) === 'mine' }"
    >
      <button class="open" @click="$emit('open', conversation.id)">
        <AppAvatar
          :initials="conversation.initials"
          :channel="conversation.channel"
          :show-dot="false"
        />
        <span class="copy">
          <span class="top">
            <strong>{{ conversation.name }}</strong>
            <time class="mono">{{ conversation.time }}</time>
          </span>
          <span class="preview">{{ conversation.preview }}</span>
          <span
            v-if="conversation.escalationTag || conversation.escalationSummary"
            class="reason"
          >
            {{ conversation.escalationTag || conversation.escalationSummary }}
          </span>
          <span class="meta">
            <i
              class="channel-dot"
              :class="conversation.channel.toLowerCase()"
            />
            <AppBadge
              v-if="conversation.escalationRequestedAt"
              :tone="
                ownershipOf(conversation) === 'queued' ? 'warning' : 'success'
              "
            >
              {{
                ownershipOf(conversation) === 'queued'
                  ? getEscalationQueueAge(conversation.escalationRequestedAt)
                  : ownershipOf(conversation) === 'mine'
                    ? 'Claimed by you'
                    : 'Claimed by another agent'
              }}
            </AppBadge>
          </span>
        </span>
      </button>

      <footer class="actions">
        <AppButton
          v-if="ownershipOf(conversation) === 'queued'"
          size="sm"
          :disabled="!connected || !agentId || isClaiming(conversation.id)"
          :aria-busy="isClaiming(conversation.id)"
          :aria-label="`Claim the conversation with ${conversation.name}`"
          @click="$emit('claim', conversation.id)"
        >
          {{ isClaiming(conversation.id) ? 'Claiming…' : 'Claim' }}
        </AppButton>
        <AppButton
          v-else-if="ownershipOf(conversation) === 'mine'"
          size="sm"
          variant="secondary"
          :disabled="!connected || isReleasing(conversation.id)"
          :aria-busy="isReleasing(conversation.id)"
          :aria-label="`Return the conversation with ${conversation.name} to the AI assistant`"
          @click="$emit('release', conversation.id)"
        >
          {{ isReleasing(conversation.id) ? 'Releasing…' : 'Return to AI' }}
        </AppButton>
        <span v-else-if="ownershipOf(conversation) === 'other'" class="held">
          Handled by another agent
        </span>
        <span v-else class="held">Sign in again to claim</span>
      </footer>
    </article>
  </section>
</template>

<style scoped>
.triage h2 {
  margin: 5px 20px 10px;
  color: var(--danger);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}
.triage h2 a {
  float: right;
  color: var(--primary);
  text-transform: none;
  letter-spacing: 0;
}
.reason {
  display: block;
  margin-top: 4px;
  color: var(--danger);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row {
  width: calc(100% - 26px);
  margin: 0 13px 8px;
  background: #fff;
  border: 1px solid #f6cdbb;
  border-left: 4px solid var(--danger);
  border-radius: 13px;
  overflow: hidden;
}
.row.mine {
  border-color: var(--border);
  border-left-color: var(--success);
}
.row .open {
  width: 100%;
  padding: 14px 16px 10px;
  display: flex;
  gap: 12px;
  text-align: left;
  background: transparent;
  border: 0;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 16px 12px;
}
.held {
  color: var(--muted);
  font-size: 11px;
}
.copy {
  flex: 1;
  min-width: 0;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.top strong {
  font-size: 14px;
}
.top time {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}
.preview {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--text-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 7px;
}
.channel-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--web);
}
.channel-dot.telegram {
  background: var(--telegram);
}
.channel-dot.whatsapp {
  background: var(--whatsapp);
}
</style>
