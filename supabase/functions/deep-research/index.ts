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

async function fetchTicketmaster(
  apiKey: string,
  categories: string[],
  regions: string[],
  dateRange: string,
): Promise<string> {
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

  const catMap: Record<string, string> = { concert: "music", sports: "sports", theater: "arts & theatre" }
  const classificationName = categories.length
    ? categories.map(c => catMap[c] || c).join(",")
    : undefined

  const regionMap: Record<string, string> = { denver: "CO", colorado: "CO", "new york": "NY", california: "CA", texas: "TX", florida: "FL", chicago: "IL" }
  const nonNational = regions.filter(r => r !== "nationwide")
  const stateCode = nonNational.length ? regionMap[nonNational[0].toLowerCase()] : undefined

  const params = new URLSearchParams({
    apikey: apiKey,
    startDateTime: start,
    endDateTime: end.toISOString().replace(/\.\d+Z$/, "Z"),
    size: "50",
    sort: "relevance,desc",
    countryCode: "US",
  })
  if (classificationName) params.set("classificationName", classificationName)
  if (stateCode) params.set("stateCode", stateCode)

  try {
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`)
    if (!res.ok) return "(Ticketmaster API unavailable)"
    const data = await res.json()
    const events: TmEvent[] = data._embedded?.events || []
    if (!events.length) return "(No Ticketmaster events found for this query)"

    return events.map((ev, i) => {
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
  } catch {
    return "(Ticketmaster API error)"
  }
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

Today is ${date}. Generate a comprehensive deep research report covering event discovery, opportunity ranking, and signal analysis.

**Scope:** ${regionText}
**Categories:** ${catText}

## Research Data

### Web Search Results
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
- Include 15-30 discovered events across multiple categories and regions
- At least 3 different action types (not all BUY)
- At least 1 event with negative ROI
- All source_citations reference valid indexes in sources[]
- edge_score must match the weighted formula
- No confidence above 95, no STRONG_BUY below 80 confidence
- ROI formula: ((sale_price * 0.85) - buy_price) / buy_price * 100
- If data is insufficient for an event, lower confidence and note uncertainty

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
  const tmApiKey = Deno.env.get("TICKETMASTER_API_KEY") || "GVdlsX9jXKxl3aTFYMQPYaNjItOjnpHG"

  if (!youApiKey && !tmApiKey) {
    return new Response(JSON.stringify({ error: "No search APIs configured (need YOU_API_KEY or TICKETMASTER_API_KEY)" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const startTime = Date.now()
  const today = new Date().toISOString().split("T")[0]

  // Phase 1: Parallel data fetching — web search + Ticketmaster
  const searchQueries = buildSearchQueries(regions, categories, dateRange, focusAreas)

  const [searchData, ticketmasterData, research] = await Promise.all([
    youApiKey
      ? youSearch(searchQueries, youApiKey)
      : Promise.resolve("(Web search unavailable — YOU_API_KEY not configured)"),
    fetchTicketmaster(tmApiKey, categories, regions, dateRange),
    youApiKey
      ? youResearch(
          `Live event ticket trading opportunities ${regions.includes("nationwide") ? "nationwide US" : regions.join(", ")}: which concerts, sports events, and shows have the highest resale potential in the next few weeks? Include pricing data from StubHub, Ticketmaster, SeatGeek, and Vivid Seats. What events are trending, selling out, or going on sale soon?`,
          youApiKey,
          effortLevel,
        )
      : Promise.resolve({ content: "(Research API unavailable)", sources: [] as Array<{ url: string; title: string; snippets: string[] }> }),
  ])

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

  const response = {
    result,
    metadata: {
      search_queries_run: searchQueries.length,
      research_effort: effortLevel,
      total_sources: research.sources.length,
      generation_time_ms: Date.now() - startTime,
    },
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
