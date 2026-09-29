import { describe, expect, test } from 'bun:test'
import {
  allowanceUsage,
  formatCount,
  formatMoney,
  formatPeriod,
  invoiceStatusLabel,
  invoiceStatusTone,
} from './billingFormat'

describe('formatMoney', () => {
  test('always shows two decimals with the currency code', () => {
    expect(formatMoney(1234.5, 'LKR')).toContain('1,234.50')
    expect(formatMoney(1234.5, 'LKR')).toContain('LKR')
  })

  test('zero is a real amount, not a missing one', () => {
    expect(formatMoney(0, 'LKR')).toContain('0.00')
  })

  test('a missing amount reads as unknown rather than as free', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney('not a number')).toBe('—')
  })

  test('an unknown currency code still renders instead of throwing', () => {
    expect(formatMoney(10, 'NOTACODE')).toBe('NOTACODE 10.00')
  })
})

describe('formatCount', () => {
  test('groups thousands and keeps zero', () => {
    expect(formatCount(12345)).toBe((12345).toLocaleString())
    expect(formatCount(0)).toBe('0')
  })

  test('a missing count is not shown as zero', () => {
    expect(formatCount(null)).toBe('—')
  })
})

describe('formatPeriod', () => {
  test('needs both ends before it will claim a range', () => {
    expect(formatPeriod('2026-09-01', null)).toBe('—')
    expect(formatPeriod('2026-09-01', '2026-09-30')).toContain('–')
  })
})

describe('invoice status', () => {
  test('sent is presented as awaiting payment, not as finished', () => {
    expect(invoiceStatusLabel('sent')).toBe('Awaiting payment')
    expect(invoiceStatusTone('sent')).toBe('warning')
  })

  test('paid and void are visually distinct from each other', () => {
    expect(invoiceStatusTone('paid')).toBe('success')
    expect(invoiceStatusTone('void')).toBe('lost')
  })

  test('an unknown status degrades to draft rather than blank', () => {
    expect(invoiceStatusLabel('something-else')).toBe('Draft')
    expect(invoiceStatusTone('something-else')).toBe('neutral')
  })
})

describe('allowanceUsage', () => {
  test('within the allowance there is nothing to bill', () => {
    const meter = allowanceUsage(250, 500)
    expect(meter.percent).toBe(50)
    expect(meter.over).toBe(0)
  })

  test('the bar caps at full while the label keeps the true figure', () => {
    const meter = allowanceUsage(700, 500)
    expect(meter.percent).toBe(100)
    expect(meter.exact).toBe(140)
    expect(meter.over).toBe(200)
  })

  test('with no allowance every unit is over', () => {
    const meter = allowanceUsage(30, 0)
    expect(meter.over).toBe(30)
    expect(meter.exact).toBeNull()
    expect(meter.percent).toBe(100)
  })

  test('no allowance and no usage is not shown as full', () => {
    expect(allowanceUsage(0, 0).percent).toBe(0)
  })
})
