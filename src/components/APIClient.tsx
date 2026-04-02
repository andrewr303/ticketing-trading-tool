import type { ModelTier } from '../lib/prompts'
import type { EventSearchResult, DeepResearchRequest, DeepResearchResult, DiscoveredEvent, RiskAlert, SignalDashboard, Citation } from '../lib/types'
import { searchTicketmaster, searchTicketmasterByKeyword, formatTicketmasterForPrompt } from '../lib/ticketmaster'
import type { SearchOptions } from '../lib/ticketmaster'
import { supabase } from '../lib/supabase'
import { isEventDateClearlyInPast } from '../lib/eventDateFilter'

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

interface CallOptions {
  prompt: string
  modelTier?: ModelTier
  maxTokens?: number
  searchQueries?: string[]
  /** Pre-fetched search results to inject into the prompt (replaces ${searchResults} placeholder) */
  searchResults?: string
  /** Ticketmaster search options — if provided, fetches live event data */
  ticketmasterOptions?: SearchOptions
}

/**
 * Fetch live search context from Ticketmaster and inject into the prompt.
 * Replaces the literal "${searchResults}" placeholder with real data.
 */
async function fetchSearchContext(
  searchQueries: string[],
  ticketmasterOptions?: SearchOptions,
): Promise<string> {
  const sections: string[] = []

  // Fetch from Ticketmaster Discovery API
  const tmOptions = ticketmasterOptions || inferTicketmasterOptions(searchQueries)
  const tmEvents = await searchTicketmaster(tmOptions)
  const tmText = formatTicketmasterForPrompt(tmEvents)
  if (tmText) sections.push(tmText)

  if (!sections.length) {
    return '(No live search data available — Ticketmaster API returned no results for this query. Base your analysis on general market knowledge and flag that data is limited.)'
  }

  return sections.join('\n\n')
}

/**
 * Infer Ticketmaster search parameters from the search query strings
 * that each prompt config defines.
 */
function inferTicketmasterOptions(queries: string[]): SearchOptions {
  const joined = queries.join(' ').toLowerCase()

  const categories: string[] = []
  if (joined.includes('concert') || joined.includes('music') || joined.includes('artist') || joined.includes('tour')) categories.push('concert')
  if (joined.includes('sport') || joined.includes('nba') || joined.includes('nfl') || joined.includes('mlb') || joined.includes('nhl')) categories.push('sports')
  if (joined.includes('theater') || joined.includes('theatre') || joined.includes('broadway')) categories.push('theater')
  if (joined.includes('comedy')) categories.push('comedy')

  let dateRange = 'next_2_weeks'
  if (joined.includes('this week')) dateRange = 'this_week'
  else if (joined.includes('this month') || joined.includes('next month')) dateRange = 'this_month'
  else if (joined.includes('next three months') || joined.includes('3 months')) dateRange = 'next_3_months'

  const regions: string[] = []
  if (joined.includes('denver') || joined.includes('colorado')) regions.push('denver')
  if (joined.includes('nationwide') || regions.length === 0) regions.push('nationwide')

  // Extract a keyword if a specific event/artist is mentioned
  let keyword: string | undefined
  const keywordPatterns = queries.filter(q => !q.match(/^(upcoming|trending|ticket|live event|concert tour)/i))
  if (keywordPatterns.length && keywordPatterns[0].length < 100) {
    // Use the most specific query as keyword
    const specific = keywordPatterns.find(q => q.split(' ').length <= 8)
    if (specific) keyword = specific
  }

  return { categories, regions, dateRange, keyword, size: 50 }
}

export async function callLLM({
  prompt,
  modelTier: _modelTier = 'standard',
  maxTokens = 4000,
  searchQueries = [],
  searchResults,
  ticketmasterOptions,
}: CallOptions): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing VITE_OPENROUTER_API_KEY. Add it to your .env file."
    );
  }

  // If the prompt contains the placeholder, fetch live data and inject it
  let finalPrompt = prompt
  if (prompt.includes('${searchResults}')) {
    const liveData = searchResults ?? await fetchSearchContext(searchQueries, ticketmasterOptions)
    finalPrompt = prompt.replace('${searchResults}', liveData)
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Ticket Trading AI Suite",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: finalPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json();

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenRouter returned an empty response");
  }

  return text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
}

