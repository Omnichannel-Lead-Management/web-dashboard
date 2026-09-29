<script setup>
import AppBadge from '../common/AppBadge.vue'
import {
  invoiceStatusLabel,
  invoiceStatusTone,
} from '../../services/billingFormat'

defineProps({ status: { type: String, default: 'draft' } })
</script>
<template>
  <AppBadge :tone="invoiceStatusTone(status)">
    {{ invoiceStatusLabel(status) }}
  </AppBadge>
</template>
