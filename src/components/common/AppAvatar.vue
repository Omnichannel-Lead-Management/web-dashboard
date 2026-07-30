<script setup>
defineProps({
  initials: {
    type: String,
    default: '',
  },
  channel: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md',
  },
  showDot: {
    type: Boolean,
    default: true,
  },
})
</script>
<template>
  <span class="wrap">
    <span
      class="avatar"
      :class="[`avatar--${size}`, `avatar--${channel.toLowerCase()}`]"
    >
      {{ initials }}
    </span>
    <span
      v-if="channel && showDot"
      class="dot"
      :class="`dot--${channel.toLowerCase()}`"
    />
  </span>
</template>
<style scoped>
.wrap {
  position: relative;
  display: inline-flex;
  flex: none;
}
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  background: #d9def2;
  color: #3b3f88;
}
.avatar--md {
  width: 42px;
  height: 42px;
  font-size: 13px;
}
.avatar--lg {
  width: 56px;
  height: 56px;
  font-size: 16px;
}
.avatar--whatsapp {
  background: #e2f4ec;
  color: #12724d;
}
.avatar--web {
  background: #eceef3;
  color: #565c6e;
}
.dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 16px;
  height: 16px;
  border: 3px solid #fff;
  border-radius: 50%;
}
.dot--telegram {
  background: var(--telegram);
}
.dot--whatsapp {
  background: var(--whatsapp);
}
.dot--web {
  background: var(--web);
}
</style>
