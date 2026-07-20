<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import AppointmentForm from '../components/appointments/AppointmentForm.vue'
import { useAppStore } from '../stores/app'
const store = useAppStore()
const route = useRoute()
const router = useRouter()

const selectedLead = computed(() =>
  store.leads.find((lead) => lead.id === route.query.lead),
)

function createAppointment(appointment) {
  store.addAppointment(appointment)
  router.push('/appointments')
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
      <AppointmentForm :lead="selectedLead" @submit="createAppointment" />
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
