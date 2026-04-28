const DEADLINE_PATTERN = /\s*(?:due:\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?|@\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?|📅\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)\b/g

function stripDeadlineTokens(text: string): string {
  return text.replace(DEADLINE_PATTERN, '')
}

function collapseWhitespace(text: string): string {
  return text.replace(/  +/g, ' ').trimEnd()
}

export function insertDeadlineToken(text: string, isoValue: string | null): string {
  const cleaned = collapseWhitespace(stripDeadlineTokens(text))

  if (isoValue === null) return cleaned

  if (cleaned === '') return `due:${isoValue}`

  return `${cleaned} due:${isoValue}`
}
