<script setup>
const links = [
  ['/inbox', 'Inbox'],
  ['/leads', 'Leads'],
  ['/appointments', 'Appointments'],
  ['/analytics', 'Analytics'],
  ['/settings', 'Settings'],
]
</script>
<template>
  <nav aria-label="Main navigation">
    <RouterLink v-for="[to, label] in links" :key="to" :to="to">
      {{ label }}
    </RouterLink>
  </nav>
</template>
<style scoped>
nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
a {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 10px;
  color: var(--text-2);
  font-size: 15px;
  font-weight: 600;
}
a.router-link-active {
  color: var(--primary);
  background: var(--primary-soft);
}
@media (max-width: 760px) {
  nav {
    position: fixed;
    z-index: 30;
    bottom: 0;
    left: 0;
    right: 0;
    height: 72px;
    background: #fff;
    border-top: 1px solid var(--border);
    justify-content: space-around;
    padding: 6px 4px env(safe-area-inset-bottom);
  }
  a {
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
    padding: 7px 6px;
  }
  a.router-link-active {
    background: transparent;
  }
}
</style>
