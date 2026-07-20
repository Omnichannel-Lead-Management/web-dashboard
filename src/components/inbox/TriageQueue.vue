<script setup>
import AppAvatar from '../common/AppAvatar.vue'
import AppBadge from '../common/AppBadge.vue'
import AppButton from '../common/AppButton.vue'

defineProps({
  conversations: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['open', 'claim'])
</script>
<template>
  <div class="triage">
    <section>
      <header>
        <span>⚡ Escalation queue</span>
        <b>{{ conversations.filter((c) => c.escalated).length }}</b>
      </header>
      <article
        v-for="c in conversations.filter((c) => c.escalated)"
        :key="c.id"
        class="escalated"
      >
        <AppAvatar :initials="c.initials" :channel="c.channel" size="lg" />
        <div>
          <strong>{{ c.name }}</strong>
          <AppBadge tone="warning">Score {{ c.score }}</AppBadge>
          <p>{{ c.preview }}</p>
          <small class="mono">waiting {{ c.time }}</small>
        </div>
        <AppButton @click="$emit('claim', c.id)">Claim</AppButton>
      </article>
    </section>
    <section>
      <header>
        <span>All conversations</span>
        <b>{{ conversations.length }}</b>
      </header>
      <div class="rows">
        <button
          v-for="c in conversations"
          :key="c.id"
          @click="$emit('open', c.id)"
        >
          <i :class="c.channel.toLowerCase()" />
          <AppAvatar :initials="c.initials" :channel="c.channel" />
          <span>
            <strong>
              {{ c.name }}
              <AppBadge :tone="c.channel">{{ c.channel }}</AppBadge>
            </strong>
            <small>{{ c.preview }}</small>
          </span>
          <em>
            <time class="mono">{{ c.time }}</time>
            <AppBadge :tone="c.status">{{ c.status }}</AppBadge>
          </em>
        </button>
      </div>
    </section>
  </div>
</template>
<style scoped>
.triage {
  padding: 24px 30px 90px;
  max-width: 1050px;
  width: 100%;
  margin: auto;
  overflow: auto;
}
.triage section + section {
  margin-top: 24px;
}
.triage header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--danger);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 800;
  margin-bottom: 10px;
}
.triage header b {
  background: var(--danger);
  color: #fff;
  width: 19px;
  height: 19px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 10px;
}
.escalated {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border: 1px solid #f6d5c6;
  border-left: 4px solid var(--danger);
  border-radius: 13px;
  padding: 14px 16px;
}
.escalated > div {
  flex: 1;
}
.escalated strong {
  font-size: 14px;
  margin-right: 8px;
}
.escalated p {
  font-size: 13px;
  margin: 4px 0;
}
.escalated small {
  font-size: 10px;
  color: var(--muted);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.rows > button {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #edeef3;
  background: #fff;
  border-radius: 13px;
  padding: 12px 15px;
  text-align: left;
}
.rows > button > i {
  width: 4px;
  height: 38px;
  border-radius: 4px;
  background: var(--web);
}
.rows i.telegram {
  background: var(--telegram);
}
.rows i.whatsapp {
  background: var(--whatsapp);
}
.rows > button > span {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.rows strong {
  font-size: 13.5px;
}
.rows small {
  font-size: 12.5px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rows em {
  font-style: normal;
  text-align: right;
}
.rows time {
  display: block;
  color: var(--muted);
  font-size: 10px;
  margin-bottom: 5px;
}
@media (max-width: 600px) {
  .triage {
    padding: 15px;
  }
  .escalated {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .escalated > div {
    min-width: 180px;
  }
  .rows > button {
    padding: 10px;
  }
  .rows > button > i {
    display: none;
  }
  .rows em {
    display: none;
  }
}
</style>
