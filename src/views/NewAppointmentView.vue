<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import AppointmentForm from '../components/appointments/AppointmentForm.vue'
import { useAppStore } from '../stores/app'
const store = useAppStore()
const route = useRoute()
const router = useRouter()
const appointmentForm = ref(null)
const submitting = ref(false)

const selectedLead = computed(() =>
  store.leads.find((lead) => lead.id === route.query.lead),
)

async function createAppointment(appointment) {
  if (submitting.value) return
  submitting.value = true
  try {
    await store.addAppointment(appointment)
    await router.push('/appointments')
  } catch (error) {
    if (error?.status === 409) {
      await appointmentForm.value?.refreshAvailabilityAfterConflict()
    }
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <AppShell>
    <div class="page">
      <div class="crumb">
        <RouterLink to="/appointments">Appointments</RouterLink>
        / New
      </div>
      <div class="page-title">
        <div>
          <h1>Create appointment</h1>
          <p>Book a service and assign a team member.</p>
        </div>
      </div>
      <AppointmentForm
        ref="appointmentForm"
        :lead="selectedLead"
        :business-id="store.businessId"
        :submitting="submitting"
        @submit="createAppointment"
      />
    </div>
  </AppShell>
</template>
<style scoped>
.crumb {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 12px;
}
</style>
