import { describe, expect, test } from 'bun:test'
import {
  BUSINESS_SECTORS,
  getBusinessSectorLabel,
  getBusinessSectorOptions,
  isKnownBusinessSector,
  normalizeBusinessSector,
} from './businessSectors'

describe('shared business sectors', () => {
  test('has immutable, unique, deterministic canonical options', () => {
    expect(BUSINESS_SECTORS.length).toBeGreaterThan(0)
    expect(Object.isFrozen(BUSINESS_SECTORS)).toBe(true)
    expect(BUSINESS_SECTORS.every(Object.isFrozen)).toBe(true)
    const values = BUSINESS_SECTORS.map((option) => option.value)
    const labels = BUSINESS_SECTORS.map((option) => option.label)
    expect(new Set(values).size).toBe(values.length)
    expect(new Set(labels.map((label) => label.toLowerCase())).size).toBe(
      labels.length,
    )
    expect(values.every((value) => typeof value === 'string' && value)).toBe(
      true,
    )
    expect(labels.every((label) => typeof label === 'string' && label)).toBe(
      true,
    )
    expect(values).toEqual(['Salon', 'Tutor', 'Photography'])
    expect(
      labels.filter((label) => label.toLowerCase() === 'other'),
    ).toHaveLength(0)
  })

  test('normalizes only verified casing and preserves unknown values', () => {
    expect(normalizeBusinessSector('Salon')).toBe('Salon')
    expect(normalizeBusinessSector(' salon ')).toBe('Salon')
    expect(normalizeBusinessSector('PHOTOGRAPHY')).toBe('Photography')
    expect(normalizeBusinessSector('Healthcare')).toBe('Healthcare')
    expect(normalizeBusinessSector('  Food Service  ')).toBe('Food Service')
    expect(normalizeBusinessSector('')).toBe('')
    expect(normalizeBusinessSector(null)).toBe('')
    expect(normalizeBusinessSector(undefined)).toBe('')
    expect(isKnownBusinessSector('tutor')).toBe(true)
    expect(isKnownBusinessSector('Healthcare')).toBe(false)
  })

  test('returns safe labels and a non-mutating legacy option', () => {
    const before = structuredClone(BUSINESS_SECTORS)
    expect(getBusinessSectorLabel('salon')).toBe('Salon')
    expect(getBusinessSectorLabel(' Healthcare ')).toBe('Healthcare')
    expect(getBusinessSectorLabel(null)).toBe('')
    const options = getBusinessSectorOptions('Healthcare')
    expect(options[0]).toEqual({
      value: 'Healthcare',
      label: 'Current value: Healthcare',
    })
    expect(Object.isFrozen(options)).toBe(true)
    expect(BUSINESS_SECTORS).toEqual(before)
    expect(getBusinessSectorOptions('salon')).toBe(BUSINESS_SECTORS)
  })
})
