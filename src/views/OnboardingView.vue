<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import OnboardingShell from '../components/onboarding/OnboardingShell.vue'
import BusinessReviewStep from '../components/onboarding/BusinessReviewStep.vue'
import ChannelSetupStep from '../components/onboarding/ChannelSetupStep.vue'
import FirstFaqStep from '../components/onboarding/FirstFaqStep.vue'
import ChatbotSetupStep from '../components/onboarding/ChatbotSetupStep.vue'
import TemplateSetupStep from '../components/onboarding/TemplateSetupStep.vue'
import OnboardingReviewStep from '../components/onboarding/OnboardingReviewStep.vue'
import { useAppStore } from '../stores/app'
import {
  createOnboardingFaqStepLoader,
  hasConfirmedFaqForBusiness,
} from '../services/onboardingFaqStep'
import { isOnboardingChannelConfirmed } from '../services/onboardingChannelStep'

const store = useAppStore()
const router = useRouter()
const channelConnectedThisSession = ref(false)
const faqLoadedBusinessId = ref('')
const faqStepLoader = createOnboardingFaqStepLoader(store)

const steps = [
  {
    id: 1,
    label: 'Business',
    title: 'Review your business',
    description: 'Confirm the workspace that this setup belongs to.',
  },
  {
    id: 2,
    label: 'Channels',
    title: 'Connect a channel',
    description: 'Choose where customers can start conversations.',
  },
  {
    id: 3,
    label: 'First FAQ',
    title: 'Create your first FAQ',
    description: 'Give your chatbot one confirmed answer to use.',
  },
  {
    id: 4,
    label: 'Chatbot',
    title: 'Configure your chatbot',
    description: 'Control automatic replies and prepare customer messages.',
  },
  {
    id: 5,
    label: 'Template',
    title: 'Choose a conversation template',
    description: 'Attach a prepared flow only when you are ready.',
  },
  {
    id: 6,
    label: 'Review',
    title: 'Review setup progress',
    description:
      'See what is done, what you skipped, and what still needs you.',
  },
]

const currentStep = computed(() => store.onboardingProgress.currentStep)
const visitedSteps = ref(new Set([currentStep.value]))
const activeBusiness = computed(() =>
  store.business?.id === store.businessId ? store.business : null,
)
const channelConfirmed = computed(() =>
  isOnboardingChannelConfirmed({
    business: activeBusiness.value,
    businessId: store.businessId,
    channelConfirmedThisSession: channelConnectedThisSession.value,
  }),
)
const faqConfirmed = computed(() =>
  Boolean(
    !store.loadingFaqs &&
    faqLoadedBusinessId.value === store.businessId &&
    hasConfirmedFaqForBusiness(store.faqs, store.businessId),
  ),
)
const chatbotConfirmed = computed(
  () => store.chatbotConfig.businessId === store.businessId,
)
const templateConfirmed = computed(() =>
  store.businessFlows.some((flow) => flow.businessId === store.businessId),
)

function isComplete(step) {
  if (step === 3) return faqConfirmed.value
  if (store.onboardingProgress.completedSteps.includes(step)) return true
  if (step === 1) return Boolean(activeBusiness.value)
  if (step === 2) return channelConfirmed.value
  if (step === 4) return chatbotConfirmed.value
  if (step === 5) return templateConfirmed.value
  return false
}

const canContinue = computed(() => isComplete(currentStep.value))
const allowSkip = computed(() => [2, 3, 4, 5].includes(currentStep.value))

function statusFor(step) {
  if (isComplete(step)) return 'Completed'
  if (store.onboardingProgress.skippedSteps.includes(step)) return 'Skipped'
  if (store.onboardingProgress.blockedSteps.includes(step))
    return 'Needs attention'
  return 'Not completed'
}

const reviewRows = computed(() => [
  {
    label: 'Business confirmed',
    status: statusFor(1),
    detail: activeBusiness.value?.name || 'No confirmed business',
  },
  {
    label: 'Channel connected or skipped',
    status: statusFor(2),
    detail: channelConfirmed.value
      ? 'A channel is configured'
      : 'No confirmed channel',
  },
  {
    label: 'FAQ created',
    status: statusFor(3),
    detail: faqConfirmed.value
      ? 'Your chatbot has an answer to work with'
      : 'No FAQ saved yet',
  },
  {
    label: 'Chatbot configured',
    status: statusFor(4),
    detail: chatbotConfirmed.value
      ? 'Automatic replies are set up'
      : 'Chatbot settings are not available right now',
  },
  {
    label: 'Template attached',
    status: statusFor(5),
    detail: templateConfirmed.value
      ? 'A conversation template is in use'
      : 'No template chosen yet',
  },
])

