<script setup>
import { Check, LockKeyhole } from 'lucide-vue-next'

defineProps({
  steps: { type: Array, required: true },
  currentStep: { type: Number, required: true },
  completedSteps: { type: Array, default: () => [] },
  skippedSteps: { type: Array, default: () => [] },
  blockedSteps: { type: Array, default: () => [] },
})

defineEmits(['select'])
</script>

<template>
  <nav class="progress" aria-label="Onboarding progress">
    <button
      v-for="step in steps"
      :key="step.id"
      type="button"
      class="progress-step"
      :class="{
        current: step.id === currentStep,
        complete: completedSteps.includes(step.id),
        blocked: blockedSteps.includes(step.id),
      }"
      :aria-current="step.id === currentStep ? 'step' : undefined"
      @click="$emit('select', step.id)"
    >
      <span>
        <Check v-if="completedSteps.includes(step.id)" :size="15" />
        <LockKeyhole v-else-if="blockedSteps.includes(step.id)" :size="14" />
        <template v-else>{{ step.id }}</template>
      </span>
      <small>{{ step.label }}</small>
      <i v-if="skippedSteps.includes(step.id)">Skipped</i>
    </button>
  </nav>
</template>

<style scoped>
.progress {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}
.progress-step {
  border: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  min-width: 0;
  padding: 6px 2px;
}
.progress-step > span {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  background: #fff;
  font-weight: 700;
}
.progress-step small {
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}
.progress-step i {
  font-size: 9px;
  font-style: normal;
}
.progress-step.current {
  color: var(--primary);
}
.progress-step.current > span {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-soft);
}
.progress-step.complete {
  color: var(--success);
}
.progress-step.complete > span {
  color: #fff;
  background: var(--success);
  border-color: var(--success);
}
.progress-step.blocked {
  color: #b25a12;
}
@media (max-width: 680px) {
  .progress {
    grid-template-columns: repeat(3, 1fr);
    row-gap: 12px;
  }
}
</style>
