<script setup>
import {
  CheckCircle2,
  Circle,
  CircleSlash2,
  LockKeyhole,
} from 'lucide-vue-next'
import AppBadge from '../common/AppBadge.vue'

defineProps({ rows: { type: Array, required: true } })

const tone = {
  Completed: 'success',
  Skipped: 'neutral',
  'Blocked by backend': 'warning',
  'Not completed': 'neutral',
}
</script>

<template>
  <section class="review" aria-labelledby="review-title">
    <article v-for="row in rows" :key="row.label">
      <CheckCircle2
        v-if="row.status === 'Completed'"
        :size="21"
        class="complete"
      />
      <CircleSlash2 v-else-if="row.status === 'Skipped'" :size="21" />
      <LockKeyhole
        v-else-if="row.status === 'Blocked by backend'"
        :size="21"
        class="blocked"
      />
      <Circle v-else :size="21" />
      <div>
        <b>{{ row.label }}</b>
        <small>{{ row.detail }}</small>
      </div>
      <AppBadge :tone="tone[row.status]">{{ row.status }}</AppBadge>
    </article>
    <p class="local-note">
      Finishing saves this progress on this browser only. The backend has no
      onboarding-completion field.
    </p>
  </section>
</template>

<style scoped>
.review {
  display: grid;
  gap: 10px;
}
article {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 13px 15px;
  color: var(--muted);
}
article div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text);
}
article small {
  color: var(--muted);
}
.complete {
  color: var(--success);
}
.blocked {
  color: #b25a12;
}
.local-note {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--text-2);
  font-size: 12px;
}
@media (max-width: 560px) {
  article {
    grid-template-columns: auto 1fr;
  }
  article .badge {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
