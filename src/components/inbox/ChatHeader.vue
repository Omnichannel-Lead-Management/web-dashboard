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
    />
    <div class="person">
      <strong>{{ conversation.name }}</strong>
      <span>
        <AppBadge :tone="conversation.channel">
          {{ conversation.channel }}
        </AppBadge>
        <AppBadge tone="neutral">{{ conversation.language }}</AppBadge>
      </span>
      <small class="mono">
        {{ conversation.handle }} ·
        <RouterLink :to="`/leads/${conversation.id}`">
          Lead #{{ conversation.id }}
        </RouterLink>
      </small>
    </div>
    <div class="actions">
      <AppBadge :tone="conversation.claimed ? 'success' : 'warning'">
        {{ conversation.claimed ? 'Claimed by you' : 'Queued for agent' }}
      </AppBadge>
      <AppButton v-if="!conversation.claimed" size="sm" @click="$emit('claim')">
        Claim chat
      </AppButton>
      <AppButton v-else size="sm" variant="secondary" @click="$emit('release')">
        Release
      </AppButton>
    </div>
  </header>
</template>
<style scoped>
header {
  padding: 12px 18px;
  border-bottom: 1px solid #eef0f5;
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 67px;
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
.person > strong {
  font-size: 14px;
}
.person > span {
  display: inline-flex;
  gap: 5px;
  margin-top: 3px;
}
.person small {
  font-size: 10px;
  color: var(--muted);
  margin-top: 3px;
}
.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 600px) {
  header {
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
