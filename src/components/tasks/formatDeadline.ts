import type { AppLocale } from '@/lib/i18n'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function localeFor(locale: AppLocale): string {
  if (locale === 'en') return 'en-US'
  return locale
}

export function formatDeadline(value: string, locale: AppLocale): string {
  const bcp = localeFor(locale)

  if (DATETIME_RE.test(value)) {
    return new Intl.DateTimeFormat(bcp, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  }

  if (DATE_ONLY_RE.test(value)) {
    return new Intl.DateTimeFormat(bcp, {
      dateStyle: 'medium',
    }).format(new Date(`${value}T00:00:00`))
  }

  return value
}
