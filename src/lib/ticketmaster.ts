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

// Map our category names to TM classificationName values
function getCategoryFilter(categories?: string[]): string[] {
  if (!categories?.length) return []
  const map: Record<string, string> = {
    concert: 'music',
    sports: 'sports',
    theater: 'arts & theatre',
    comedy: 'arts & theatre',
    festival: 'music',
  }
  return categories.map(c => map[c] || c).filter(Boolean)
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

export async function searchTicketmaster(options: SearchOptions = {}): Promise<FormattedEvent[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY
  if (!apiKey) return []

  const { start, end } = getDateRange(options.dateRange || 'next_2_weeks')
  const params = new URLSearchParams({
    apikey: apiKey,
    startDateTime: start,
    endDateTime: end,
    size: String(options.size || 50),
    sort: options.sort || 'relevance,desc',
    countryCode: 'US',
  })

  if (options.keyword) params.set('keyword', options.keyword)

  const categoryFilters = getCategoryFilter(options.categories)
  if (categoryFilters.length) params.set('classificationName', categoryFilters.join(','))

  // Region filtering
  if (options.stateCode) {
    params.set('stateCode', options.stateCode)
  } else if (options.regions?.length) {
    const nonNationwide = options.regions.filter(r => r !== 'nationwide')
    if (nonNationwide.length) {
      const stateCode = REGION_STATE_MAP[nonNationwide[0].toLowerCase()]
      if (stateCode) params.set('stateCode', stateCode)
      else params.set('keyword', (options.keyword ? options.keyword + ' ' : '') + nonNationwide[0])
    }
  }

  if (options.city) params.append('city', options.city)

  const url = `${TM_BASE}/events.json?${params}`

  const res = await fetch(url)
  if (!res.ok) return []

  const data: TicketmasterResponse = await res.json()
  return (data._embedded?.events || []).map(formatEvent)
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
