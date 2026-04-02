// Ticketmaster Discovery API v2 client
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/

const TM_BASE = 'https://app.ticketmaster.com/discovery/v2'

interface TicketmasterEvent {
  name: string
  id: string
  url?: string
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string }
    status?: { code?: string }
    timezone?: string
  }
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>
  _embedded?: {
    venues?: Array<{ name?: string; city?: { name?: string }; state?: { stateCode?: string }; country?: { countryCode?: string } }>
    attractions?: Array<{ name?: string; classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }> }>
  }
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }>
  sales?: {
    public?: { startDateTime?: string; endDateTime?: string }
    presales?: Array<{ name?: string; startDateTime?: string; endDateTime?: string }>
  }
}

interface TicketmasterResponse {
  _embedded?: { events?: TicketmasterEvent[] }
  page?: { totalElements?: number; totalPages?: number; number?: number; size?: number }
}

export interface FormattedEvent {
  name: string
  date: string
  time: string
  venue: string
  city: string
  state: string
  category: string
  genre: string
  priceRange: string
  url: string
  saleStatus: string
  presales: string[]
  ticketmasterId: string
}

// Map TM segment names to our category names
function mapCategory(segment?: string): string {
  if (!segment) return 'other'
  const s = segment.toLowerCase()
  if (s.includes('music')) return 'concert'
  if (s.includes('sport')) return 'sports'
  if (s.includes('arts') || s.includes('theatre') || s.includes('theater')) return 'theater'
  if (s.includes('comedy') || s.includes('film')) return 'comedy'
  return 'other'
}

function formatEvent(ev: TicketmasterEvent): FormattedEvent {
  const venue = ev._embedded?.venues?.[0]
  const classification = ev.classifications?.[0]
  const priceRange = ev.priceRanges?.[0]
  const presales = ev.sales?.presales?.map(p =>
    `${p.name || 'Presale'}: ${p.startDateTime ? new Date(p.startDateTime).toLocaleString() : 'TBD'}`
  ) || []

  return {
    name: ev.name,
    date: ev.dates?.start?.localDate || '',
    time: ev.dates?.start?.localTime || '',
    venue: venue?.name || '',
    city: venue?.city?.name || '',
    state: venue?.state?.stateCode || '',
    category: mapCategory(classification?.segment?.name),
    genre: classification?.genre?.name || '',
    priceRange: priceRange ? `$${priceRange.min ?? '?'}-$${priceRange.max ?? '?'}` : '',
    url: ev.url || '',
    saleStatus: ev.dates?.status?.code || '',
    presales,
    ticketmasterId: ev.id,
  }
}

// Date range helpers
function getDateRange(range: string): { start: string; end: string } {
  const now = new Date()
  const start = now.toISOString().replace(/\.\d+Z$/, 'Z')
  const end = new Date(now)

  switch (range) {
    case 'this_week':
      end.setDate(now.getDate() + 7)
      break
    case 'next_2_weeks':
      end.setDate(now.getDate() + 14)
      break
    case 'this_month':
      end.setMonth(now.getMonth() + 1)
      break
    case 'next_3_months':
      end.setMonth(now.getMonth() + 3)
      break
    default:
      end.setDate(now.getDate() + 14)
  }

  return { start, end: end.toISOString().replace(/\.\d+Z$/, 'Z') }
}

