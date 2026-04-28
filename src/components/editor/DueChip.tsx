/* eslint-disable react-refresh/only-export-components -- module-level spec, not a component file */
import { createReactInlineContentSpec } from '@blocknote/react'
import { CalendarBlank } from '@phosphor-icons/react'
import type { AppLocale } from '@/lib/i18n'
import { dueBucket } from '../tasks/dueBucket'
import { formatDeadline } from '../tasks/formatDeadline'

// Module-level ref for locale (mirrors _wikilinkEntriesRef pattern in editorSchema.tsx)
// Updated by the editor host on mount and locale change via setDueChipLocale()
const _dueChipLocaleRef: { current: AppLocale } = { current: 'en' }

export function setDueChipLocale(locale: AppLocale): void {
  _dueChipLocaleRef.current = locale
}

function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const DueChip = createReactInlineContentSpec(
  {
    type: 'dueChip' as const,
    propSchema: {
      value: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const value = props.inlineContent.props.value
      const locale = _dueChipLocaleRef.current
      const today = getTodayString()
      const bucket = dueBucket(value || null, today)
      const displayText = value ? formatDeadline(value, locale) : ''

      return (
        <span
          className={`due-chip due-chip--${bucket}`}
          data-value={value}
        >
          <CalendarBlank size={11} aria-hidden="true" className="due-chip__icon" />
          {displayText}
        </span>
      )
    },
  },
)
