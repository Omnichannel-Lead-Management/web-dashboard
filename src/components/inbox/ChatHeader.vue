<script setup>
import { computed } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'

import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'
import { shortReference } from '../../services/displayText'

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  agentId: { type: String, default: '' },
  escalationEnabled: { type: Boolean, default: false },
  connected: { type: Boolean, default: false },
  claimPending: { type: Boolean, default: false },
  releasePending: { type: Boolean, default: false },
})

defineEmits(['claim', 'release', 'back'])

const showEscalationControls = computed(
  () => props.escalationEnabled && Boolean(props.conversation.id),
)

/**
 * Only an escalated, unclaimed chat can be claimed. The bot owns everything
 * else, so offering a button there would do nothing when pressed.
 */
const canClaim = computed(
  () =>
    showEscalationControls.value &&
    props.conversation.escalated &&
    !props.conversation.claimed &&
    !props.conversation.claimedByOther,
)

const canRelease = computed(
  () => showEscalationControls.value && props.conversation.claimed,
)

const claimDisabled = computed(
  () => !props.connected || !props.agentId || props.claimPending,
)

const claimHint = computed(() => {
  if (!props.agentId) return 'Sign in again to claim conversations'
  if (!props.connected) return 'Reconnecting to the gateway…'
  return `Take over the chat with ${props.conversation.name} from the AI assistant`
})
</script>
<template>
  <header>
    <button
      class="back mobile-only"
      aria-label="Back to conversations"
      @click="$emit('back')"
    >
      <ArrowLeft :size="20" />
    </button>
    <AppAvatar
      :initials="conversation.initials"
      :channel="conversation.channel"
      :show-dot="false"
    />
    <div class="person">
      <span class="identity">
        <strong>{{ conversation.name }}</strong>
        <AppBadge :tone="conversation.channel">
          {{ conversation.channel }}
        </AppBadge>
        <AppBadge v-if="conversation.language" tone="neutral">
          {{ conversation.language }}
        </AppBadge>
      </span>
      <small>
        {{ conversation.handle }} ·
        <RouterLink :to="`/leads/${conversation.id}`">
          View lead
          <span class="mono">{{ shortReference(conversation.id) }}</span>
        </RouterLink>
      </small>
    </div>
    <div class="actions">
      <AppBadge
        v-if="
          showEscalationControls &&
          (conversation.escalated || conversation.claimed)
        "
        :tone="conversation.claimed ? 'success' : 'warning'"
      >
        {{
          conversation.claimed
            ? 'Claimed by you'
            : conversation.claimedByOther
              ? 'Claimed by another agent'
              : 'Queued for agent'
        }}
      </AppBadge>
      <AppButton
        v-if="canClaim"
        class="claim"
        :disabled="claimDisabled"
        :aria-busy="claimPending"
        :title="claimHint"
        @click="$emit('claim')"
      >
        {{ claimPending ? 'Claiming…' : 'Claim chat' }}
      </AppButton>
      <AppButton
        v-else-if="canRelease"
        size="sm"
        variant="secondary"
        :disabled="!connected || releasePending"
        :aria-busy="releasePending"
        title="Hand this chat back to the AI assistant"
        @click="$emit('release')"
      >
        {{ releasePending ? 'Releasing…' : 'Return to AI assistant' }}
      </AppButton>
    </div>
  </header>
</template>
<style scoped>
header {
  height: 84px;
  padding: 13px 26px;
  border-bottom: 1px solid var(--border-strong);
  display: flex;
  align-items: center;
  gap: 11px;
  flex: none;
}
.back {
  border: 0;
  background: none;
  padding: 4px;
}
.person {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.identity {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.identity strong {
  margin-right: 2px;
  font-size: 15px;
}
.person small {
  font-size: 11px;
  color: var(--muted);
  margin-top: 3px;
}
.claim :deep(.btn) {
  min-width: 130px;
  min-height: 44px;
}
.actions :deep(.btn--primary) {
  min-width: 130px;
  min-height: 44px;
}
.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 600px) {
  header {
    height: 72px;
    padding: 10px;
  }
  .actions :deep(.badge) {
    display: none;
  }
  .person small {
    max-width: 145px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
