import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MODEL = "openai/gpt-5.4-mini"

// ---------------------------------------------------------------------------
// Phase 1: You.com Search API — parallel data extraction
// ---------------------------------------------------------------------------
async function youSearch(queries: string[], apiKey: string): Promise<string> {
  const results: string[] = []

  const fetches = queries.map(async (query) => {
    try {
      const url = `https://api.ydc-index.io/search?query=${encodeURIComponent(query)}&num_web_results=5`
      const res = await fetch(url, { headers: { "X-API-Key": apiKey } })
      if (!res.ok) return null
      const data = await res.json()
      if (!data.hits?.length) return null
      return data.hits.slice(0, 3).map((hit: { title: string; url: string; snippets?: string[] }) => {
        const snippets = (hit.snippets || []).join(" ").slice(0, 500)
        return `[${hit.title}] (${hit.url})\n${snippets}`
      }).join("\n\n")
    } catch {
      return null
    }
  })

  const settled = await Promise.allSettled(fetches)
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      results.push(result.value)
    }
  }

  return results.length > 0 ? results.join("\n\n---\n\n") : "(No search results available)"
}

// ---------------------------------------------------------------------------
// Phase 2: You.com Research API — deep synthesis with citations
// ---------------------------------------------------------------------------
async function youResearch(
  query: string,
  apiKey: string,
  effort: string
): Promise<{ content: string; sources: Array<{ url: string; title: string; snippets: string[] }> }> {
  try {
    const res = await fetch("https://api.you.com/v1/research", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: query, research_effort: effort }),
    })
    if (!res.ok) {
      return { content: "(Research API unavailable — using search data only)", sources: [] }
    }
    const data = await res.json()
    return {
      content: data.output?.content || "",
      sources: data.output?.sources || [],
    }
  } catch {
    return { content: "(Research API error — using search data only)", sources: [] }
  }
}

// ---------------------------------------------------------------------------
// Phase 3: OpenRouter LLM — structured synthesis and scoring
// ---------------------------------------------------------------------------
async function callOpenRouter(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY")
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set")

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "https://ticket-trading.app",
      "X-Title": "Ticket Trading AI Suite — Deep Research",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ""
}

// ---------------------------------------------------------------------------
// Ticketmaster Discovery API — real event data
// ---------------------------------------------------------------------------
interface TmEvent {
  name: string
  id: string
  url?: string
  dates?: { start?: { localDate?: string; localTime?: string }; status?: { code?: string }; timezone?: string }
  priceRanges?: Array<{ min?: number; max?: number }>
  _embedded?: {
    venues?: Array<{ name?: string; city?: { name?: string }; state?: { stateCode?: string } }>
    attractions?: Array<{ name?: string }>
  }
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>
  sales?: { public?: { startDateTime?: string }; presales?: Array<{ name?: string; startDateTime?: string }> }
}

function tmDateWindow(dateRange: string): { start: string; end: string } {
  const now = new Date()
  const start = now.toISOString().replace(/\.\d+Z$/, "Z")
  const end = new Date(now)
  switch (dateRange) {
    case "this_week": end.setDate(now.getDate() + 7); break
    case "next_2_weeks": end.setDate(now.getDate() + 14); break
    case "this_month": end.setMonth(now.getMonth() + 1); break
    case "next_3_months": end.setMonth(now.getMonth() + 3); break
    default: end.setDate(now.getDate() + 14)
  }
  return { start, end: end.toISOString().replace(/\.\d+Z$/, "Z") }
}

/** YYYY-MM-DD (UTC calendar) for comparing to Ticketmaster localDate strings. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function filterFutureTmEvents(events: TmEvent[]): TmEvent[] {
  const t = todayIsoDate()
  return events.filter((ev) => {
    const d = ev.dates?.start?.localDate
    if (!d) return true
    return d >= t
  })
}

function dedupeTmEvents(events: TmEvent[]): TmEvent[] {
  const seen = new Set<string>()
  return events.filter((e) => {
    if (!e.id || seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

/** Ticketmaster accepts one classificationName; comma-separated values often return 400 or empty. */
function singleClassificationName(categories: string[]): string | undefined {
  if (categories.length !== 1) return undefined
  const catMap: Record<string, string> = { concert: "Music", sports: "Sports", theater: "Arts & Theatre", comedy: "Arts & Theatre", festival: "Music" }
  const c = categories[0].toLowerCase()
  return catMap[c] || undefined
}

