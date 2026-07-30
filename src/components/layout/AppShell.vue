<script setup>
import AppHeader from './AppHeader.vue'
</script>
<template>
  <div class="shell">
    <AppHeader />
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
