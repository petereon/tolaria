import { describe, it, expect } from 'vitest'
import { dueBucket } from './dueBucket'

describe('dueBucket', () => {
  const today = '2026-04-27'

  it('returns none when deadline is null', () => {
    expect(dueBucket(null, today)).toBe('none')
  })

  it('returns overdue when deadline is before today', () => {
    expect(dueBucket('2026-04-26', today)).toBe('overdue')
    expect(dueBucket('2026-01-01', today)).toBe('overdue')
  })

  it('returns today when deadline equals today', () => {
    expect(dueBucket('2026-04-27', today)).toBe('today')
  })

  it('returns tomorrow when deadline is today+1', () => {
    expect(dueBucket('2026-04-28', today)).toBe('tomorrow')
  })

  it('returns thisweek when deadline is within 7 days from today (exclusive of tomorrow)', () => {
    expect(dueBucket('2026-04-29', today)).toBe('thisweek')
    expect(dueBucket('2026-04-30', today)).toBe('thisweek')
    expect(dueBucket('2026-05-03', today)).toBe('thisweek')
  })

  it('returns later when deadline is beyond 7 days', () => {
    expect(dueBucket('2026-05-04', today)).toBe('later')
    expect(dueBucket('2027-01-01', today)).toBe('later')
  })

  it('handles month/year boundaries correctly for overdue', () => {
    expect(dueBucket('2025-12-31', today)).toBe('overdue')
  })

  it('returns later for exactly 7 days away', () => {
    expect(dueBucket('2026-05-04', today)).toBe('later')
  })

  it('accepts datetime string and strips the time part for bucket calculation', () => {
    expect(dueBucket('2026-04-27T14:30', today)).toBe('today')
    expect(dueBucket('2026-04-26T23:59', today)).toBe('overdue')
    expect(dueBucket('2026-04-28T09:00', today)).toBe('tomorrow')
  })
})
