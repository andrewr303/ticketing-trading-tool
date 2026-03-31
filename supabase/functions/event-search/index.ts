import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Known venue names for extraction from snippets
const KNOWN_VENUES = [
  "Ball Arena", "Red Rocks", "Empower Field", "Coors Field",
  "Fiddler's Green", "Paramount Theatre", "1STBANK Center", "DCPA",
  "Madison Square Garden", "MSG", "SoFi Stadium", "Crypto.com Arena",
  "Chase Center", "United Center", "MetLife Stadium", "Hollywood Bowl",
  "Barclays Center", "TD Garden", "Staples Center", "Wrigley Field",
  "Yankee Stadium", "Dodger Stadium", "Oracle Park", "Fenway Park",
  "Climate Pledge Arena", "T-Mobile Arena", "Allegiant Stadium",
  "State Farm Arena", "Bridgestone Arena", "Nissan Stadium",
  "Toyota Center", "American Airlines Center", "AT&T Stadium",
  "Lucas Oil Stadium", "Mercedes-Benz Stadium", "FedExField",
  "Lincoln Financial Field", "Gillette Stadium", "Lumen Field",
  "Soldier Field", "Lambeau Field", "Arrowhead Stadium",
  "Hard Rock Stadium", "Raymond James Stadium",
]

const DATE_PATTERNS = [
  /(\w+ \d{1,2},?\s*\d{4})/,                    // "Jul 25, 2026" or "July 25 2026"
  /(\d{4}-\d{2}-\d{2})/,                         // "2026-07-25"
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/,                 // "7/25/2026"
  /(\w+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,    // "July 25th, 2026"
]

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  concert: ["concert", "tour", "music", "live", "album", "band", "singer", "festival", "setlist"],
  sports: ["vs", "game", "match", "nfl", "nba", "mlb", "nhl", "mls", "playoff", "championship", "season"],
  theater: ["broadway", "play", "musical", "theater", "theatre", "opera", "ballet"],
  comedy: ["comedy", "stand-up", "standup", "comedian", "special"],
  festival: ["festival", "fest", "coachella", "lollapalooza", "bonnaroo"],
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase()
  let best = "other"
  let bestCount = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const count = keywords.filter(k => lower.includes(k)).length
    if (count > bestCount) {
      bestCount = count
      best = cat
    }
  }
  return best
}

function extractDate(text: string): string {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const parsed = new Date(match[1])
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2025) {
        return parsed.toISOString().split("T")[0]
      }
      return match[1]
    }
  }
  return ""
}

function extractVenue(text: string): string {
  const lower = text.toLowerCase()
  for (const venue of KNOWN_VENUES) {
    if (lower.includes(venue.toLowerCase())) return venue
  }
  // Try "at [Venue]" pattern
  const atMatch = text.match(/(?:at|@)\s+([A-Z][A-Za-z\s&'.]+(?:Arena|Stadium|Center|Theatre|Theater|Field|Park|Bowl|Garden|Hall|Amphitheatre|Amphitheater|Pavilion))/i)
  if (atMatch) return atMatch[1].trim()
  return ""
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[|–—-]\s*(Tickets?|StubHub|SeatGeek|Vivid Seats|Ticketmaster|AXS|TickPick|LiveNation).*$/i, "")
    .replace(/\s*\(?\d{4}\)?\s*$/, "")
    .replace(/\s*Tickets?\s*$/i, "")
    .trim()
}

function extractSource(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return "unknown"
  }
}

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // Auth check
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
  const token = authHeader.replace("Bearer ", "")
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { query } = await req.json()
  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const apiKey = Deno.env.get("YOU_API_KEY")
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Search API not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Search You.com for events
  const searchQuery = `${query} tickets events concert sports 2026 2025`
  const url = `https://api.ydc-index.io/search?query=${encodeURIComponent(searchQuery)}&num_web_results=12`

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey },
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Search failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const data = await res.json()
  const hits = data.hits || []

  // Parse results into structured events
  const seen = new Set<string>()
  const results: Array<Record<string, unknown>> = []

  for (const hit of hits) {
    const snippets = (hit.snippets || []).join(" ")
    const fullText = `${hit.title} ${hit.description || ""} ${snippets}`

    const name = cleanTitle(hit.title)
    if (!name || name.length < 3) continue

    const venue = extractVenue(fullText)
    const date = extractDate(fullText)
    const category = detectCategory(fullText)
    const source = extractSource(hit.url)

    const id = simpleHash(`${name.toLowerCase()}${venue.toLowerCase()}${date}`)
    if (seen.has(id)) continue
    seen.add(id)

    // Extract price range from snippets
    let priceRange: string | null = null
    const priceMatch = snippets.match(/\$(\d+)\s*[-–to]+\s*\$(\d+)/)
    if (priceMatch) {
      priceRange = `$${priceMatch[1]}-$${priceMatch[2]}`
    }

    results.push({
      id,
      name,
      venue,
      date,
      category,
      source,
      url: hit.url,
      price_range: priceRange,
    })

    if (results.length >= 8) break
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
