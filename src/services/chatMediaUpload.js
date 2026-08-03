import { GATEWAY_URL, imageAttachmentsEnabled } from '../config'
import {
  mapUploadedImageResponse,
  validateImageAttachment,
} from './imageAttachments'

export async function uploadChatImage({
  file,
  signal,
  enabled = imageAttachmentsEnabled,
  gatewayUrl = GATEWAY_URL,
  fetchImpl = globalThis.fetch,
  FormDataImpl = globalThis.FormData,
} = {}) {
  if (!enabled) throw new Error('Image attachments are not enabled')
  validateImageAttachment(file)
  const form = new FormDataImpl()
  form.append('file', file)
  const response = await fetchImpl(
    `${String(gatewayUrl).replace(/\/$/, '')}/api/upload-image`,
    { method: 'POST', body: form, signal },
  )
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const error = new Error(
      body?.message ||
        body?.error ||
        `Image upload failed (${response.status})`,
    )
    error.status = response.status
    error.body = body
    throw error
  }
  return mapUploadedImageResponse(body)
}
