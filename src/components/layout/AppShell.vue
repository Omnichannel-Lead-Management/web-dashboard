<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './AppHeader.vue'
import SetupProgressBanner from '../onboarding/SetupProgressBanner.vue'

const route = useRoute()

/**
 * Most screens put their content on the grey page background, which separates
 * the white header on its own. Screens that run white to the top edge have to
 * earn that separation with a stronger rule instead.
 */
const flushContent = computed(() => route.path === '/inbox')
</script>
<template>
  <div class="shell" :class="{ 'shell--flush': flushContent }">
    <AppHeader />
    <SetupProgressBanner />
    <main><slot /></main>
  </div>
</template>
<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.shell--flush :deep(header) {
  border-bottom-color: var(--border-strong);
}
main {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
