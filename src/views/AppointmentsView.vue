<script setup>
import { Plus, CalendarDays } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import AppButton from '../components/common/AppButton.vue'
import AppointmentCard from '../components/appointments/AppointmentCard.vue'
import { onMounted } from 'vue'
import { useAppStore } from '../stores/app'
const store = useAppStore()

onMounted(() => {
  if (store.appointments.length === 0) store.refreshAppointments()
})

function getAppointmentDays() {
  return [...new Set(store.appointments.map((appointment) => appointment.day))]
}
</script>
<template>
  <AppShell>
    <div class="page">
      <div class="page-title">
        <div>
          <h1>Appointments</h1>
          <p>Bookings from chat and manual entry.</p>
        </div>
        <RouterLink to="/appointments/new">
          <AppButton>
            <Plus :size="17" />
            New appointment
          </AppButton>
        </RouterLink>
      </div>
      <div class="summary card">
        <CalendarDays />
        <div>
          <b>
            {{
              store.appointments.filter((a) => a.status === 'confirmed').length
            }}
            upcoming
          </b>
          <span>Across the next few days</span>
        </div>
      </div>
      <section v-for="day in getAppointmentDays()" :key="day">
        <h2>{{ day }}</h2>
        <AppointmentCard
          v-for="a in store.appointments.filter((x) => x.day === day)"
          :key="a.id"
          :appointment="a"
        />
      </section>
    </div>
  </AppShell>
</template>
<style scoped>
.summary {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 19px;
  margin-bottom: 23px;
  color: var(--primary);
}
.summary div {
  display: flex;
  flex-direction: column;
}
.summary b {
  font-size: 14px;
}
.summary span {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
section {
  margin-top: 20px;
}
section h2 {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 9px;
}
section article + article {
  margin-top: 8px;
}
</style>
