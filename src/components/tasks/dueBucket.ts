export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'thisweek' | 'later' | 'none'

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function stripTime(deadline: string): string {
  const tIdx = deadline.indexOf('T')
  return tIdx !== -1 ? deadline.slice(0, tIdx) : deadline
}

export function dueBucket(deadline: string | null, today: string): DueBucket {
  if (deadline === null) return 'none'
  const dateOnly = stripTime(deadline)
  if (dateOnly < today) return 'overdue'
  if (dateOnly === today) return 'today'
  if (dateOnly === addDays(today, 1)) return 'tomorrow'
  if (dateOnly < addDays(today, 7)) return 'thisweek'
  return 'later'
}
