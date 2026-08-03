<script setup>
defineProps({
  identity: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
})
defineEmits(['update:identity'])
function update(identity, field, value) {
  return { ...identity, [field]: value }
}
</script>
<template>
  <details class="identity">
    <summary>Personalize this chat</summary>
    <p>
      Optional details are used only to personalize your current chat session.
    </p>
    <div>
      <label>
        First name
        <input
          :value="identity.firstName"
          maxlength="80"
          :disabled="disabled"
          @input="
            $emit(
              'update:identity',
              update(identity, 'firstName', $event.target.value),
            )
          "
        />
      </label>
      <label>
        Last name
        <input
          :value="identity.lastName"
          maxlength="80"
          :disabled="disabled"
          @input="
            $emit(
              'update:identity',
              update(identity, 'lastName', $event.target.value),
            )
          "
        />
      </label>
      <label>
        Language
        <select
          :value="identity.language"
          :disabled="disabled"
          @change="
            $emit(
              'update:identity',
              update(identity, 'language', $event.target.value),
            )
          "
        >
          <option value="en">English</option>
          <option value="si">Sinhala</option>
          <option value="ta">Tamil</option>
        </select>
      </label>
    </div>
  </details>
</template>
<style scoped>
.identity {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: #fafaff;
}
.identity summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}
.identity p {
  font-size: 11px;
  color: var(--muted);
}
.identity > div {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 9px;
}
.identity label {
  display: grid;
  gap: 4px;
  font-size: 11px;
  font-weight: 650;
}
@media (max-width: 560px) {
  .identity > div {
    grid-template-columns: 1fr;
  }
}
</style>
