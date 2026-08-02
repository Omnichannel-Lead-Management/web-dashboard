<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  CalendarPlus,
} from 'lucide-vue-next'
import AppShell from '../components/layout/AppShell.vue'
import AppAvatar from '../components/common/AppAvatar.vue'
import AppBadge from '../components/common/AppBadge.vue'
import AppButton from '../components/common/AppButton.vue'
import LeadEditPanel from '../components/leads/LeadEditPanel.vue'
import { useAppStore } from '../stores/app'
const store = useAppStore()
const route = useRoute()
const router = useRouter()

/**
 * The list view may not have been visited (deep link, refresh), so fetch the
 * lead by id and fall back to the store copy while that is in flight.
 */
const loading = ref(false)
const loadError = ref('')
const mutationError = ref('')
const busyField = ref('')
let loadRequestId = 0

const lead = computed(
  () =>
    (store.leadDetail?.id === route.params.id ? store.leadDetail : null) ||
    store.leads.find((currentLead) => currentLead.id === route.params.id),
)
const activities = computed(() =>
  store.leadDetail?.id === route.params.id ? store.leadActivities : [],
)
const availableAgents = computed(() =>
  store.agentId ? [{ id: store.agentId, name: store.agentName || store.agentId }] : [],
)

async function load(id) {
  if (!id) return
  const requestId = ++loadRequestId
  loading.value = true
  loadError.value = ''
  try {
    await store.refreshLeadDetail(id)
  } catch (error) {
    if (requestId !== loadRequestId) return
    loadError.value = error.message || 'Failed to load lead'
    store.notify(loadError.value, 'error')
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

async function handleUpdate({ kind, patch }) {
  if (busyField.value) return
  busyField.value = kind
  mutationError.value = ''
  try {
    await store.updateLead(lead.value.id, patch)
  } catch (error) {
    mutationError.value = error.message || 'Failed to update lead'
  } finally {
    busyField.value = ''
  }
}

async function handleAssignment({ agentId }) {
  if (busyField.value) return
  busyField.value = 'assignment'
  mutationError.value = ''
  try {
    if (agentId) await store.assignLead(lead.value.id, agentId)
    else await store.autoAssignLead(lead.value.id)
  } catch (error) {
    mutationError.value = error.message || 'Failed to assign lead'
  } finally {
    busyField.value = ''
  }
}

onMounted(() => load(route.params.id))
watch(() => route.params.id, load)

/** Colour the dot by what happened, matching the existing green/orange styles. */
function activityTone(type) {
  if (type === 'lead_created') return 'green'
  if (type === 'status_changed' || type === 'assigned') return 'orange'
  return ''
}

</script>
<template>
  <AppShell>
    <div v-if="lead" class="page">
      <button class="back" @click="router.push('/leads')">
        <ArrowLeft :size="16" />
        Leads
      </button>
      <div class="hero card">
        <AppAvatar
          :initials="lead.initials"
          :channel="lead.channel"
          size="lg"
        />
        <div>
          <span>
            <h1>{{ lead.name }}</h1>
            <AppBadge :tone="lead.channel">{{ lead.channel }}</AppBadge>
          </span>
          <p class="mono">Lead #{{ lead.id }} · Created {{ lead.created }}</p>
        </div>
        <div class="hero-actions">
          <AppButton variant="outline" @click="router.push('/inbox')">
            <MessageSquare :size="16" />
            Open chat
          </AppButton>
          <AppButton @click="router.push(`/appointments/new?lead=${lead.id}`)">
            <CalendarPlus :size="16" />
            Appointment
          </AppButton>
        </div>
      </div>
      <div class="grid">
        <section class="card main">
          <h2>Lead overview</h2>
          <div class="fields">
            <div>
              <small>Status</small>
              <AppBadge :tone="lead.status">{{ lead.status }}</AppBadge>
            </div>
            <div>
              <small>Lead score</small>
              <strong class="score">
                {{ lead.score }}
                <em>/100</em>
              </strong>
            </div>
            <div>
              <small>Interest</small>
              <strong>{{ lead.interest }}</strong>
            </div>
            <div>
              <small>Assigned agent</small>
              <strong>{{ lead.agent }}</strong>
            </div>
          </div>
          <h3>Notes</h3>
          <p>{{ lead.notes || 'No notes yet.' }}</p>
          <p v-if="mutationError" class="inline-error" role="alert">
            {{ mutationError }}
          </p>
          <LeadEditPanel
            :lead="lead"
            :agents="availableAgents"
            :busy-field="busyField"
            @update="handleUpdate"
            @assign="handleAssignment"
          />
          <h3>Activity</h3>
          <ol v-if="activities.length">
            <li v-for="entry in activities" :key="entry.id">
              <i :class="activityTone(entry.type)" />
              {{ entry.description }}
              <small>
                {{ entry.by || 'Unknown actor' }}
                <template v-if="entry.age"> · {{ entry.age }} ago</template>
              </small>
            </li>
          </ol>
          <p v-else-if="loading" class="muted">Loading activity…</p>
          <p v-else class="muted">No activity recorded yet.</p>
        </section>
        <aside class="card">
          <h2>Contact details</h2>
          <p>
            <Mail :size="16" />
            {{ lead.email }}
          </p>
          <p>
            <Phone :size="16" />
            {{ lead.phone }}
          </p>
          <p>
            <MapPin :size="16" />
            {{ lead.location }}
          </p>
          <hr />
          <h2>Score breakdown</h2>
          <div class="breakdown">
            <span>
              Package interest
              <b>+30</b>
            </span>
            <span>
              Asked for agent
              <b>+20</b>
            </span>
            <span>
              {{ lead.channel }} source
              <b>+10</b>
            </span>
            <span>
              Active today
              <b>+12</b>
            </span>
          </div>
        </aside>
      </div>
    </div>
    <div v-else-if="loading" class="empty" role="status">Loading lead…</div>
    <div v-else-if="loadError" class="empty error" role="alert">
      {{ loadError }}
    </div>
    <div v-else class="empty">Lead not found.</div>
  </AppShell>
</template>
<style scoped>
.muted {
  color: var(--muted);
}
.back {
  border: 0;
  background: none;
  color: var(--primary);
  display: flex;
  gap: 7px;
  margin-bottom: 13px;
  font-weight: 700;
}
.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
}
.hero h1 {
  font-size: 23px;
  margin: 0;
}
.hero > div > span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hero p {
  font-size: 10.5px;
  color: var(--muted);
  margin: 4px 0 0;
}
.hero-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.7fr);
  gap: 17px;
  margin-top: 17px;
}
.main,
aside {
  padding: 22px;
}
h2 {
  font-size: 16px;
  margin-bottom: 19px;
}
.fields {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.fields > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fields small {
  color: var(--muted);
  font-size: 11px;
}
.fields strong {
  font-size: 13px;
}
.score {
  font-size: 26px !important;
  color: #b25a12;
}
.score em {
  font-size: 10px;
  color: var(--muted);
  font-style: normal;
}
h3 {
  font-size: 12px;
  margin: 20px 0 9px;
}
.main > p {
  font-size: 13px;
  color: var(--text-2);
}
.inline-error,
.error {
  color: var(--danger);
}
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  position: relative;
  padding: 0 0 17px 20px;
  font-size: 12.5px;
}
li i {
  position: absolute;
  left: 0;
  top: 4px;
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
}
li i.orange {
  background: var(--danger);
}
li i.green {
  background: #17b877;
}
li small {
  display: block;
  color: var(--muted);
  margin-top: 3px;
}
aside p {
  display: flex;
  gap: 9px;
  align-items: center;
  font-size: 12px;
  color: var(--text-2);
}
hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 20px 0;
}
.breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
}
.breakdown span {
  display: flex;
  justify-content: space-between;
}
.breakdown b {
  color: var(--success);
}
@media (max-width: 760px) {
  .hero {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .hero-actions {
    width: 100%;
    margin: 0;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .fields {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
