<script setup>
import { computed } from 'vue'
import {
  Inbox,
  Users,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
  LifeBuoy,
} from 'lucide-vue-next'
import { useAppStore } from '../../stores/app'

const store = useAppStore()

const links = computed(() =>
  [
    { to: '/inbox', label: 'Inbox', icon: Inbox },
    {
      to: '/escalations',
      label: 'Queue',
      icon: LifeBuoy,
      show: store.escalationQueueAvailable,
      badge: store.escalations.filter((item) => item.status === 'queued')
        .length,
    },
    { to: '/leads', label: 'Leads', icon: Users },
    { to: '/appointments', label: 'Appointments', icon: CalendarDays },
    { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
    { to: '/settings', label: 'Settings', icon: Settings },
  ].filter((link) => link.show !== false),
)
</script>
<template>
  <nav aria-label="Main navigation">
    <RouterLink v-for="link in links" :key="link.to" :to="link.to">
      <component :is="link.icon" :size="17" />
      <span>{{ link.label }}</span>
      <i v-if="link.badge" class="count">{{ link.badge }}</i>
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
.count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--danger);
  color: #fff;
  font-size: var(--fs-2xs);
  font-style: normal;
  font-weight: 700;
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
  .count {
    position: absolute;
    top: 2px;
    right: 6px;
  }
}
</style>
