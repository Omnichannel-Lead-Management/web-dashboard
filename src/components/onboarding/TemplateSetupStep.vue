<script setup>
import { watch } from 'vue'
import TemplatePicker from '../settings/TemplatePicker.vue'
import { useAppStore } from '../../stores/app'

const emit = defineEmits(['confirmed', 'blocked'])
const store = useAppStore()

function confirm(flow) {
  if (
    flow &&
    store.businessId &&
    (!flow.businessId || flow.businessId === store.businessId)
  ) {
    emit('confirmed', flow)
  }
}

watch(
  () => [store.templateError, store.flowError],
  ([templateError, flowError]) => {
    const error = templateError || flowError
    if (error) emit('blocked', error)
  },
)
</script>

<template>
  <TemplatePicker compact @attached="confirm" />
</template>