async function fetchTicketmasterOnce(
  apiKey: string,
  categories: string[],
  regions: string[],
  dateRange: string,
  opts: { classificationName?: string; skipClassification?: boolean } = {},
): Promise<{ text: string; count: number; httpStatus?: number; errorHint?: string }> {
  const { start, end } = tmDateWindow(dateRange)

  const classificationName = opts.skipClassification
    ? undefined
    : opts.classificationName ?? singleClassificationName(categories)

  const regionMap: Record<string, string> = { denver: "CO", colorado: "CO", "new york": "NY", california: "CA", texas: "TX", florida: "FL", chicago: "IL" }
  const nonNational = regions.filter(r => r !== "nationwide")
  const stateCode = nonNational.length ? regionMap[nonNational[0].toLowerCase()] : undefined

  const baseParams: Record<string, string> = {
    apikey: apiKey,
    startDateTime: start,
    endDateTime: end,
    size: "50",
    sort: "date,asc",
    countryCode: "US",
  }

  const allEvents: TmEvent[] = []

  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({ ...baseParams, page: String(page) })
    if (classificationName) params.set("classificationName", classificationName)
    if (stateCode) params.set("stateCode", stateCode)

    let res: Response
    try {
      res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { text: `(Ticketmaster network error: ${msg})`, count: 0, errorHint: msg }
    }

    if (!res.ok) {
      let hint = ""
      try {
        const errBody = await res.json() as { errors?: Array<{ detail?: string }>; fault?: { faultstring?: string } }
        hint = errBody.errors?.[0]?.detail || errBody.fault?.faultstring || ""
      } catch {
        hint = (await res.text()).slice(0, 280)
      }
      return {
        text: `(Ticketmaster API HTTP ${res.status}${hint ? `: ${hint}` : ""})`,
        count: 0,
        httpStatus: res.status,
        errorHint: hint,
      }
    }

    const data = await res.json() as { _embedded?: { events?: TmEvent[] }; page?: { totalPages?: number } }
    const pageEvents = data._embedded?.events || []
    allEvents.push(...pageEvents)
    const totalPages = data.page?.totalPages ?? 1
    if (pageEvents.length < 50 || page + 1 >= totalPages) break
  }

  const future = dedupeTmEvents(filterFutureTmEvents(allEvents))
  if (!future.length) {
    return { text: "(No Ticketmaster events in this date window after filtering to future dates)", count: 0 }
  }

  const text = future.map((ev, i) => {
    const venue = ev._embedded?.venues?.[0]
    const price = ev.priceRanges?.[0]
    const cls = ev.classifications?.[0]
    const lines = [
      `[${i + 1}] ${ev.name}`,
      `    Date: ${ev.dates?.start?.localDate || "TBD"}${ev.dates?.start?.localTime ? " " + ev.dates.start.localTime : ""}`,
      `    Venue: ${venue?.name || "TBD"}, ${venue?.city?.name || ""}, ${venue?.state?.stateCode || ""}`,
      `    Category: ${cls?.segment?.name || "Other"} (${cls?.genre?.name || ""})`,
    ]
    if (price) lines.push(`    Price Range: $${price.min ?? "?"}-$${price.max ?? "?"}`)
    if (ev.dates?.status?.code) lines.push(`    Sale Status: ${ev.dates.status.code}`)
    if (ev.sales?.presales?.length) {
      const presaleInfo = ev.sales.presales.slice(0, 3).map(p => `${p.name}: ${p.startDateTime || "TBD"}`).join("; ")
      lines.push(`    Presales: ${presaleInfo}`)
    }
    if (ev.url) lines.push(`    URL: ${ev.url}`)
    return lines.join("\n")
  }).join("\n\n")
  return { text, count: future.length }
}

async function fetchTicketmaster(
  apiKey: string,
  categories: string[],
  regions: string[],
  dateRange: string,
): Promise<{ text: string; count: number }> {
  let r = await fetchTicketmasterOnce(apiKey, categories, regions, dateRange, {})

  const hadClassification = Boolean(singleClassificationName(categories))
  if (r.count === 0 && hadClassification) {
    const noCls = await fetchTicketmasterOnce(apiKey, categories, regions, dateRange, { skipClassification: true })
    if (noCls.count > 0) {
      return {
        text: `${noCls.text}\n\n(Note: returned unfiltered categories — TM had no rows for the selected genre filter.)`,
        count: noCls.count,
      }
    }
    r = noCls
  }

  if (r.count === 0 && dateRange !== "next_3_months") {
    const wider = await fetchTicketmasterOnce(apiKey, categories, regions, "next_3_months", {
      skipClassification: hadClassification,
    })
    if (wider.count > 0) {
      return {
        text: `${wider.text}\n\n(Note: widened date window to next 3 months because the selected range returned no events.)`,
        count: wider.count,
      }
    }
    return { text: wider.text, count: wider.count }
  }

  return { text: r.text, count: r.count }
}

