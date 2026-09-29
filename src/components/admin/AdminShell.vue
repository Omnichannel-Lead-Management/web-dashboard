<script setup>
import AdminHeader from './AdminHeader.vue'
import AdminToast from './AdminToast.vue'
</script>
<template>
  <div class="shell">
    <AdminHeader />
    <main><slot /></main>
    <AdminToast />
  </div>
</template>
<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
main {
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>
