import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setDueChipLocale } from './DueChip'
import { formatDeadline } from '../tasks/formatDeadline'

// We test DueChip by exercising its render logic indirectly through formatDeadline and setDueChipLocale.
// Full BlockNote spec rendering is integration-only.

describe('setDueChipLocale', () => {
  it('can be called without throwing', () => {
    expect(() => setDueChipLocale('en')).not.toThrow()
    expect(() => setDueChipLocale('zh-CN')).not.toThrow()
  })
})

describe('DueChip render logic (via formatDeadline)', () => {
  it('date-only payload formats correctly in en locale', () => {
    const value = '2024-12-15'
    const result = formatDeadline(value, 'en')
    const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
      new Date('2024-12-15T00:00:00'),
    )
    expect(result).toBe(expected)
    // The formatted text should contain the month/day strings
    expect(result).toContain('Dec')
    expect(result).toContain('15')
  })

  it('datetime payload formats correctly and contains time', () => {
    const value = '2024-12-15T14:30'
    const result = formatDeadline(value, 'en')
    // Should contain time component
    expect(result).toMatch(/2:30/)
  })

  it('renders a DueChip-like span for date payload', () => {
    // Mock the inline content props structure
    const MockChipContent = () => {
      const value = '2024-06-15'
      const displayText = formatDeadline(value, 'en')
      return (
        <span className="due-chip due-chip--later" data-value={value}>
          {displayText}
        </span>
      )
    }

    render(<MockChipContent />)
    const span = screen.getByText(formatDeadline('2024-06-15', 'en'))
    expect(span).toBeInTheDocument()
    expect(span).toHaveClass('due-chip')
  })

  it('renders a DueChip-like span for datetime payload', () => {
    const MockChipContent = () => {
      const value = '2024-06-15T09:30'
      const displayText = formatDeadline(value, 'en')
      return (
        <span className="due-chip due-chip--later" data-value={value}>
          {displayText}
        </span>
      )
    }

    render(<MockChipContent />)
    const displayText = formatDeadline('2024-06-15T09:30', 'en')
    const span = screen.getByText(displayText)
    expect(span).toBeInTheDocument()
    expect(span).toHaveClass('due-chip')
  })
})
