<script setup>
import { X, Mail, Phone, MapPin, CalendarPlus } from 'lucide-vue-next'

import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'
import { shortReference } from '../../services/displayText'

defineProps({
  conversation: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close'])
</script>
<template>
  <aside>
    <button
      class="close mobile-only"
      aria-label="Close details"
      @click="$emit('close')"
    >
      <X :size="19" />
    </button>
    <div class="profile">
      <AppAvatar
        :initials="conversation.initials"
        :channel="conversation.channel"
        size="lg"
      />
      <h3>{{ conversation.name }}</h3>
      <span class="mono">{{ shortReference(conversation.id) }}</span>
      <AppBadge :tone="conversation.status">{{ conversation.status }}</AppBadge>
    </div>
    <section>
      <h4>Lead information</h4>
      <div class="score">
        <span>Lead score</span>
        <strong>
          {{ conversation.score }}
          <small>/100</small>
        </strong>
      </div>
      <dl>
        <div>
          <dt>Interest</dt>
          <dd>{{ conversation.interest }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ conversation.status }}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{{ conversation.channel }}</dd>
        </div>
      </dl>
    </section>
    <section>
      <h4>Contact</h4>
      <p>
        <Mail :size="15" />
        {{ conversation.email }}
      </p>
      <p>
        <Phone :size="15" />
        {{ conversation.phone }}
      </p>
      <p>
        <MapPin :size="15" />
        {{ conversation.location }}
      </p>
    </section>
    <RouterLink
      class="appointment"
      :to="`/appointments/new?lead=${conversation.id}`"
    >
      <CalendarPlus :size="17" />
      Create appointment
    </RouterLink>
  </aside>
</template>
<style scoped>
aside {
  width: 278px;
  flex: none;
  border-left: 1px solid #eef0f5;
  background: #fbfbfd;
  padding: 20px;
  overflow-y: auto;
  position: relative;
}
.close {
  position: absolute;
  right: 12px;
  top: 12px;
  border: 0;
  background: none;
}
.profile {
  text-align: center;
  display: flex;
  align-items: center;
  flex-direction: column;
}
.profile h3 {
  font-size: 16px;
  margin: 10px 0 2px;
}
.profile > span {
  font-size: 10.5px;
  color: var(--muted);
  margin-bottom: 7px;
}
section {
  border-top: 1px solid var(--border);
  padding-top: 17px;
  margin-top: 18px;
}
h4 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
  margin: 0 0 13px;
}
.score {
  background: #fff;
  border: 1px solid var(--border);
  padding: 11px;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.score strong {
  font-size: 20px;
  color: #b25a12;
}
.score small {
  font-size: 10px;
  color: var(--muted);
}
dl {
  margin: 12px 0 0;
  font-size: 12px;
}
dl div {
  display: flex;
  justify-content: space-between;
  margin-top: 9px;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  font-weight: 700;
  text-transform: capitalize;
}
section p {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11.5px;
  color: var(--text-2);
  word-break: break-word;
}
.appointment {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: 10px;
  padding: 10px;
  margin-top: 18px;
  font-size: 12.5px;
  font-weight: 700;
}
@media (max-width: 1050px) {
  aside {
    display: none;
    position: fixed;
    z-index: 40;
    right: 0;
    top: 60px;
    bottom: 0;
    width: min(330px, 90vw);
    box-shadow: -12px 0 30px rgba(0, 0, 0, 0.12);
  }
  aside.show-mobile {
    display: block;
  }
}
@media (max-width: 760px) {
  aside {
    top: 54px;
    bottom: 72px;
  }
}
</style>
