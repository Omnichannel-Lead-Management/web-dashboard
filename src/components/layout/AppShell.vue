<script setup>
import AppHeader from './AppHeader.vue'
import SetupProgressBanner from '../onboarding/SetupProgressBanner.vue'
</script>
<template>
  <div class="shell">
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
main {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
