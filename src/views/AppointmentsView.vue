<script setup>
import { Plus, CalendarDays } from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import AppButton from '../components/common/AppButton.vue'
import AppointmentCard from '../components/appointments/AppointmentCard.vue'
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '../stores/app'
import {
  filterAppointmentsByStatus,
  splitAppointmentsByTime,
} from '../services/mappers'

const store = useAppStore()
const selectedStatus = ref('all')
const updatingActions = ref({})

onMounted(() => {
  if (store.appointments.length === 0) store.refreshAppointments()
})

const filteredAppointments = computed(() =>
  filterAppointmentsByStatus(store.appointments, selectedStatus.value),
)

const appointmentSections = computed(() =>
  splitAppointmentsByTime(filteredAppointments.value),
)

const upcomingConfirmedCount = computed(
  () =>
    appointmentSections.value.upcoming.filter(
      (appointment) => appointment.status === 'confirmed',
    ).length,
)

function groupByDay(appointments) {
  const groups = new Map()
  for (const appointment of appointments) {
    const day = appointment.day || 'Unscheduled'
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(appointment)
  }
  return [...groups].map(([day, items]) => ({ day, items }))
}

const upcomingGroups = computed(() =>
  groupByDay(appointmentSections.value.upcoming),
)
const pastGroups = computed(() => groupByDay(appointmentSections.value.past))

function actionFor(appointmentId) {
  return updatingActions.value[appointmentId] || ''
}

async function handleStatusChange({ id, status }) {
  if (updatingActions.value[id]) return
  updatingActions.value[id] = status
  try {
    await store.updateAppointmentStatus(id, status)
  } catch {
    // The store rolls back and presents the API error to the user.
  } finally {
    delete updatingActions.value[id]
  }
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
            {{ upcomingConfirmedCount }}
            upcoming
          </b>
          <span>Across the next few days</span>
        </div>
      </div>
      <div class="filter-control">
        <label for="appointment-status">Status</label>
        <select id="appointment-status" v-model="selectedStatus">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <p v-if="store.loadingAppointments" class="page-state" role="status">
        Loading appointments…
      </p>
      <p
        v-else-if="store.appointments.length === 0"
        class="page-state"
      >
        No appointments yet.
      </p>
      <p
        v-else-if="filteredAppointments.length === 0"
        class="page-state"
      >
        No appointments match this status.
      </p>
      <template v-else>
        <section v-if="upcomingGroups.length" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" class="section-title">
            Upcoming appointments
          </h2>
          <div v-for="group in upcomingGroups" :key="group.day" class="day-group">
            <h3>{{ group.day }}</h3>
            <AppointmentCard
              v-for="appointment in group.items"
              :key="appointment.id"
              :appointment="appointment"
              :updating-action="actionFor(appointment.id)"
              @status-change="handleStatusChange"
            />
          </div>
        </section>
        <section v-if="pastGroups.length" aria-labelledby="past-title">
          <h2 id="past-title" class="section-title">Past appointments</h2>
          <div v-for="group in pastGroups" :key="group.day" class="day-group">
            <h3>{{ group.day }}</h3>
            <AppointmentCard
              v-for="appointment in group.items"
              :key="appointment.id"
              :appointment="appointment"
              :updating-action="actionFor(appointment.id)"
              @status-change="handleStatusChange"
            />
          </div>
        </section>
      </template>
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
  margin-top: 28px;
}
.section-title {
  color: var(--text);
  font-size: 16px;
  margin: 0 0 14px;
}
.day-group + .day-group {
  margin-top: 18px;
}
.day-group h3 {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 9px;
}
.day-group article + article {
  margin-top: 8px;
}
.filter-control {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.filter-control label {
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
}
.filter-control select {
  min-width: 150px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fff;
}
.page-state {
  margin: 28px 0;
  padding: 24px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--muted);
  text-align: center;
}
@media (max-width: 760px) {
  .filter-control {
    align-items: stretch;
    flex-direction: column;
  }
  .filter-control select {
    width: 100%;
  }
}
@media (max-width: 600px) {
  .summary {
    margin-bottom: 18px;
  }
  section {
    margin-top: 22px;
  }
}
</style>
