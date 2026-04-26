const DEADLINE_PATTERN = /\s*(?:due:\d{4}-\d{2}-\d{2}|@\d{4}-\d{2}-\d{2}|📅\d{4}-\d{2}-\d{2})\b/g

function stripDeadlineTokens(text: string): string {
  return text.replace(DEADLINE_PATTERN, '')
}

function collapseWhitespace(text: string): string {
  return text.replace(/  +/g, ' ').trimEnd()
}

export function insertDeadlineToken(text: string, isoDate: string | null): string {
  const cleaned = collapseWhitespace(stripDeadlineTokens(text))

  if (isoDate === null) return cleaned

  if (cleaned === '') return `due:${isoDate}`

  return `${cleaned} due:${isoDate}`
}