// ---------------------------------------------------------------------------
// Build search queries based on user filters
// ---------------------------------------------------------------------------
function buildSearchQueries(
  regions: string[],
  categories: string[],
  dateRange: string,
  focusAreas: string[]
): string[] {
  const isNationwide = regions.includes("nationwide") || regions.length === 0
  const regionText = isNationwide ? "nationwide United States" : regions.join(" ")

  const dateText: Record<string, string> = {
    this_week: "this week",
    next_2_weeks: "next two weeks",
    this_month: "this month",
    next_3_months: "next three months",
  }
  const timeframe = dateText[dateRange] || "next two weeks"

  const queries: string[] = [
    // Ticketing platform queries
    `upcoming concerts events ${timeframe} ${regionText} Ticketmaster on sale presale 2026`,
    `trending events tickets StubHub most popular ${timeframe} ${regionText}`,
    `SeatGeek deal score best events ${timeframe} secondary market`,
    `Vivid Seats hot events trending tickets ${timeframe}`,
    `live nation tour announcements new tours 2026 ${regionText}`,
    // Market intelligence
    `ticket resale market prices trending ${timeframe} secondary market ROI`,
    `sold out events high demand tickets ${timeframe} ${regionText}`,
    `concert ticket presale codes today this week 2026`,
  ]

  // Category-specific queries
  if (categories.includes("sports") || categories.length === 0) {
    queries.push(`NBA NFL MLB NHL MLS tickets ${timeframe} playoff games ${regionText}`)
  }
  if (categories.includes("concert") || categories.length === 0) {
    queries.push(`concert tour tickets ${timeframe} popular artists ${regionText} 2026`)
  }
  if (categories.includes("theater") || categories.length === 0) {
    queries.push(`broadway theater tickets ${timeframe} ${regionText}`)
  }

  // Signal sources
  queries.push(`spotify monthly listeners surge artists touring 2026`)
  queries.push(`reddit twitter trending concerts sold out events ${timeframe}`)

  // User focus areas
  for (const area of focusAreas.slice(0, 3)) {
    queries.push(`${area} tickets events ${timeframe} ${regionText}`)
  }

  return queries
}

function isEventDateClearlyInPast(raw: string): boolean {
  const trimmed = String(raw || "").trim()
  const iso = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2]) - 1
    const d = Number(iso[3])
    const parsed = new Date(y, m, d)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return parsed.getTime() < start.getTime()
  }
  const t = Date.parse(trimmed)
  if (!Number.isNaN(t)) {
    const parsed = new Date(t)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return parsed.getTime() < start.getTime()
  }
  return false
}

/** Drop hallucinated or stale rows; keep unparseable dates (avoid over-stripping). */
function sanitizeDeepResearchResult(result: Record<string, unknown>): void {
  const events = Array.isArray(result.discovered_events)
    ? result.discovered_events as Record<string, unknown>[]
    : []
  const before = events.length
  result.discovered_events = events.filter((e) => !isEventDateClearlyInPast(String(e.event_date ?? "")))
  const after = (result.discovered_events as unknown[]).length
  const removed = before - after
  if (removed > 0) {
    const mo = String(result.market_overview ?? "")
    result.market_overview =
      mo +
      (mo ? " " : "") +
      `(${removed} past-dated event(s) removed — only upcoming events are allowed.)`
  }
}

