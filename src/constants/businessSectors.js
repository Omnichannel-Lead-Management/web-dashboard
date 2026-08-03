const sector = (value, label) => Object.freeze({ value, label })

// Values intentionally preserve the payloads historically submitted by the
// dashboard. The backend accepts an open string and existing tenants may carry
// lowercase or custom values, so normalization is deliberately conservative.
export const BUSINESS_SECTORS = Object.freeze([
  sector('Salon', 'Salon'),
  sector('Tutor', 'Tutor'),
  sector('Photography', 'Photography'),
])

const canonicalByCase = new Map(
  BUSINESS_SECTORS.map((option) => [option.value.toLowerCase(), option]),
)

export function normalizeBusinessSector(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return canonicalByCase.get(trimmed.toLowerCase())?.value || trimmed
}

export function isKnownBusinessSector(value) {
  const normalized = normalizeBusinessSector(value)
  return Boolean(normalized && canonicalByCase.has(normalized.toLowerCase()))
}

export function getBusinessSectorLabel(value) {
  const normalized = normalizeBusinessSector(value)
  if (!normalized) return ''
  return canonicalByCase.get(normalized.toLowerCase())?.label || normalized
}

export function getBusinessSectorOptions(currentValue = '') {
  const normalized = normalizeBusinessSector(currentValue)
  if (!normalized || isKnownBusinessSector(normalized)) return BUSINESS_SECTORS
  return Object.freeze([
    Object.freeze({ value: normalized, label: `Current value: ${normalized}` }),
    ...BUSINESS_SECTORS,
  ])
}
