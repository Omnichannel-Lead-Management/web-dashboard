<script setup>
import { computed } from 'vue'
import { Image } from 'lucide-vue-next'
import { imageAttachmentsEnabled } from '../../config'
import {
  IMAGE_ATTACHMENT_ACCEPTED_TYPES,
  IMAGE_ATTACHMENT_MAX_BYTES,
} from '../../services/imageAttachments'
import AppBadge from '../common/AppBadge.vue'

/** Show `JPG, PNG` rather than the underlying media types. */
const acceptedFormats = computed(() =>
  IMAGE_ATTACHMENT_ACCEPTED_TYPES.map((type) =>
    type
      .replace(/^image\//, '')
      .replace('jpeg', 'jpg')
      .toUpperCase(),
  ).join(', '),
)

const maximumSize = computed(
  () => `${Math.round(IMAGE_ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB`,
)
</script>

<template>
  <section class="image-settings">
    <header class="section-head">
      <span class="section-icon"><Image :size="22" /></span>
      <div>
        <h2>Image attachments</h2>
        <p>Photos customers can send you in a conversation.</p>
      </div>
      <AppBadge :tone="imageAttachmentsEnabled ? 'success' : 'neutral'">
        {{ imageAttachmentsEnabled ? 'Active' : 'Off' }}
      </AppBadge>
    </header>

    <p class="lead">
      Customers can attach a photo — a receipt, a product, a problem they want
      to show you — and it appears in the conversation in your Inbox.
    </p>

    <dl>
      <div>
        <dt>Accepted formats</dt>
        <dd>{{ acceptedFormats }}</dd>
      </div>
      <div>
        <dt>Maximum size</dt>
        <dd>{{ maximumSize }}</dd>
      </div>
    </dl>

    <p v-if="!imageAttachmentsEnabled" class="notice">
      Image attachments are switched off for this workspace. Contact your
      administrator to turn them on.
    </p>
  </section>
</template>

<style scoped>
.image-settings {
  display: grid;
  gap: 20px;
}
.lead {
  margin: 0;
  color: var(--text-2);
  font-size: var(--fs-base);
  line-height: 1.65;
  max-width: 60ch;
}
dl {
  display: grid;
  gap: 0;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
dl div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  font-size: var(--fs-base);
}
dl div + div {
  border-top: 1px solid var(--border-soft);
}
dt {
  color: var(--muted);
  font-weight: 600;
}
dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}
</style>