/** TM Discovery API expects a single classificationName; comma-lists often fail or return empty. */
function singleClassificationName(categories?: string[]): string | undefined {
  if (!categories?.length || categories.length !== 1) return undefined
  const map: Record<string, string> = {
    concert: 'Music',
    sports: 'Sports',
    theater: 'Arts & Theatre',
    comedy: 'Arts & Theatre',
    festival: 'Music',
  }
  return map[categories[0].toLowerCase()] || undefined
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function filterFutureRawEvents(events: TicketmasterEvent[]): TicketmasterEvent[] {
  const t = todayIsoDate()
  return events.filter((ev) => {
    const d = ev.dates?.start?.localDate
    if (!d) return true
    return d >= t
  })
}

function dedupeById(events: TicketmasterEvent[]): TicketmasterEvent[] {
  const seen = new Set<string>()
  return events.filter((e) => {
    if (!e.id || seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

// Map region names to state codes for filtering
const REGION_STATE_MAP: Record<string, string> = {
  denver: 'CO',
  colorado: 'CO',
  'new york': 'NY',
  'los angeles': 'CA',
  california: 'CA',
  texas: 'TX',
  florida: 'FL',
  illinois: 'IL',
  chicago: 'IL',
}

export interface SearchOptions {
  keyword?: string
  categories?: string[]
  regions?: string[]
  dateRange?: string
  size?: number
  sort?: string
  stateCode?: string
  city?: string
}

async function fetchTicketmasterPage(
  base: URLSearchParams,
  page: number,
): Promise<{ events: TicketmasterEvent[]; totalPages: number }> {
  const params = new URLSearchParams(base)
  params.set('page', String(page))
  const res = await fetch(`${TM_BASE}/events.json?${params}`)
  if (!res.ok) {
    return { events: [], totalPages: 0 }
  }
  const data: TicketmasterResponse = await res.json()
  const events = data._embedded?.events || []
  const totalPages = data.page?.totalPages ?? 1
  return { events, totalPages }
}

export async function searchTicketmaster(options: SearchOptions = {}): Promise<FormattedEvent[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY
  if (!apiKey) return []

  const { start, end } = getDateRange(options.dateRange || 'next_2_weeks')
  const baseParams = new URLSearchParams({
    apikey: apiKey,
    startDateTime: start,
    endDateTime: end,
    size: String(options.size || 50),
    sort: options.sort || 'date,asc',
    countryCode: 'US',
  })

  if (options.keyword) baseParams.set('keyword', options.keyword)

  let classification = singleClassificationName(options.categories)
  if (classification) baseParams.set('classificationName', classification)

  if (options.stateCode) {
    baseParams.set('stateCode', options.stateCode)
  } else if (options.regions?.length) {
    const nonNationwide = options.regions.filter(r => r !== 'nationwide')
    if (nonNationwide.length) {
      const stateCode = REGION_STATE_MAP[nonNationwide[0].toLowerCase()]
      if (stateCode) baseParams.set('stateCode', stateCode)
      else baseParams.set('keyword', (options.keyword ? options.keyword + ' ' : '') + nonNationwide[0])
    }
  }

  if (options.city) baseParams.append('city', options.city)

  const merged: TicketmasterEvent[] = []
  let totalPages = 1
  for (let page = 0; page < 3; page++) {
    const { events, totalPages: tp } = await fetchTicketmasterPage(baseParams, page)
    totalPages = tp
    merged.push(...events)
    if (events.length < Number(options.size || 50) || page + 1 >= totalPages) break
  }

  let raw = dedupeById(filterFutureRawEvents(merged))

  if (!raw.length && classification) {
    baseParams.delete('classificationName')
    const retry: TicketmasterEvent[] = []
    for (let page = 0; page < 3; page++) {
      const { events, totalPages: tp } = await fetchTicketmasterPage(baseParams, page)
      totalPages = tp
      retry.push(...events)
      if (events.length < Number(options.size || 50) || page + 1 >= totalPages) break
    }
    raw = dedupeById(filterFutureRawEvents(retry))
  }

  return raw.map(formatEvent)
}

// Search for a specific event by keyword (used by EdgeCalculator, Radar, etc.)
export async function searchTicketmasterByKeyword(keyword: string, size = 10): Promise<FormattedEvent[]> {
  return searchTicketmaster({ keyword, size, dateRange: 'next_3_months' })
}

// Format Ticketmaster results into a text block for LLM prompts
export function formatTicketmasterForPrompt(events: FormattedEvent[]): string {
  if (!events.length) return ''

  const lines = events.map((ev, i) => {
    const parts = [
      `[${i + 1}] ${ev.name}`,
      `    Date: ${ev.date}${ev.time ? ' ' + ev.time : ''}`,
      `    Venue: ${ev.venue}, ${ev.city}, ${ev.state}`,
      `    Category: ${ev.category} (${ev.genre})`,
    ]
    if (ev.priceRange) parts.push(`    Price Range: ${ev.priceRange}`)
    if (ev.saleStatus) parts.push(`    Sale Status: ${ev.saleStatus}`)
    if (ev.presales.length) parts.push(`    Presales: ${ev.presales.join('; ')}`)
    if (ev.url) parts.push(`    URL: ${ev.url}`)
    return parts.join('\n')
  })

  return `=== TICKETMASTER LIVE DATA (${events.length} events) ===\n\n${lines.join('\n\n')}`
}
