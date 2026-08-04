<script setup>
import { computed, onMounted, ref } from 'vue'
import { Building2, RefreshCw } from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import { useAppStore } from '../../stores/app'
import { getBusinessSectorLabel } from '../../constants/businessSectors'
import { friendlyErrorMessage } from '../../services/displayText'

const store = useAppStore()
const loading = ref(false)
const error = ref('')
const business = computed(() =>
  store.business?.id === store.businessId ? store.business : null,
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await store.refreshBusiness()
  } catch (loadError) {
    error.value = friendlyErrorMessage(
      loadError,
      'We could not load your business details.',
    )
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!business.value) load()
})
</script>

<template>
  <section aria-labelledby="business-review-title">
    <div v-if="loading" class="state" role="status">
      <RefreshCw class="spin" :size="18" />
      Loading business…
    </div>
    <div v-else-if="error && !business" class="notice error" role="alert">
      <p>{{ error }}</p>
      <AppButton size="sm" variant="outline" @click="load">Retry</AppButton>
    </div>
    <template v-else-if="business">
      <div class="business-card">
        <span><Building2 :size="24" /></span>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{{ business.name }}</dd>
          </div>
          <div>
            <dt>Sector</dt>
            <dd>
              {{ getBusinessSectorLabel(business.sector) || 'Not provided' }}
            </dd>
          </div>
          <div>
            <dt>Owner email</dt>
            <dd>{{ business.owner_email || 'Not provided' }}</dd>
          </div>
        </dl>
      </div>
      <p class="notice">
        Need to change any of this? You can edit your business profile from
        Settings once setup is finished.
      </p>
    </template>
    <p v-else class="notice error" role="alert">
      No confirmed active business is loaded.
    </p>
  </section>
</template>

<style scoped>
.state {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
}
.business-card {
  display: flex;
  gap: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}
.business-card > span {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary);
}
dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  flex: 1;
  gap: 20px;
}
dt {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
dd {
  margin: 5px 0 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.notice {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f7f8fb;
  color: var(--text-2);
  font-size: 13px;
}
.notice.error {
  color: var(--danger);
  background: var(--danger-bg);
}
@media (max-width: 620px) {
  dl {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
