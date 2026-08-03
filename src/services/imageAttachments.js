export const IMAGE_ATTACHMENT_ACCEPTED_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
])
export const IMAGE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

let attachmentSequence = 0
const revokedDrafts = new WeakSet()

function clean(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function validateImageAttachment(file) {
  if (!file || typeof file !== 'object' || typeof file.size !== 'number')
    throw new Error('Select a valid image file')
  if (!IMAGE_ATTACHMENT_ACCEPTED_TYPES.includes(file.type))
    throw new Error('Choose a JPEG, PNG, or WebP image')
  if (!Number.isFinite(file.size) || !Number.isInteger(file.size))
    throw new Error('The selected image has an invalid file size')
  if (file.size <= 0) throw new Error('The selected image is empty')
  if (file.size > IMAGE_ATTACHMENT_MAX_BYTES)
    throw new Error('Image must be 5 MB or smaller')
  return true
}

export function createImageAttachmentDraft(
  file,
  { createObjectURL = (value) => URL.createObjectURL(value) } = {},
) {
  validateImageAttachment(file)
  attachmentSequence += 1
  return {
    id: `image-${Date.now()}-${attachmentSequence}`,
    file,
    fileName: clean(file.name, 240) || 'Selected image',
    mimeType: file.type,
    size: file.size,
    previewUrl: createObjectURL(file),
    caption: '',
    status: 'selected',
    uploadedUrl: '',
    messageId: '',
    error: '',
  }
}

export function revokeImageAttachmentPreview(
  draft,
  { revokeObjectURL = (value) => URL.revokeObjectURL(value) } = {},
) {
  const preview = clean(draft?.previewUrl)
  if (
    !preview ||
    !draft ||
    typeof draft !== 'object' ||
    revokedDrafts.has(draft)
  )
    return false
  revokedDrafts.add(draft)
  revokeObjectURL(preview)
  return true
}

export function isSafeRemoteImageUrl(value) {
  if (typeof value !== 'string' || value !== value.trim()) return false
  const candidate = clean(value, 2048)
  if (!candidate || /[\u0000-\u001f\u007f]/.test(candidate)) return false
  if (/\s/.test(candidate) || candidate.startsWith('//')) return false
  try {
    const url = new URL(candidate)
    if (url.protocol === 'https:') return true
    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

export function normalizeRemoteImageUrl(value) {
  const candidate = clean(value, 2048)
  return isSafeRemoteImageUrl(candidate) ? candidate : ''
}

export function mapUploadedImageResponse(value) {
  if (!value || typeof value !== 'object' || value.success !== true)
    throw new Error('Gateway returned an invalid image-upload response')
  const url = normalizeRemoteImageUrl(
    value.url || value.image_url || value.imageUrl,
  )
  if (!url) throw new Error('Gateway returned an unsafe image URL')
  return {
    url,
    mediaId: clean(value.media_id || value.mediaId || value.request_id, 200),
    mimeType: clean(value.mime_type || value.mimeType, 100),
    size: Number.isFinite(value.size) ? value.size : 0,
  }
}
