<script setup>
import {
  Plus,
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  RefreshCw,
} from 'lucide-vue-next'
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

const pendingCount = computed(
  () =>
    store.appointments.filter((appointment) => appointment.status === 'pending')
      .length,
)

const summaryStats = computed(() => [
  {
    label: 'Confirmed and upcoming',
    value: upcomingConfirmedCount.value,
    icon: CalendarCheck,
    tone: 'success',
  },
  {
    label: 'Waiting on confirmation',
    value: pendingCount.value,
    icon: CalendarClock,
    tone: 'warning',
  },
  {
    label: 'All appointments',
    value: store.appointments.length,
    icon: CalendarDays,
    tone: 'primary',
  },
])

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
      <div class="summary">
        <div v-for="stat in summaryStats" :key="stat.label" class="stat card">
          <span class="stat-icon" :class="stat.tone">
            <component :is="stat.icon" :size="18" />
          </span>
          <div>
            <b>{{ stat.value }}</b>
            <span>{{ stat.label }}</span>
          </div>
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

      <div v-if="store.loadingAppointments" class="card" role="status">
        <div class="empty-state">
          <span class="empty-icon"><RefreshCw class="spin" :size="22" /></span>
          <h3>Loading your appointments…</h3>
        </div>
      </div>
      <div v-else-if="filteredAppointments.length === 0" class="card">
        <div class="empty-state">
          <span class="empty-icon"><CalendarDays :size="22" /></span>
          <h3>
            {{
              store.appointments.length === 0
                ? 'No appointments yet'
                : 'Nothing with this status'
            }}
          </h3>
          <p>
            {{
              store.appointments.length === 0
                ? 'Bookings made in chat show up here, and you can add one yourself at any time.'
                : 'Choose a different status to see other bookings.'
            }}
          </p>
          <RouterLink
            v-if="store.appointments.length === 0"
            to="/appointments/new"
          >
            <AppButton>
              <Plus :size="16" />
              New appointment
            </AppButton>
          </RouterLink>
        </div>
      </div>
      <template v-else>
        <section v-if="upcomingGroups.length" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" class="section-title">
            Upcoming appointments
          </h2>
          <div
            v-for="group in upcomingGroups"
            :key="group.day"
            class="day-group"
          >
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 23px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 18px;
}
.stat > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stat b {
  font-size: 24px;
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.stat > div span {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}
.stat-icon {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: var(--primary-soft);
  color: var(--primary);
}
.stat-icon.success {
  background: var(--success-bg);
  color: var(--success);
}
.stat-icon.warning {
  background: var(--warning-bg);
  color: var(--warning);
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
  width: auto;
  min-width: 170px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
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
