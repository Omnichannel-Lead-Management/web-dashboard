<script setup>
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import OnboardingProgress from './OnboardingProgress.vue'

defineProps({
  steps: { type: Array, required: true },
  currentStep: { type: Number, required: true },
  progress: { type: Object, required: true },
  canContinue: { type: Boolean, default: true },
  allowSkip: { type: Boolean, default: false },
  isReview: { type: Boolean, default: false },
})

defineEmits(['select', 'previous', 'continue', 'skip', 'save-exit', 'finish'])
</script>

<template>
  <div class="onboarding-shell card">
    <header>
      <div>
        <p class="eyebrow">Workspace setup</p>
        <h1>{{ steps[currentStep - 1].title }}</h1>
        <p>{{ steps[currentStep - 1].description }}</p>
      </div>
      <AppButton variant="outline" size="sm" @click="$emit('save-exit')">
        <LogOut :size="15" />
        Save and exit
      </AppButton>
    </header>

    <OnboardingProgress
      :steps="steps"
      :current-step="currentStep"
      :completed-steps="progress.completedSteps"
      :skipped-steps="progress.skippedSteps"
      :blocked-steps="progress.blockedSteps"
      @select="$emit('select', $event)"
    />

    <main><slot /></main>

    <footer>
      <AppButton
        variant="outline"
        :disabled="currentStep === 1"
        @click="$emit('previous')"
      >
        <ChevronLeft :size="16" />
        Previous
      </AppButton>
      <div>
        <AppButton v-if="allowSkip" variant="secondary" @click="$emit('skip')">
          Skip for now
        </AppButton>
        <AppButton v-if="isReview" @click="$emit('finish')">
          Finish setup for now
        </AppButton>
        <AppButton v-else :disabled="!canContinue" @click="$emit('continue')">
          Continue
          <ChevronRight :size="16" />
        </AppButton>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.onboarding-shell {
  width: min(980px, 100%);
  margin: 0 auto;
  padding: 28px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--border);
}
header h1 {
  margin: 2px 0 6px;
  font-size: 26px;
}
header p:not(.eyebrow) {
  margin: 0;
  color: var(--muted);
  font-size: 13.5px;
}
.eyebrow {
  margin: 0;
  color: var(--primary);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.progress {
  margin: 24px 0;
}
main {
  min-height: 390px;
  padding: 8px 0 24px;
}
footer {
  border-top: 1px solid var(--border);
  padding-top: 20px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
footer > div {
  display: flex;
  gap: 10px;
}
@media (max-width: 620px) {
  .onboarding-shell {
    padding: 18px 15px;
    border-radius: 0;
  }
  header {
    flex-direction: column;
  }
  header > button {
    width: 100%;
  }
  main {
    min-height: 330px;
  }
  footer,
  footer > div {
    flex-direction: column-reverse;
    width: 100%;
  }
  footer button {
    width: 100%;
    min-height: 44px;
  }
}
</style>
