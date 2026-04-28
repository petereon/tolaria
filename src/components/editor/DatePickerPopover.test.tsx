import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DatePickerPopover } from './DatePickerPopover'

const TODAY_ISO = '2025-06-15'
const TOMORROW_ISO = '2025-06-16'
const NEXT_WEEK_ISO = '2025-06-22'

describe('DatePickerPopover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'))
  })

  it('renders nothing when open is false', () => {
    const { container } = render(
      <DatePickerPopover
        open={false}
        anchorRect={null}
        selected={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(container.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument()
  })

  it('clicking Today fires onSelect with today\'s ISO string', () => {
    const onSelect = vi.fn()
    render(
      <DatePickerPopover
        open
        anchorRect={null}
        selected={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(onSelect).toHaveBeenCalledWith(TODAY_ISO)
  })

  it('clicking Tomorrow fires onSelect with tomorrow\'s ISO string', () => {
    const onSelect = vi.fn()
    render(
      <DatePickerPopover
        open
        anchorRect={null}
        selected={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(onSelect).toHaveBeenCalledWith(TOMORROW_ISO)
  })

  it('clicking Next week fires onSelect with today + 7 days ISO string', () => {
    const onSelect = vi.fn()
    render(
      <DatePickerPopover
        open
        anchorRect={null}
        selected={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(onSelect).toHaveBeenCalledWith(NEXT_WEEK_ISO)
  })

  it('clicking Clear fires onSelect(null)', () => {
    const onSelect = vi.fn()
    render(
      <DatePickerPopover
        open
        anchorRect={null}
        selected={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('uses locale-aware button labels from translate', () => {
    render(
      <DatePickerPopover
        open
        anchorRect={null}
        selected={null}
        locale="zh-CN"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '今天' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '明天' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下周' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument()
  })
})
