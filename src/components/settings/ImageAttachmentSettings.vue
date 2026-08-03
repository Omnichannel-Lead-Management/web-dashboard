<script setup>
import { Image, ShieldAlert } from 'lucide-vue-next'
import { imageAttachmentsEnabled } from '../../config'
import {
  IMAGE_ATTACHMENT_ACCEPTED_TYPES,
  IMAGE_ATTACHMENT_MAX_BYTES,
} from '../../services/imageAttachments'
import AppBadge from '../common/AppBadge.vue'
</script>

<template>
  <section class="image-settings">
    <header>
      <Image :size="22" />
      <div>
        <h2>Image attachments</h2>
        <p>Safe image sharing for customer conversations.</p>
      </div>
      <AppBadge :tone="imageAttachmentsEnabled ? 'success' : 'neutral'">
        {{ imageAttachmentsEnabled ? 'Enabled' : 'Disabled' }}
      </AppBadge>
    </header>
    <div class="dependency" role="note">
      <ShieldAlert :size="18" />
      <p>
        <b>Gateway dependency.</b>
        Image sending requires secure storage behind
        <code>POST /api/upload-image</code>
        . Agent image replies additionally require an agent media-send contract.
      </p>
    </div>
    <dl>
      <div>
        <dt>Accepted</dt>
        <dd>{{ IMAGE_ATTACHMENT_ACCEPTED_TYPES.join(', ') }}</dd>
      </div>
      <div>
        <dt>Maximum size</dt>
        <dd>{{ IMAGE_ATTACHMENT_MAX_BYTES / 1024 / 1024 }} MB</dd>
      </div>
      <div>
        <dt>Ready surfaces</dt>
        <dd>Web chat upload/send; inbox inbound rendering</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.image-settings {
  display: grid;
  gap: 20px;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
}
header div {
  flex: 1;
}
h2,
p {
  margin: 0;
}
header p {
  color: var(--muted);
  font-size: 12px;
}
.dependency {
  display: flex;
  gap: 10px;
  padding: 13px;
  border: 1px solid #f1e5bd;
  border-radius: 11px;
  color: #795b00;
  background: #fff8e3;
  font-size: 12px;
}
dl {
  display: grid;
  gap: 10px;
  margin: 0;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--border);
}
dt {
  font-weight: 700;
}
dd {
  margin: 0;
  color: var(--text-2);
  text-align: right;
}
</style>
