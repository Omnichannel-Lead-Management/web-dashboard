<script setup>
import { computed } from 'vue'
import { LogOut } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import AppNavigation from './AppNavigation.vue'

const router = useRouter()
const store = useAppStore()

const initials = computed(() => {
  const name = store.agentName || 'A'
  return name.slice(0, 2).toUpperCase()
})

const liveLabel = computed(() => {
  if (store.demoMode) return 'Demo'
  if (store.connectionStatus === 'online') return 'Live'
  if (store.connectionStatus === 'connecting' || store.connectionStatus === 'connected') {
    return 'Connecting'
  }
  return 'Offline'
})

function logOut() {
  store.logout()
  router.push('/login')
}
</script>
<template>
  <header>
    <RouterLink to="/inbox" class="brand">
      <i><b /></i>
      <strong>Loop</strong>
    </RouterLink>
    <AppNavigation />
    <div class="account">
      <span class="live" :class="{ offline: store.connectionStatus !== 'online', demo: store.demoMode }">
        <i />
        {{ liveLabel }}
      </span>
      <button @click="logOut" title="Sign out">
        <span>
          <b>{{ store.businessName || 'Business' }}</b>
          <small>{{ store.agentName }} · Agent</small>
        </span>
        <em>{{ initials }}</em>
        <LogOut :size="16" />
      </button>
    </div>
  </header>
</template>
<style scoped>
header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 25px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #eef0f5;
  position: sticky;
  top: 0;
  z-index: 25;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
}
.brand > i {
  width: 29px;
  height: 29px;
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
  font-size: 17px;
}
.account {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.live {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--success);
  background: var(--success-bg);
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}
.live i {
  width: 7px;
  height: 7px;
  background: #17b877;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
.account button {
  border: 0;
  background: none;
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: right;
  padding: 3px;
}
.account button span {
  display: flex;
  flex-direction: column;
}
.account small {
  color: var(--muted);
  font-size: 10.5px;
}
.live.offline {
  color: var(--muted);
  background: #f1f2f6;
}
.live.demo {
  color: #7c3aed;
  background: #f3e8ff;
}
.live.demo i {
  background: #7c3aed;
}
.live.offline i {
  background: var(--muted);
}
.account em {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-style: normal;
  font-size: 12px;
  font-weight: 700;
}
@media (max-width: 900px) {
  header {
    padding: 0 15px;
  }
  .account button span,
  .account button svg,
  .live {
    display: none;
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
