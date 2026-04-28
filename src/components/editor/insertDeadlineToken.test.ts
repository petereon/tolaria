import { describe, expect, it } from 'vitest'
import { insertDeadlineToken } from './insertDeadlineToken'

describe('insertDeadlineToken', () => {
  it('appends due: to a bare line', () => {
    expect(insertDeadlineToken('write report', '2024-12-15')).toBe(
      'write report due:2024-12-15',
    )
  })

  it('replaces an existing due: token without stacking', () => {
    expect(insertDeadlineToken('write report due:2024-01-01', '2024-12-15')).toBe(
      'write report due:2024-12-15',
    )
  })

  it('replaces @YYYY-MM-DD form with due: canonical form', () => {
    expect(insertDeadlineToken('write report @2024-01-01', '2024-12-15')).toBe(
      'write report due:2024-12-15',
    )
  })

  it('replaces 📅YYYY-MM-DD form with due: canonical form', () => {
    expect(insertDeadlineToken('write report 📅2024-01-01', '2024-12-15')).toBe(
      'write report due:2024-12-15',
    )
  })

  it('clears deadline when isoDate is null', () => {
    expect(insertDeadlineToken('write report due:2024-12-15', null)).toBe(
      'write report',
    )
  })

  it('preserves checkbox prefix and any non-deadline text in between', () => {
    expect(insertDeadlineToken('- [ ] write report due:2024-12-15', '2025-03-01')).toBe(
      '- [ ] write report due:2025-03-01',
    )
  })

  it('returns due:<iso> with no leading space when text is empty', () => {
    expect(insertDeadlineToken('', '2024-12-15')).toBe('due:2024-12-15')
  })

  it('returns empty string when text is empty and isoDate is null', () => {
    expect(insertDeadlineToken('', null)).toBe('')
  })

  it('collapses double spaces left by token removal', () => {
    expect(insertDeadlineToken('write  report due:2024-01-01', null)).toBe(
      'write report',
    )
  })

  it('handles @form without stacking when replacing with same date', () => {
    expect(insertDeadlineToken('task @2024-06-15', '2024-06-15')).toBe(
      'task due:2024-06-15',
    )
  })

  // datetime support
  it('replaces existing date-only due: with new datetime', () => {
    expect(insertDeadlineToken('write report due:2024-01-01', '2024-12-15T17:00')).toBe(
      'write report due:2024-12-15T17:00',
    )
  })

  it('replaces existing datetime due: with date-only (when picker drops the time)', () => {
    expect(insertDeadlineToken('write report due:2024-01-01T09:30', '2024-12-15')).toBe(
      'write report due:2024-12-15',
    )
  })

  it('strips @YYYY-MM-DDTHH:MM form', () => {
    expect(insertDeadlineToken('task @2024-12-15T14:30', '2025-01-01')).toBe(
      'task due:2025-01-01',
    )
  })

  it('strips 📅YYYY-MM-DDTHH:MM form', () => {
    expect(insertDeadlineToken('task 📅2024-12-15T14:30', '2025-01-01')).toBe(
      'task due:2025-01-01',
    )
  })

  it('clears datetime deadline when isoDate is null', () => {
    expect(insertDeadlineToken('task due:2024-12-15T17:00', null)).toBe(
      'task',
    )
  })

  it('appends datetime due: when text is empty', () => {
    expect(insertDeadlineToken('', '2024-12-15T17:00')).toBe('due:2024-12-15T17:00')
  })
})
