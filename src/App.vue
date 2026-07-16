<script setup lang="ts">
const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:3000";
</script>

<template>
  <main class="app">
    <h1>Omnichannel Lead Management</h1>
    <p>Agent dashboard — scaffold ready.</p>
    <p class="meta">Gateway: {{ gatewayUrl }}</p>
  </main>
</template>

<style scoped>
.app {
  font-family: system-ui, sans-serif;
  max-width: 720px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.meta {
  color: #666;
  font-size: 0.9rem;
}
</style>