// ---------------------------------------------------------------------------
// Build the LLM synthesis prompt
// ---------------------------------------------------------------------------
function buildPrompt(
  date: string,
  searchData: string,
  researchContent: string,
  researchSources: Array<{ url: string; title: string; snippets: string[] }>,
  regions: string[],
  categories: string[]
): string {
  const sourceList = researchSources.map((s, i) =>
    `[${i + 1}] ${s.title} — ${s.url}\n${(s.snippets || []).join(" ").slice(0, 200)}`
  ).join("\n")

  const regionText = regions.includes("nationwide") ? "nationwide (all major US markets)" : regions.join(", ")
  const catText = categories.length === 0 ? "all categories" : categories.join(", ")

  return `## Role

You are a senior ticket market analyst and quantitative trading strategist with 15 years of experience in the US live event secondary market. You operate as a research desk producing actionable intelligence for a trading team.

## Task

Today is **${date}** (use this as the only "current" calendar reference). Generate a deep research report for **upcoming** US live events only.

**Scope:** ${regionText}
**Categories:** ${catText}

## Hard constraints (do not violate)

1. **No past events:** Every \`discovered_events[].event_date\` must refer to a date **on or after ${date}**. Never output events from 2023, 2024, or any year before the current year unless the calendar date is still in the future (impossible for those years). Do not use training-data memory of old tours (e.g. Eras Tour 2023, 2023 NBA openers).
2. **Ticketmaster is ground truth when present:** If "Ticketmaster Live Event Data" below contains numbered rows \`[1] ...\`, your \`discovered_events\` must be **only** those events (same name, date, city/state, venue). You may score and reason about them; do not substitute different dates or venues.
3. **If Ticketmaster data is missing or only error text:** Set \`discovered_events\` to \`[]\`. Do not invent a full slate from web search or memory. Add one \`risk_alerts\` entry explaining that the live feed failed. You may still fill \`signal_dashboard\` cautiously from web text, labeled as unverified.
4. **Nationwide scope:** Venues must be in the **United States** unless the user scope explicitly names another country.

## Research Data

### Ticketmaster + web (verbatim feeds)
${searchData}

### Deep Research Synthesis
${researchContent}

### Cited Sources
${sourceList}

## Analysis Requirements

### Discovered Events (15-30 events)
For each event, score on five dimensions (0-100):

**demand_score**: Social buzz, sell-through rate, streaming metrics, search trends.
  90-100: Sold out / viral / mainstream coverage. 70-89: Strong sell-through, significant buzz. 50-69: Moderate. 30-49: Below average. 0-29: Weak.

**supply_score** (higher = tighter = better for resale):
  90-100: Sold out primary, <50 secondary listings. 70-89: Near sold out. 50-69: Balanced. 30-49: Ample supply. 0-29: Oversupplied.

**roi_score**: Based on spread between face/buy price and secondary market, net of 15% fees.
  90-100: >150% projected ROI. 70-89: 80-150%. 50-69: 30-80%. 30-49: 10-30%. 0-29: <10%.

**timing_score**: Optimal buy/sell window positioning.
  90-100: On-sale today or imminent, historically best entry point. 70-89: Early enough for price curve. 50-69: Fair timing. 30-49: Late entry. 0-29: Too close to event.

**inefficiency_score**: Market mispricing indicators.
  90-100: Face well below demand, presale access advantage, no secondary competition yet. 70-89: Some edge. 50-69: Fairly priced. 30-49: Slight overpay risk. 0-29: Overpriced.

**edge_score** = (demand*0.25) + (supply*0.20) + (roi*0.25) + (timing*0.15) + (inefficiency*0.15)

### Signal Dashboard
Categorize signals into: social, streaming, search_trends, news, market.

### On-Sales
Identify on-sales happening today or this week with exact times and platforms.

### Risk Alerts
Severity levels: critical, warning, info. Include defensive actions.

## Output Format

Return ONLY valid JSON. No markdown fences, no preamble.

{
  "generated_at": "${date}",
  "market_overview": "3-5 sentences on overall market conditions across regions.",
  "discovered_events": [
    {
      "event_name": "Full event name",
      "artist_or_team": "Artist or team name",
      "event_date": "Mon DD, YYYY",
      "venue": "Venue name",
      "city": "City",
      "state": "ST",
      "category": "concert|sports|theater|comedy|festival",
      "edge_score": 0,
      "demand_score": 0,
      "supply_score": 0,
      "roi_score": 0,
      "timing_score": 0,
      "inefficiency_score": 0,
      "face_value_range": "$X-$Y or null",
      "secondary_floor": 0,
      "secondary_median": 0,
      "inventory_level": "scarce|tight|moderate|abundant",
      "sell_through_pct": null,
      "price_velocity": "surging|rising|stable|declining|crashing",
      "action": "BUY|SELL|HOLD|WATCH",
      "confidence": 0,
      "estimated_roi_pct": 0,
      "reasoning": "2-3 sentences connecting signals to verdict.",
      "source_citations": [1, 2]
    }
  ],
  "signal_dashboard": {
    "social": [{ "source": "Named source", "metric": "What metric", "value": "Value", "direction": "up|stable|down", "strength": "strong|moderate|weak", "affected_events": ["Event names"], "detail": "1 sentence" }],
    "streaming": [],
    "search_trends": [],
    "news": [],
    "market": []
  },
  "on_sales": [
    {
      "event_name": "Full name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM AM/PM",
      "timezone": "ET|CT|MT|PT",
      "platform": "Platform name",
      "sale_type": "general|presale|amex|fan_club|venue",
      "profit_potential": "high|medium|low",
      "notes": "Tactical guidance.",
      "region": "City, ST"
    }
  ],
  "risk_alerts": [
    {
      "severity": "critical|warning|info",
      "title": "Short title",
      "detail": "1-2 sentences.",
      "affected_events": ["Event names"],
      "defensive_action": "What to do."
    }
  ],
  "sources": [
    { "index": 1, "title": "Source title", "url": "https://...", "snippet": "Key excerpt" }
  ],
  "recommended_focus": "Numbered list: 1) What to do, when, why. 2) Second priority. 3) Third."
}

## Rules
- If Ticketmaster lists N events, return **at most N** discovered_events (one per TM row), unless TM is empty then return **zero** events per constraint (3) above.
- When you have TM rows: include 15-30 only if TM provides that many; otherwise include all TM rows.
- At least 3 different action types when you have ≥3 TM-backed events (otherwise vary what you can).
- At least 1 event with negative or low ROI when you have ≥3 events.
- All source_citations reference valid indexes in sources[]
- edge_score must match the weighted formula
- No confidence above 95
- ROI formula: ((sale_price * 0.85) - buy_price) / buy_price * 100
- Every risk_alerts entry MUST include a non-empty defensive_action

Generate the report now.`
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const {
    regions = ["nationwide"],
    categories = [],
    dateRange = "next_2_weeks",
    effortLevel = "standard",
    focusAreas = [],
  } = await req.json()

  const youApiKey = Deno.env.get("YOU_API_KEY")
  const tmApiKey = Deno.env.get("TICKETMASTER_API_KEY") ?? ""

  if (!youApiKey && !tmApiKey) {
    return new Response(JSON.stringify({ error: "No search APIs configured (need YOU_API_KEY or TICKETMASTER_API_KEY)" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const startTime = Date.now()
  const today = new Date().toISOString().split("T")[0]
  const year = new Date().getFullYear()

  // Phase 1: Parallel data fetching — web search + Ticketmaster
  const searchQueries = buildSearchQueries(regions, categories, dateRange, focusAreas)

  const [searchData, tmPack, research] = await Promise.all([
    youApiKey
      ? youSearch(searchQueries, youApiKey)
      : Promise.resolve("(Web search unavailable — YOU_API_KEY not configured)"),
    tmApiKey
      ? fetchTicketmaster(tmApiKey, categories, regions, dateRange)
      : Promise.resolve({ text: "(Ticketmaster skipped — TICKETMASTER_API_KEY not set in project secrets)", count: 0 }),
    youApiKey
      ? youResearch(
          `As of ${today}, focus on ${year} and future dates only. Live event ticket trading opportunities ${regions.includes("nationwide") ? "nationwide US" : regions.join(", ")}: which concerts, sports, and shows have resale potential in the next few weeks? Ignore any event before ${today}. Cite only current or upcoming events. Include StubHub, Ticketmaster, SeatGeek, Vivid Seats where relevant.`,
          youApiKey,
          effortLevel,
        )
      : Promise.resolve({ content: "(Research API unavailable)", sources: [] as Array<{ url: string; title: string; snippets: string[] }> }),
  ])

  const ticketmasterData = tmPack.text
  const tmEventCount = tmPack.count

  // Phase 2: LLM synthesis with all data sources
  const combinedSearchData = `### Ticketmaster Live Event Data\n${ticketmasterData}\n\n### Web Search Results\n${searchData}`
  const prompt = buildPrompt(today, combinedSearchData, research.content, research.sources, regions, categories)
  const llmOutput = await callOpenRouter(prompt, 8000)

  // Parse the JSON response
  let result
  try {
    const cleaned = llmOutput.replace(/```json\s*|```\s*/g, "").trim()
    result = JSON.parse(cleaned)
  } catch {
    return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: llmOutput.slice(0, 500) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  sanitizeDeepResearchResult(result as Record<string, unknown>)

  const webSearchHits =
    searchData.length > 120 &&
    !searchData.startsWith("(Web search unavailable") &&
    !searchData.startsWith("(No search results")
      ? 1
      : 0
  const tmHits = tmEventCount > 0
  const total_sources = research.sources.length + (tmHits ? 1 : 0) + webSearchHits

  const response = {
    result,
    metadata: {
      search_queries_run: searchQueries.length,
      research_effort: effortLevel,
      total_sources,
      ticketmaster_events_fetched: tmEventCount,
      generation_time_ms: Date.now() - startTime,
    },
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