// Backward-compatible wrapper for pages that haven't migrated yet
export async function callClaude(prompt: string, useWebSearch: boolean = false): Promise<string> {
  return callLLM({ prompt, searchQueries: useWebSearch ? [''] : [] })
}

// ---------------------------------------------------------------------------
// Event Search — uses Ticketmaster Discovery API for real data
// ---------------------------------------------------------------------------

export async function searchEvents(query: string): Promise<EventSearchResult[]> {
  // First try Ticketmaster for real data
  const tmEvents = await searchTicketmasterByKeyword(query, 20)

  if (tmEvents.length) {
    return tmEvents.map((ev, i) => ({
      id: ev.ticketmasterId || String(i),
      name: ev.name,
      venue: `${ev.venue}, ${ev.city}, ${ev.state}`,
      date: ev.date,
      category: ev.category as EventSearchResult['category'],
      source: 'Ticketmaster',
      url: ev.url,
      price_range: ev.priceRange || undefined,
    }))
  }

  // Fallback to LLM if Ticketmaster returns nothing
  const prompt = `Search for upcoming live events matching: "${query}". Return a JSON array of objects with fields: id (string), name (string), venue (string), date (string ISO), category ("concert"|"sports"|"theater"|"comedy"|"festival"|"other"), source (string), url (string, optional), price_range (string, optional). Return only the JSON array, no other text.`
  const raw = await callLLM({ prompt })
  return JSON.parse(raw)
}

// ---------------------------------------------------------------------------
// Deep Research — calls Supabase edge function which has web search (YOU.com)
// Falls back to frontend-only approach with Ticketmaster data if unavailable
// ---------------------------------------------------------------------------

export interface DeepResearchResponse {
  result: DeepResearchResult
  metadata: {
    search_queries_run: number
    research_effort: string
    total_sources: number
    generation_time_ms: number
    ticketmaster_events_fetched?: number
  }
}

