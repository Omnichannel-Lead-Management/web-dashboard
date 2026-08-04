/**
 * Presentation helpers that keep infrastructure detail out of the dashboard.
 *
 * Business owners use this console — not the engineers who run the platform —
 * so identifiers are shown as short human references and failures are reported
 * as something the owner can act on rather than as raw transport errors.
 */

/**
 * Turn a storage identifier (usually a UUID) into a short reference that is
 * still unique enough to quote to support, e.g. `LD-8F3A2C`.
 */
export function shortReference(id, prefix = 'LD') {
  const normalized = String(id ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
  if (!normalized) return ''
  return `${prefix}-${normalized.slice(-6)}`
}

/** Phrases that mean the message came from the transport layer, not the user. */
const TECHNICAL_PATTERNS = [
  /https?:\/\//i,
  /\bwss?:\/\//i,
  /\/api\//i,
  /\/ws\//i,
  /\bfetch\b/i,
  /\bnetworkerror\b/i,
  /\bECONN\w*/i,
  /\bETIMEDOUT\b/i,
  /\bgateway\b/i,
  /\bwebsocket\b/i,
  /\bsocket\b/i,
  /\bproxy\b/i,
  /\bpayload\b/i,
  /\bJSON\b/,
  /\bundefined\b/,
  /\bnull\b/,
  /\bstack\b/i,
  /\bexception\b/i,
  /\bTypeError\b/,
  /\bat\s+\w+\s+\(/,
  /Request failed \(\d+\)/i,
  /\b[45]\d{2}\b/,
]

const STATUS_MESSAGES = {
  400: 'Some of the details entered are not valid. Please review and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do this.',
  404: 'We could not find what you were looking for.',
  409: 'Someone else changed this first. Refresh and try again.',
  413: 'That file is too large to upload.',
  429: 'Too many attempts. Please wait a moment and try again.',
}

const DEFAULT_MESSAGE = 'Something went wrong. Please try again in a moment.'

/**
 * Convert a thrown error into copy that is safe to render in the dashboard.
 *
 * A message that reads like a human sentence (typically a validation message
 * written by the platform for this exact situation) is passed through; anything
 * that exposes transport, routing or runtime detail is replaced.
 */
export function friendlyErrorMessage(error, fallback = DEFAULT_MESSAGE) {
  if (!error) return fallback

  const status = typeof error === 'object' ? error.status : undefined
  const raw = (typeof error === 'string' ? error : error.message || '').trim()

  if (status >= 500)
    return 'The service is temporarily unavailable. Please try again shortly.'
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status]

  if (!raw) return fallback
  if (raw.length > 160) return fallback
  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(raw))) return fallback

  return raw
}
