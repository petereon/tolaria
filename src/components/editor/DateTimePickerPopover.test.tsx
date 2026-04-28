import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DateTimePickerPopover } from './DateTimePickerPopover'

const TODAY_ISO = '2026-04-29'

describe('DateTimePickerPopover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when open is false', () => {
    const { container } = render(
      <DateTimePickerPopover
        open={false}
        anchorRect={null}
        selected={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-slot="popover-content"]')).not.toBeInTheDocument()
  })

  it('today + default time (17:00) + switch ON → fires with datetime', () => {
    const onSelect = vi.fn()
    render(
      <DateTimePickerPopover
        open
        anchorRect={null}
        selected={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    // Switch should be ON by default
    const switchEl = screen.getByRole('switch', { name: /set time/i })
    expect(switchEl).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /today/i }))
    expect(onSelect).toHaveBeenCalledWith(`${TODAY_ISO}T17:00`)
  })

  it('toggle switch OFF then click Today → fires date-only', () => {
    const onSelect = vi.fn()
    render(
      <DateTimePickerPopover
        open
        anchorRect={null}
        selected={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    const switchEl = screen.getByRole('switch', { name: /set time/i })
    // Turn off the switch
    fireEvent.click(switchEl)
    expect(switchEl).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /today/i }))
    expect(onSelect).toHaveBeenCalledWith(TODAY_ISO)
  })

  it('selected 2024-12-15T09:30 populates inputs with 09 and 30', () => {
    render(
      <DateTimePickerPopover
        open
        anchorRect={null}
        selected="2024-12-15T09:30"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const hourInput = screen.getByRole('spinbutton', { name: /hour/i })
    const minuteInput = screen.getByRole('spinbutton', { name: /minute/i })
    expect(hourInput).toHaveValue(9)
    expect(minuteInput).toHaveValue(30)
    // Switch should be ON since datetime provided
    expect(screen.getByRole('switch', { name: /set time/i })).toBeChecked()
  })

  it('clear → fires null', () => {
    const onSelect = vi.fn()
    render(
      <DateTimePickerPopover
        open
        anchorRect={null}
        selected={null}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('locale-aware button labels (zh-Hans)', () => {
    render(
      <DateTimePickerPopover
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

  it('date-only selected string populates date with switch OFF by default unless T present', () => {
    render(
      <DateTimePickerPopover
        open
        anchorRect={null}
        selected="2024-06-15"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // No time component - switch should remain ON (default) but no T in value
    // hour/minute inputs should show default 17:00
    const hourInput = screen.getByRole('spinbutton', { name: /hour/i })
    const minuteInput = screen.getByRole('spinbutton', { name: /minute/i })
    expect(hourInput).toHaveValue(17)
    expect(minuteInput).toHaveValue(0)
  })
})
