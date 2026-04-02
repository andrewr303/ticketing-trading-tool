/**
 * Parse common event_date strings from LLM output; compare to "today" in local calendar.
 */
export function parseEventDateString(raw: string): Date | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const iso = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2]) - 1
    const d = Number(iso[3])
    if (y >= 2000 && y < 2100 && m >= 0 && m < 12 && d >= 1 && d <= 31) {
      return new Date(y, m, d)
    }
  }
  const t = Date.parse(trimmed)
  if (!Number.isNaN(t)) {
    const dt = new Date(t)
    if (!Number.isNaN(dt.getTime())) return dt
  }
  return null
}

/** True only when we successfully parse a calendar date and it is before today (local). */
export function isEventDateClearlyInPast(raw: string, now = new Date()): boolean {
  const parsed = parseEventDateString(raw)
  if (!parsed) return false
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return parsed.getTime() < startOfToday.getTime()
}