/** Normalize LLM JSON so UI types match (edge vs client prompts differ; models drift). */
function normalizeDeepResearchResult(parsed: Record<string, unknown>): DeepResearchResult {
  const rawEvents = Array.isArray(parsed.discovered_events) ? parsed.discovered_events : []
  const futureOnly = rawEvents.filter(
    (ev: Record<string, unknown>) => !isEventDateClearlyInPast(String(ev.event_date ?? '')),
  )
  const discovered_events: DiscoveredEvent[] = futureOnly.map((ev: Record<string, unknown>) => ({
    event_name: String(ev.event_name ?? ''),
    artist_or_team: String(ev.artist_or_team ?? ''),
    event_date: String(ev.event_date ?? ''),
    venue: String(ev.venue ?? ''),
    city: String(ev.city ?? ''),
    state: String(ev.state ?? ''),
    category: (['concert', 'sports', 'theater', 'comedy', 'festival'].includes(String(ev.category))
      ? ev.category
      : 'concert') as DiscoveredEvent['category'],
    edge_score: Number(ev.edge_score) || 0,
    demand_score: Number(ev.demand_score) || 0,
    supply_score: Number(ev.supply_score) || 0,
    roi_score: Number(ev.roi_score) || 0,
    timing_score: Number(ev.timing_score) || 0,
    inefficiency_score: Number(ev.inefficiency_score) || 0,
    face_value_range: ev.face_value_range != null ? String(ev.face_value_range) : null,
    secondary_floor: ev.secondary_floor != null ? Number(ev.secondary_floor) : null,
    secondary_median: ev.secondary_median != null ? Number(ev.secondary_median) : null,
    inventory_level: (['scarce', 'tight', 'moderate', 'abundant'].includes(String(ev.inventory_level))
      ? ev.inventory_level
      : 'moderate') as DiscoveredEvent['inventory_level'],
    sell_through_pct: ev.sell_through_pct != null ? Number(ev.sell_through_pct) : null,
    price_velocity: (['surging', 'rising', 'stable', 'declining', 'crashing'].includes(String(ev.price_velocity))
      ? ev.price_velocity
      : 'stable') as DiscoveredEvent['price_velocity'],
    action: (['BUY', 'SELL', 'HOLD', 'WATCH'].includes(String(ev.action)) ? ev.action : 'WATCH') as DiscoveredEvent['action'],
    confidence: typeof ev.confidence === 'number' ? ev.confidence : 50,
    estimated_roi_pct: typeof ev.estimated_roi_pct === 'number' ? ev.estimated_roi_pct : 0,
    reasoning: String(ev.reasoning ?? ''),
    source_citations: Array.isArray(ev.source_citations)
      ? (ev.source_citations as unknown[]).map(n => Number(n)).filter(n => !Number.isNaN(n))
      : [],
  }))

  const rawAlerts = Array.isArray(parsed.risk_alerts) ? parsed.risk_alerts : []
  const risk_alerts: RiskAlert[] = rawAlerts.map((a: Record<string, unknown>) => {
    const detail = String(a.detail ?? a.description ?? '')
    const defensive = String(a.defensive_action ?? '')
    return {
      severity: (['critical', 'warning', 'info'].includes(String(a.severity)) ? a.severity : 'info') as RiskAlert['severity'],
      title: String(a.title ?? 'Alert'),
      detail,
      affected_events: Array.isArray(a.affected_events) ? (a.affected_events as string[]) : [],
      defensive_action: defensive || (detail ? 'Review the detail above and adjust positions or data checks accordingly.' : 'Verify API keys (Ticketmaster, OpenRouter) and retry; avoid sizing trades on empty data.'),
    }
  })

  const sd = (parsed.signal_dashboard || {}) as Record<string, unknown>
  const signal_dashboard: SignalDashboard = {
    social: Array.isArray(sd.social) ? sd.social as SignalDashboard['social'] : [],
    streaming: Array.isArray(sd.streaming) ? sd.streaming as SignalDashboard['streaming'] : [],
    search_trends: Array.isArray(sd.search_trends)
      ? sd.search_trends as SignalDashboard['search_trends']
      : Array.isArray(sd.search)
        ? sd.search as SignalDashboard['search_trends']
        : [],
    news: Array.isArray(sd.news) ? sd.news as SignalDashboard['news'] : [],
    market: Array.isArray(sd.market) ? sd.market as SignalDashboard['market'] : [],
  }

  const rawSources = Array.isArray(parsed.sources) ? parsed.sources : []
  const sources: Citation[] = rawSources.map((s: Record<string, unknown>, i: number) => ({
    index: typeof s.index === 'number' ? s.index : i + 1,
    title: String(s.title ?? ''),
    url: String(s.url ?? ''),
    snippet: String(s.snippet ?? ''),
  }))

  const stripped = rawEvents.length - futureOnly.length
  const baseOverview = String(parsed.market_overview ?? '')
  const market_overview = stripped > 0
    ? `${baseOverview}${baseOverview ? ' ' : ''}(${stripped} past-dated event(s) removed — only upcoming events are shown.)`
    : baseOverview

  return {
    generated_at: String(parsed.generated_at ?? new Date().toISOString()),
    market_overview,
    discovered_events,
    signal_dashboard,
    on_sales: Array.isArray(parsed.on_sales) ? parsed.on_sales as DeepResearchResult['on_sales'] : [],
    risk_alerts,
    sources,
    recommended_focus: String(parsed.recommended_focus ?? ''),
  }
}

