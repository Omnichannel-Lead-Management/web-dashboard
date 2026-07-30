<script setup>
import { ArrowLeft } from 'lucide-vue-next'

import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

defineProps({
  conversation: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['claim', 'release', 'back'])
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
      <small class="mono">
        {{ conversation.handle }} ·
        <RouterLink :to="`/leads/${conversation.id}`">
          Lead #{{ conversation.id }}
        </RouterLink>
      </small>
    </div>
    <div class="actions">
      <AppBadge
        v-if="
          conversation.id && (conversation.escalated || conversation.claimed)
        "
        :tone="conversation.claimed ? 'success' : 'warning'"
      >
        {{ conversation.claimed ? 'Claimed by you' : 'Queued for agent' }}
      </AppBadge>
      <AppButton
        v-if="conversation.id && !conversation.claimed"
        class="claim"
        @click="$emit('claim')"
      >
        Claim chat
      </AppButton>
      <AppButton
        v-else-if="conversation.id"
        size="sm"
        variant="secondary"
        @click="$emit('release')"
      >
        Release
      </AppButton>
    </div>
  </header>
</template>
<style scoped>
header {
  height: 84px;
  padding: 13px 26px;
  border-bottom: 1px solid #eef0f5;
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
