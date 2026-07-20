<script setup>
import { Clock, UserRound } from 'lucide-vue-next'

import AppBadge from '../common/AppBadge.vue'

defineProps({
  appointment: {
    type: Object,
    required: true,
  },
})
</script>
<template>
  <article>
    <time>
      <strong>{{ appointment.time }}</strong>
      <small>{{ appointment.ampm }}</small>
    </time>
    <div>
      <h3>{{ appointment.customer }}</h3>
      <p>{{ appointment.service }}</p>
    </div>
    <span>
      <Clock :size="14" />
      {{ appointment.duration }}
    </span>
    <span>
      <UserRound :size="14" />
      {{ appointment.staff }}
    </span>
    <AppBadge :tone="appointment.status">{{ appointment.status }}</AppBadge>
  </article>
</template>
<style scoped>
article {
  display: grid;
  grid-template-columns: 80px minmax(180px, 1fr) 100px 100px 100px;
  align-items: center;
  gap: 15px;
  padding: 16px 19px;
  background: #fff;
  border: 1px solid #eef0f5;
  border-radius: 13px;
}
time {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
time strong {
  font-size: 20px;
}
time small {
  font-size: 10px;
  color: var(--muted);
}
h3 {
  font-size: 13.5px;
  margin: 0 0 3px;
}
p {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
article > span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-2);
}
@media (max-width: 700px) {
  article {
    grid-template-columns: 65px 1fr auto;
  }
  article > span:not(:last-child) {
    display: none;
  }
}
</style>
