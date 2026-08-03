<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowRight, X } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../common/AppButton.vue'
import { useAppStore } from '../../stores/app'

const dismissedBusinesses = new Set()
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const dismissed = ref(false)

watch(
  () => store.businessId,
  (businessId) => {
    dismissed.value = dismissedBusinesses.has(businessId)
  },
  { immediate: true },
)

const visible = computed(
  () =>
    store.authenticated &&
    Boolean(store.businessId) &&
    store.onboardingLoaded &&
    !store.onboardingProgress.locallyFinished &&
    route.path !== '/onboarding' &&
    !dismissed.value,
)
const completedCount = computed(
  () => store.onboardingProgress.completedSteps.length,
)

function dismiss() {
  dismissedBusinesses.add(store.businessId)
  dismissed.value = true
}
</script>

<template>
  <aside
    v-if="visible"
    class="setup-banner"
    aria-label="Workspace setup progress"
  >
    <div>
      <b>Finish setting up your workspace</b>
      <span>{{ completedCount }} of 6 steps completed</span>
    </div>
    <AppButton size="sm" variant="outline" @click="router.push('/onboarding')">
      Continue setup
      <ArrowRight :size="14" />
    </AppButton>
    <button
      type="button"
      class="dismiss"
      aria-label="Dismiss setup reminder for this browser session"
      @click="dismiss"
    >
      <X :size="17" />
    </button>
  </aside>
</template>

<style scoped>
.setup-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  background: var(--primary-soft);
  border-bottom: 1px solid #dfe3ff;
}
.setup-banner > div {
  display: flex;
  flex: 1;
  gap: 8px;
  align-items: baseline;
}
.setup-banner b {
  font-size: 13px;
}
.setup-banner span {
  color: var(--muted);
  font-size: 11px;
}
.dismiss {
  border: 0;
  background: transparent;
  color: var(--muted);
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 8px;
}
@media (max-width: 620px) {
  .setup-banner {
    flex-wrap: wrap;
  }
  .setup-banner > div {
    flex-direction: column;
  }
  .setup-banner > .btn {
    order: 3;
    width: 100%;
  }
}
</style>
