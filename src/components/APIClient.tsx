import type { ModelTier } from '../lib/prompts'
import type { EventSearchResult, DeepResearchRequest, DeepResearchResult } from '../lib/types'
import { searchTicketmaster, searchTicketmasterByKeyword, formatTicketmasterForPrompt } from '../lib/ticketmaster'
import type { SearchOptions } from '../lib/ticketmaster'

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
  }
}

export async function callDeepResearch(options: DeepResearchRequest): Promise<DeepResearchResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Try Supabase edge function first (has YOU.com web search + OpenRouter)
  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/deep-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(options),
      })
      if (res.ok) {
        const data = await res.json()
        if (!data.error) return data
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

  // Fetch real Ticketmaster data
  const tmEvents = await searchTicketmaster({
    categories: options.categories,
    regions: options.regions,
    dateRange,
    size: 50,
  })
  const tmText = formatTicketmasterForPrompt(tmEvents)

  const prompt = `You are a ticket market research analyst. Research upcoming live events for the ${regions} market, focusing on ${categories} in the ${dateRange.replace(/_/g, ' ')} timeframe. Effort level: ${options.effortLevel || 'standard'}.

## LIVE EVENT DATA FROM TICKETMASTER

${tmText || '(No Ticketmaster data available for this query)'}

## Instructions

Using the live Ticketmaster data above as your PRIMARY source, generate a research report. Only include events that appear in the data above. Do not invent events.

Return a JSON object matching this structure exactly:
{
  "generated_at": "ISO timestamp",
  "market_overview": "string",
  "discovered_events": [{ "event_name": "", "artist_or_team": "", "event_date": "", "venue": "", "city": "", "state": "", "category": "", "edge_score": 0, "demand_score": 0, "supply_score": 0, "roi_score": 0, "timing_score": 0, "inefficiency_score": 0, "face_value_range": "", "secondary_floor": 0, "secondary_median": 0, "inventory_level": "moderate", "sell_through_pct": 0, "price_velocity": "stable", "action": "WATCH", "reasoning": "", "key_signals": [], "risk_factors": [] }],
  "signal_dashboard": { "social": [], "streaming": [], "search": [], "news": [] },
  "on_sales": [{ "event_name": "", "date": "", "time": "", "platform": "", "profit_potential": "medium", "notes": "" }],
  "risk_alerts": [{ "severity": "medium", "title": "", "description": "", "affected_events": [] }],
  "sources": [{ "title": "", "url": "", "snippet": "" }],
  "recommended_focus": ""
}

Return only the JSON, no other text.`

  const raw = await callLLM({ prompt, modelTier: 'advanced', maxTokens: 8000 })
  const result: DeepResearchResult = JSON.parse(raw)

  return {
    result,
    metadata: {
      search_queries_run: 1,
      research_effort: options.effortLevel || 'standard',
      total_sources: result.sources?.length || 0,
      generation_time_ms: Date.now() - startTime,
    },
  }
}
