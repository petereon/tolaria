export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'thisweek' | 'later' | 'none'

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dueBucket(deadline: string | null, today: string): DueBucket {
  if (deadline === null) return 'none'
  if (deadline < today) return 'overdue'
  if (deadline === today) return 'today'
  if (deadline === addDays(today, 1)) return 'tomorrow'
  if (deadline < addDays(today, 7)) return 'thisweek'
  return 'later'
}
