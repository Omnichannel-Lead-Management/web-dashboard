<script setup>
import { Bell, ExternalLink, ShieldAlert } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { notificationCenterEnabled } from '../../config'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

const router = useRouter()
</script>

<template>
  <section class="notification-settings">
    <div class="heading">
      <span><Bell :size="20" /></span>
      <div>
        <h2>Notification Centre</h2>
        <p>Review the dashboard notification capability.</p>
      </div>
      <AppBadge :tone="notificationCenterEnabled ? 'success' : 'neutral'">
        {{ notificationCenterEnabled ? 'Enabled' : 'Disabled' }}
      </AppBadge>
    </div>
    <div class="dependency" role="note">
      <ShieldAlert :size="18" />
      <p>
        <b>Gateway dependency.</b>
        Live notification listing and read actions require the business-scoped
        notification API.
      </p>
    </div>
    <p v-if="!notificationCenterEnabled" class="muted">
      Notification Centre is ready in the dashboard, but live notifications
      require the gateway notification API.
    </p>
    <AppButton variant="outline" @click="router.push('/notifications')">
      <ExternalLink :size="16" />
      Open Notification Centre
    </AppButton>
  </section>
</template>

<style scoped>
.notification-settings {
  display: grid;
  gap: 20px;
}
.heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.heading > span {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: var(--primary);
  background: var(--primary-soft);
}
.heading > div {
  flex: 1;
}
.heading h2,
.heading p,
.dependency p {
  margin: 0;
}
.heading p,
.muted {
  color: var(--muted);
  font-size: 12px;
}
.dependency {
  display: flex;
  gap: 10px;
  padding: 13px;
  color: #795b00;
  background: #fff8e3;
  border: 1px solid #f1e5bd;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1.5;
}
.dependency svg {
  flex: none;
}
</style>
