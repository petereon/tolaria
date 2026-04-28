import type { CSSProperties } from 'react'
import { addDays, format } from 'date-fns'
import { CalendarBlank } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import { translate, type AppLocale } from '@/lib/i18n'

export interface DatePickerPopoverProps {
  open: boolean
  anchorRect: DOMRect | null
  selected: string | null
  locale?: AppLocale
  onSelect: (iso: string | null) => void
  onClose: () => void
}

function isoToDate(iso: string | null): Date | undefined {
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

export function DatePickerPopover({
  open,
  anchorRect,
  selected,
  locale = 'en',
  onSelect,
  onClose,
}: DatePickerPopoverProps) {
  const selectedDate = isoToDate(selected)

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
            onClick={() => onSelect(todayIso())}
          >
            <CalendarBlank size={14} className="shrink-0" />
            {translate(locale, 'editor.date.today')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(offsetIso(1))}
          >
            {translate(locale, 'editor.date.tomorrow')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelect(offsetIso(7))}
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
          onSelect={(day) => {
            if (day) onSelect(format(day, 'yyyy-MM-dd'))
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