function selectStep(step) {
  store.setOnboardingStep(step)
}

function hasVisited(step) {
  return visitedSteps.value.has(step)
}

function previous() {
  store.setOnboardingStep(Math.max(1, currentStep.value - 1))
}

function continueStep() {
  if (!canContinue.value) return
  store.markOnboardingStepComplete(currentStep.value)
  store.setOnboardingStep(Math.min(6, currentStep.value + 1))
}

function skipStep() {
  store.skipOnboardingStep(currentStep.value)
  store.setOnboardingStep(Math.min(6, currentStep.value + 1))
}

function markBlocked(step) {
  if (store.businessId && currentStep.value === step) {
    store.markOnboardingStepBlocked(step)
  }
}

function markConfirmed(step) {
  if (store.businessId && currentStep.value === step) {
    if (step === 3) faqLoadedBusinessId.value = store.businessId
    store.markOnboardingStepComplete(step)
  }
}

function markTemplateConfirmed(flow) {
  if (
    currentStep.value === 5 &&
    store.businessId &&
    flow &&
    (!flow.businessId || flow.businessId === store.businessId)
  ) {
    store.markOnboardingStepComplete(5)
  }
}

async function loadFaqStep(businessId) {
  const result = await faqStepLoader.enter(businessId)
  if (
    result.status === 'loaded' &&
    result.businessId === store.businessId &&
    currentStep.value === 3
  ) {
    faqLoadedBusinessId.value = result.businessId
    if (hasConfirmedFaqForBusiness(result.faqs, result.businessId)) {
      store.markOnboardingStepComplete(3)
    }
  } else if (
    result.status === 'failed' &&
    result.businessId === store.businessId &&
    currentStep.value === 3
  ) {
    store.markOnboardingStepBlocked(3)
  }
}

function saveAndExit() {
  store.notify('Setup progress saved.')
  router.push('/inbox')
}

function finish() {
  store.finishOnboardingLocally()
  store.notify('Setup progress saved.')
  router.push('/inbox')
}

watch(
  () => store.businessId,
  () => {
    channelConnectedThisSession.value = false
    faqLoadedBusinessId.value = ''
    faqStepLoader.invalidate()
    store.loadOnboardingProgress()
    visitedSteps.value = new Set([store.onboardingProgress.currentStep])
  },
  { immediate: true },
)

watch(
  currentStep,
  (step) => {
    visitedSteps.value = new Set(visitedSteps.value).add(step)
    if (step === 3) void loadFaqStep(store.businessId)
    if (step === 4 && store.chatbotConfigError) markBlocked(4)
    if (step === 5 && (store.templateError || store.flowError)) markBlocked(5)
  },
  { immediate: true },
)
</script>

<template>
  <AppShell>
    <div class="onboarding-page">
      <OnboardingShell
        v-if="store.onboardingLoaded && store.businessId"
        :key="store.businessId"
        :steps="steps"
        :current-step="currentStep"
        :progress="store.onboardingProgress"
        :can-continue="canContinue"
        :allow-skip="allowSkip"
        :is-review="currentStep === 6"
        @select="selectStep"
        @previous="previous"
        @continue="continueStep"
        @skip="skipStep"
        @save-exit="saveAndExit"
        @finish="finish"
      >
        <BusinessReviewStep v-if="hasVisited(1)" v-show="currentStep === 1" />
        <ChannelSetupStep
          v-if="hasVisited(2)"
          v-show="currentStep === 2"
          @connection-change="channelConnectedThisSession = $event"
        />
        <FirstFaqStep
          v-if="hasVisited(3)"
          v-show="currentStep === 3"
          @confirmed="markConfirmed(3)"
          @blocked="markBlocked(3)"
        />
        <ChatbotSetupStep
          v-if="hasVisited(4)"
          v-show="currentStep === 4"
          @blocked="markBlocked(4)"
        />
        <TemplateSetupStep
          v-if="hasVisited(5)"
          v-show="currentStep === 5"
          @confirmed="markTemplateConfirmed"
          @blocked="markBlocked(5)"
        />
        <OnboardingReviewStep
          v-if="hasVisited(6)"
          v-show="currentStep === 6"
          :rows="reviewRows"
        />
      </OnboardingShell>
      <div v-else class="card unavailable" role="alert">
        No active business is available for onboarding.
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.onboarding-page {
  width: 100%;
  overflow-y: auto;
  padding: 28px;
}
.unavailable {
  max-width: 680px;
  margin: 40px auto;
  padding: 24px;
  color: var(--danger);
}
@media (max-width: 620px) {
  .onboarding-page {
    padding: 0 0 84px;
  }
}
</style>
