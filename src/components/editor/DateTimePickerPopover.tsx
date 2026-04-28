import { useState, type CSSProperties } from 'react'
import { addDays, format } from 'date-fns'
import { CalendarBlank } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import { translate, type AppLocale } from '@/lib/i18n'

export interface DateTimePickerPopoverProps {
  open: boolean
  anchorRect: DOMRect | null
  selected: string | null
  locale?: AppLocale
  onSelect: (iso: string | null) => void
  onClose: () => void
}

const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateOnlyIso(value: string | null): string | undefined {
  if (!value) return undefined
  const dtMatch = DATETIME_RE.exec(value)
  if (dtMatch) return dtMatch[1]
  if (DATE_ONLY_RE.test(value)) return value
  return undefined
}

function parseTimeFromIso(value: string | null): { hour: number; minute: number } {
  if (value) {
    const dtMatch = DATETIME_RE.exec(value)
    if (dtMatch) {
      return { hour: parseInt(dtMatch[2], 10), minute: parseInt(dtMatch[3], 10) }
    }
  }
  return { hour: 17, minute: 0 }
}

function hasTimeComponent(value: string | null): boolean {
  return value !== null && DATETIME_RE.test(value)
}

function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const parsed = new Date(`${iso}T00:00:00`)
  return isNaN(parsed.getTime()) ? undefined : parsed
}

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function offsetIso(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

function clampHour(val: number): number {
  return Math.min(23, Math.max(0, val))
}

function clampMinute(val: number): number {
  return Math.min(59, Math.max(0, val))
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

export function DateTimePickerPopover({
  open,
  anchorRect,
  selected,
  locale = 'en',
  onSelect,
  onClose,
}: DateTimePickerPopoverProps) {
  const initialTime = parseTimeFromIso(selected)
  const initialDateOnly = parseDateOnlyIso(selected)
  const initialWithTime = hasTimeComponent(selected)

  const [withTime, setWithTime] = useState(initialWithTime || true)
  const [hour, setHour] = useState(initialTime.hour)
  const [minute, setMinute] = useState(initialTime.minute)
  const [selectedDateIso, setSelectedDateIso] = useState<string | undefined>(initialDateOnly)

  const selectedDate = isoToDate(selectedDateIso)

  function buildIso(dateIso: string): string {
    if (withTime) {
      return `${dateIso}T${padTwo(hour)}:${padTwo(minute)}`
    }
    return dateIso
  }

  const anchorStyle: CSSProperties = anchorRect
    ? {
        position: 'fixed',
        top: anchorRect.bottom,
        left: anchorRect.left,
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }

  function handleQuickPick(dateIso: string) {
    setSelectedDateIso(dateIso)
    onSelect(buildIso(dateIso))
  }

  function handleCalendarSelect(day: Date | undefined) {
    if (!day) return
    const dateIso = format(day, 'yyyy-MM-dd')
    setSelectedDateIso(dateIso)
    onSelect(buildIso(dateIso))
  }

  function handleHourBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = clampHour(parseInt(e.target.value, 10) || 0)
    setHour(val)
    if (selectedDateIso) {
      onSelect(withTime ? `${selectedDateIso}T${padTwo(val)}:${padTwo(minute)}` : selectedDateIso)
    }
  }

  function handleMinuteBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = clampMinute(parseInt(e.target.value, 10) || 0)
    setMinute(val)
    if (selectedDateIso) {
      onSelect(withTime ? `${selectedDateIso}T${padTwo(hour)}:${padTwo(val)}` : selectedDateIso)
    }
  }

  function handleSwitchChange(checked: boolean) {
    setWithTime(checked)
    if (selectedDateIso) {
      onSelect(checked ? `${selectedDateIso}T${padTwo(hour)}:${padTwo(minute)}` : selectedDateIso)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <PopoverAnchor asChild>
        <div style={anchorStyle} aria-hidden />
      </PopoverAnchor>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onInteractOutside={onClose}
        onEscapeKeyDown={onClose}
      >
        <div className="flex gap-1 border-b border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleQuickPick(todayIso())}
          >
            <CalendarBlank size={14} className="shrink-0" />
            {translate(locale, 'editor.date.today')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleQuickPick(offsetIso(1))}
          >
            {translate(locale, 'editor.date.tomorrow')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleQuickPick(offsetIso(7))}
          >
            {translate(locale, 'editor.date.nextWeek')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(null)}
          >
            {translate(locale, 'editor.date.clear')}
          </Button>
        </div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleCalendarSelect}
        />
        <div className="border-t border-border p-2">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              id="due-set-time"
              checked={withTime}
              onCheckedChange={handleSwitchChange}
              aria-label={translate(locale, 'editor.date.setTime')}
            />
            <span className="text-sm select-none">
              {translate(locale, 'editor.date.setTime')}
            </span>
          </div>
          {withTime && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                inputMode="numeric"
                aria-label="Hour"
                min={0}
                max={23}
                maxLength={2}
                value={hour}
                onChange={(e) => setHour(parseInt(e.target.value, 10) || 0)}
                onBlur={handleHourBlur}
                className="w-14 text-center"
              />
              <span className="text-sm text-muted-foreground">:</span>
              <Input
                type="number"
                inputMode="numeric"
                aria-label="Minute"
                min={0}
                max={59}
                maxLength={2}
                value={minute}
                onChange={(e) => setMinute(parseInt(e.target.value, 10) || 0)}
                onBlur={handleMinuteBlur}
                className="w-14 text-center"
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
