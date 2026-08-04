<script setup>
import { Bell, ExternalLink } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { notificationCenterEnabled } from '../../config'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

const router = useRouter()
</script>

<template>
  <section class="notification-settings">
    <header class="section-head">
      <span class="section-icon"><Bell :size="22" /></span>
      <div>
        <h2>Notifications</h2>
        <p>Updates you should not miss, collected in one place.</p>
      </div>
      <AppBadge :tone="notificationCenterEnabled ? 'success' : 'neutral'">
        {{ notificationCenterEnabled ? 'Active' : 'Off' }}
      </AppBadge>
    </header>

    <p class="lead">
      New leads, conversations that need a person, and appointment changes are
      collected here so nothing slips past while you are busy.
    </p>

    <p v-if="!notificationCenterEnabled" class="notice">
      Notifications are switched off for this workspace. Contact your
      administrator to turn them on.
    </p>

    <AppButton
      variant="outline"
      class="cta"
      @click="router.push('/notifications')"
    >
      <ExternalLink :size="16" />
      Open notifications
    </AppButton>
  </section>
</template>

<style scoped>
.notification-settings {
  display: grid;
  gap: 20px;
}
.lead {
  margin: 0;
  color: var(--text-2);
  font-size: var(--fs-base);
  line-height: 1.65;
  max-width: 60ch;
}
.cta {
  justify-self: start;
}
</style>
