<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDown, LogOut, Settings, Building2 } from 'lucide-vue-next'
import { useAppStore } from '../../stores/app'
import AppNavigation from './AppNavigation.vue'
import NotificationBell from '../notifications/NotificationBell.vue'

const router = useRouter()
const store = useAppStore()
const previewIdentity = inject('inboxPreviewIdentity', null)
const menuOpen = ref(false)

const displayedBusinessName = computed(
  () => previewIdentity?.value?.business?.name || store.businessName,
)
const displayedAgentName = computed(
  () => previewIdentity?.value?.agent?.name || store.agentName,
)
const displayedConnectionStatus = computed(
  () => previewIdentity?.value?.connectionStatus || store.connectionStatus,
)

const initials = computed(() => {
  if (previewIdentity?.value?.agent?.initials) {
    return previewIdentity.value.agent.initials
  }
  const name = displayedAgentName.value || 'A'
  return name.slice(0, 2).toUpperCase()
})

const liveLabel = computed(() => {
  if (displayedConnectionStatus.value === 'online') return 'Live'
  if (
    displayedConnectionStatus.value === 'connecting' ||
    displayedConnectionStatus.value === 'connected'
  ) {
    return 'Connecting'
  }
  return 'Offline'
})

/** Clicking the account chip used to sign you out; now it opens a menu. */
function toggleMenu() {
  menuOpen.value = !menuOpen.value
}
function closeMenu() {
  menuOpen.value = false
}
function goToSettings() {
  closeMenu()
  router.push('/settings')
}
function logOut() {
  closeMenu()
  store.logout()
  router.push('/login')
}

function handleWindowClick(event) {
  if (!event.target.closest?.('.account-menu')) closeMenu()
}
window.addEventListener('click', handleWindowClick)
onBeforeUnmount(() => window.removeEventListener('click', handleWindowClick))
</script>
<template>
  <header>
    <RouterLink to="/inbox" class="brand">
      <i><b /></i>
      <strong>Loop</strong>
    </RouterLink>
    <AppNavigation />
    <div class="account">
      <span
        class="live"
        :class="{ offline: displayedConnectionStatus !== 'online' }"
        :title="
          displayedConnectionStatus === 'online'
            ? 'Receiving new messages'
            : 'Not receiving new messages right now'
        "
      >
        <i />
        {{ liveLabel }}
      </span>
      <NotificationBell />
      <div class="account-menu">
        <button
          class="account-trigger"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          aria-label="Account menu"
          @click.stop="toggleMenu"
        >
          <span class="identity">
            <b>{{ displayedBusinessName || 'Business' }}</b>
            <small>{{ displayedAgentName }}</small>
          </span>
          <em>{{ initials }}</em>
          <ChevronDown class="chevron" :class="{ open: menuOpen }" :size="15" />
        </button>
        <Transition name="menu">
          <div v-if="menuOpen" class="menu" role="menu">
            <div class="menu-head">
              <Building2 :size="16" />
              <div>
                <b>{{ displayedBusinessName || 'Business' }}</b>
                <small>{{ displayedAgentName }}</small>
              </div>
            </div>
            <button role="menuitem" @click="goToSettings">
              <Settings :size="16" />
              Settings
            </button>
            <button role="menuitem" class="danger" @click="logOut">
              <LogOut :size="16" />
              Sign out
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
<style scoped>
header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 0 28px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-soft);
  position: sticky;
  top: 0;
  z-index: 25;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  flex: none;
}
.brand > i {
  width: 35px;
  height: 35px;
  border-radius: 9px;
  background: var(--primary);
  display: grid;
  place-items: center;
}
.brand b {
  width: 12px;
  height: 12px;
  border: 2.5px solid white;
  border-right-color: transparent;
  border-radius: 50%;
}
.brand strong {
  font-size: 20px;
  letter-spacing: -0.02em;
}

.account {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}
.live {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--success);
  background: var(--success-bg);
  padding: 5px 11px;
  border-radius: var(--radius-pill);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.live i {
  width: 7px;
  height: 7px;
  background: #17b877;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
.live.offline {
  color: var(--muted);
  background: var(--surface-3);
}
.live.offline i {
  background: var(--muted);
  animation: none;
}

.account-menu {
  position: relative;
}
.account-trigger {
  border: 1px solid transparent;
  background: none;
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: right;
  padding: 4px 6px 4px 10px;
  border-radius: var(--radius);
  transition:
    background var(--dur) var(--ease),
    border-color var(--dur) var(--ease);
}
.account-trigger:hover {
  background: var(--surface-2);
  border-color: var(--border);
}
.identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.identity b {
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
}
.identity small {
  color: var(--muted);
  font-size: var(--fs-2xs);
}
.account-trigger em {
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-style: normal;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.chevron {
  color: var(--muted);
  transition: transform var(--dur) var(--ease);
}
.chevron.open {
  transform: rotate(180deg);
}

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 224px;
  padding: 6px;
  display: grid;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.menu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-soft);
  color: var(--muted);
}
.menu-head > div {
  display: grid;
  min-width: 0;
}
.menu-head b {
  color: var(--text);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-head small {
  font-size: var(--fs-2xs);
}
.menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-size: var(--fs-base);
  font-weight: 600;
  text-align: left;
  transition: background var(--dur) var(--ease);
}
.menu button:hover {
  background: var(--surface-2);
  color: var(--text);
}
.menu button.danger {
  color: var(--danger);
}
.menu button.danger:hover {
  background: var(--danger-bg);
}

.menu-enter-active,
.menu-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease),
    transform var(--dur-fast) var(--ease);
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 900px) {
  header {
    padding: 0 15px;
    gap: 14px;
  }
  .identity,
  .chevron,
  .live {
    display: none;
  }
  .account-trigger {
    padding: 3px;
  }
}
@media (max-width: 760px) {
  header {
    height: 54px;
  }
  .account {
    margin-left: auto;
  }
  header :deep(nav) {
    display: flex;
  }
}
</style>
