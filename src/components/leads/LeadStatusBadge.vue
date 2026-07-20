<script setup>
import AppBadge from '../common/AppBadge.vue'

defineProps({
  status: {
    type: String,
    default: 'new',
  },
})
</script>
<template>
  <AppBadge :tone="status">{{ status }}</AppBadge>
</template>
