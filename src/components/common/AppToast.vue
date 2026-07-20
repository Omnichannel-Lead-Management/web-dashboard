<script setup>
import { CheckCircle2, AlertCircle, X } from 'lucide-vue-next'
import { useAppStore } from '../../stores/app'
const store = useAppStore()
</script>
<template>
  <Transition name="toast">
    <div v-if="store.toast" class="toast" role="status">
      <component
        :is="store.toast.type === 'error' ? AlertCircle : CheckCircle2"
        :size="19"
      />
      <span>{{ store.toast.message }}</span>
      <button aria-label="Dismiss notification" @click="store.toast = null">
        <X :size="16" />
      </button>
    </div>
  </Transition>
</template>
<style scoped>
.toast {
  position: fixed;
  z-index: 1000;
  right: 22px;
  bottom: 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #1c2033;
  color: #fff;
  padding: 12px 14px;
  border-radius: 12px;
  box-shadow: 0 15px 35px rgba(20, 23, 38, 0.24);
  font-size: 13.5px;
  font-weight: 600;
  max-width: 360px;
}
.toast button {
  border: 0;
  background: transparent;
  color: #fff;
  display: flex;
  padding: 2px;
}
.toast-enter-active,
.toast-leave-active {
  transition: 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
@media (max-width: 600px) {
  .toast {
    left: 14px;
    right: 14px;
    bottom: 84px;
  }
}
</style>