export async function callDeepResearch(options: DeepResearchRequest): Promise<DeepResearchResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Edge function uses supabase.auth.getUser() — must send the user's access token, not only the anon key.
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/deep-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken ?? supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify(options),
      })
      if (res.ok) {
        const data = await res.json() as { error?: string; result?: Record<string, unknown>; metadata?: DeepResearchResponse['metadata'] }
        if (!data.error && data.result) {
          return {
            result: normalizeDeepResearchResult(data.result),
            metadata: data.metadata ?? {
              search_queries_run: 0,
              research_effort: options.effortLevel || 'standard',
              total_sources: 0,
              generation_time_ms: 0,
            },
          }
        }
      }
    } catch {
      // Fall through to frontend approach
    }
  }

  // Fallback: use Ticketmaster data + LLM synthesis
  const startTime = Date.now()
  const regions = options.regions?.join(', ') || 'nationwide'
  const categories = options.categories?.length ? options.categories.join(', ') : 'all categories'
  const dateRange = options.dateRange || 'next_2_weeks'

  const tmEventsPrimary = await searchTicketmaster({
    categories: options.categories,
    regions: options.regions,
    dateRange,
    size: 50,
  })
  let tmEvents = tmEventsPrimary
  if (!tmEvents.length && dateRange !== 'next_3_months') {
    tmEvents = await searchTicketmaster({
      categories: options.categories,
      regions: options.regions,
      dateRange: 'next_3_months',
      size: 50,
    })
  }
  const tmText = formatTicketmasterForPrompt(tmEvents)
  const tmHasRows = tmEvents.length > 0

  const todayYmd = new Date().toISOString().slice(0, 10)

  const prompt = `You are a ticket market research analyst for **upcoming US events only**. Today is ${todayYmd}. Scope: ${regions}, categories: ${categories}, window: ${dateRange.replace(/_/g, ' ')}. Effort: ${options.effortLevel || 'standard'}.

## LIVE EVENT DATA FROM TICKETMASTER

${tmText || '(No Ticketmaster rows — check VITE_TICKETMASTER_API_KEY and network; do not invent events.)'}

## Hard rules

1. Every event_date must be **on or after ${todayYmd}**. Never output 2023/2024 tours or old games from memory.
2. If the Ticketmaster block lists numbered events, discovered_events must match those rows only (names, dates, venues, cities).
3. If Ticketmaster is empty, return discovered_events: [] and explain in market_overview; add a risk_alerts entry with defensive_action. Do not fabricate a slate from memory.

## Instructions

${tmHasRows
    ? `Score and analyze only the Ticketmaster events above.`
    : `No live rows — return empty discovered_events per rule 3.`}

Return a JSON object matching this structure exactly:
{
  "generated_at": "ISO timestamp",
  "market_overview": "string",
  "discovered_events": [{ "event_name": "", "artist_or_team": "", "event_date": "", "venue": "", "city": "", "state": "", "category": "concert|sports|theater|comedy|festival", "edge_score": 0, "demand_score": 0, "supply_score": 0, "roi_score": 0, "timing_score": 0, "inefficiency_score": 0, "face_value_range": "", "secondary_floor": 0, "secondary_median": 0, "inventory_level": "moderate", "sell_through_pct": null, "price_velocity": "stable", "action": "WATCH", "confidence": 50, "estimated_roi_pct": 0, "reasoning": "", "source_citations": [] }],
  "signal_dashboard": { "social": [], "streaming": [], "search_trends": [], "news": [], "market": [] },
  "on_sales": [{ "event_name": "", "date": "", "time": "", "timezone": "ET", "platform": "", "sale_type": "general", "profit_potential": "medium", "notes": "", "region": "" }],
  "risk_alerts": [{ "severity": "warning", "title": "", "detail": "", "affected_events": [], "defensive_action": "" }],
  "sources": [{ "index": 1, "title": "", "url": "", "snippet": "" }],
  "recommended_focus": ""
}

Return only the JSON, no other text.`

  const raw = await callLLM({ prompt, modelTier: 'advanced', maxTokens: 8000 })
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error('Deep research returned invalid JSON. Check OpenRouter model output.')
  }
  const result = normalizeDeepResearchResult(parsed)

  return {
    result,
    metadata: {
      search_queries_run: 1,
      research_effort: options.effortLevel || 'standard',
      total_sources: Math.max(result.sources.length, tmHasRows ? 1 : 0),
      generation_time_ms: Date.now() - startTime,
    },
  }
}
