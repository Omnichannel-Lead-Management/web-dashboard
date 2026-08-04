<script setup>
import { CheckCircle2, AlertCircle, X } from 'lucide-vue-next'
import { useAppStore } from '../../stores/app'
const store = useAppStore()
</script>
<template>
  <Transition name="toast">
    <div
      v-if="store.toast"
      class="toast"
      :class="{ error: store.toast.type === 'error' }"
      role="status"
      aria-live="polite"
    >
      <component
        :is="store.toast.type === 'error' ? AlertCircle : CheckCircle2"
        class="icon"
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
  align-items: flex-start;
  gap: 11px;
  background: #1c2033;
  color: #fff;
  padding: 13px 15px;
  border-radius: var(--radius);
  box-shadow: 0 15px 35px rgba(20, 23, 38, 0.28);
  font-size: var(--fs-base);
  font-weight: 600;
  line-height: 1.5;
  max-width: 380px;
}
.toast .icon {
  flex: none;
  margin-top: 1px;
  color: #6ee7b7;
}
.toast.error .icon {
  color: #fca98c;
}
.toast button {
  flex: none;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  display: flex;
  padding: 2px;
  margin-top: 1px;
  border-radius: var(--radius-xs);
  transition: color var(--dur) var(--ease);
}
.toast button:hover {
  color: #fff;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
@media (max-width: 600px) {
  .toast {
    left: 14px;
    right: 14px;
    bottom: 84px;
  }
}
</style>
