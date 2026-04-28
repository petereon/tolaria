import { describe, expect, it } from 'vitest'
import { formatDeadline, localeFor } from './formatDeadline'

describe('localeFor', () => {
  it('maps en to en-US', () => {
    expect(localeFor('en')).toBe('en-US')
  })

  it('maps zh-CN to zh-CN', () => {
    expect(localeFor('zh-CN')).toBe('zh-CN')
  })

  it('maps other locales pass-through', () => {
    expect(localeFor('fr-FR')).toBe('fr-FR')
    expect(localeFor('de-DE')).toBe('de-DE')
  })
})

describe('formatDeadline', () => {
  it('formats date-only string using Intl.DateTimeFormat en-US dateStyle medium', () => {
    const value = '2024-12-15'
    const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
      new Date('2024-12-15T00:00:00'),
    )
    expect(formatDeadline(value, 'en')).toBe(expected)
  })

  it('formats datetime string using Intl.DateTimeFormat en-US dateStyle+timeStyle', () => {
    const value = '2024-12-15T14:30'
    const expected = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
    const result = formatDeadline(value, 'en')
    expect(result).toBe(expected)
  })

  it('datetime output contains the time component', () => {
    const value = '2024-12-15T02:30'
    const result = formatDeadline(value, 'en')
    expect(result).toContain('2:30')
  })

  it('formats date-only with Chinese locale matching Intl ground truth', () => {
    const value = '2024-12-15'
    const expected = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(
      new Date('2024-12-15T00:00:00'),
    )
    expect(formatDeadline(value, 'zh-CN')).toBe(expected)
  })

  it('formats datetime with Chinese locale matching Intl ground truth', () => {
    const value = '2024-12-15T09:00'
    const expected = new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
    expect(formatDeadline(value, 'zh-CN')).toBe(expected)
  })

  it('returns invalid string unchanged', () => {
    expect(formatDeadline('not-a-date', 'en')).toBe('not-a-date')
    expect(formatDeadline('', 'en')).toBe('')
    expect(formatDeadline('2024', 'en')).toBe('2024')
  })
})
