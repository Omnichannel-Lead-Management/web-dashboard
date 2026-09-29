<script setup>
import { computed } from 'vue'
import {
  LayoutDashboard,
  Building2,
  ReceiptText,
  Tags,
  ShieldCheck,
} from 'lucide-vue-next'
import { useAdminStore } from '../../stores/admin'

const store = useAdminStore()

const links = computed(() =>
  [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/admin/businesses', label: 'Businesses', icon: Building2 },
    { to: '/admin/invoices', label: 'Invoices', icon: ReceiptText },
    { to: '/admin/pricing', label: 'Pricing', icon: Tags },
    {
      to: '/admin/team',
      label: 'Team',
      icon: ShieldCheck,
      show: store.isOwner,
    },
  ].filter((link) => link.show !== false),
)
</script>
<template>
  <nav aria-label="Admin navigation">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :class="{
        'router-link-active': link.exact
          ? $route.path === link.to
          : $route.path.startsWith(link.to),
      }"
    >
      <component :is="link.icon" :size="17" />
      <span>{{ link.label }}</span>
    </RouterLink>
  </nav>
</template>
<style scoped>
nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
a {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border-radius: 10px;
  color: var(--text-2);
  font-size: 14.5px;
  font-weight: 600;
  transition:
    background var(--dur) var(--ease),
    color var(--dur) var(--ease);
}
a:hover {
  color: var(--text);
  background: var(--surface-2);
}
a.router-link-active,
a.router-link-active:hover {
  color: var(--primary);
  background: var(--primary-soft);
}
a svg {
  flex: none;
  opacity: 0.85;
}
a.router-link-active svg {
  opacity: 1;
}

@media (max-width: 1080px) {
  a span {
    display: none;
  }
  a {
    padding: 10px;
  }
}

@media (max-width: 760px) {
  nav {
    position: fixed;
    z-index: 30;
    bottom: 0;
    left: 0;
    right: 0;
    height: 72px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    box-shadow: 0 -4px 16px -12px rgba(31, 35, 54, 0.4);
    justify-content: space-around;
    padding: 6px 4px env(safe-area-inset-bottom);
  }
  a {
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
    padding: 7px 6px;
  }
  a span {
    display: block;
  }
  a.router-link-active,
  a.router-link-active:hover {
    background: transparent;
  }
}
</style>
