import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Model routing -- matches MODEL_IDS in src/lib/prompts.ts
const MODEL_MAP: Record<string, string> = {
  standard: "minimax/minimax-m2.7",
  advanced: "openai/gpt-5.4-mini",
}

// ---------------------------------------------------------------------------
// You.com Web Search
// ---------------------------------------------------------------------------
async function youSearch(queries: string[]): Promise<string> {
  const apiKey = Deno.env.get("YOU_API_KEY")
  if (!apiKey || queries.length === 0) return "(No search results available)"

  const results: string[] = []

  for (const query of queries) {
    try {
      const url = `https://api.ydc-index.io/search?query=${encodeURIComponent(query)}&num_web_results=5`
      const res = await fetch(url, {
        headers: { "X-API-Key": apiKey },
      })
      if (!res.ok) continue
      const data = await res.json()

      if (data.hits && data.hits.length > 0) {
        for (const hit of data.hits.slice(0, 3)) {
          const snippets = (hit.snippets || []).join(" ").slice(0, 500)
          results.push(`[${hit.title}] (${hit.url})\n${snippets}`)
        }
      }
    } catch {
      // Skip failed queries, continue with others
    }
  }

  if (results.length === 0) return "(No search results available)"
  return results.join("\n\n---\n\n")
}

// ---------------------------------------------------------------------------
// OpenRouter LLM Call
// ---------------------------------------------------------------------------
async function callOpenRouter(
  model: string,
  prompt: string,
  maxTokens: number
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY")
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set")

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "https://ticket-trading.app",
      "X-Title": "Ticket Trading AI Suite",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${err}`)
  }

  return await response.json()
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Parse request
  const {
    prompt,
    modelTier = "standard",
    maxTokens = 4000,
    searchQueries = [],
  } = await req.json()

  const model = MODEL_MAP[modelTier] || MODEL_MAP.standard

  // Step 1: Run You.com searches if queries provided
  const searchResults = await youSearch(searchQueries)

  // Step 2: Inject search results into prompt if it has the placeholder
  const finalPrompt = prompt.includes("${searchResults}")
    ? prompt
    : prompt.replace(/\$\{searchResults\}/g, searchResults)

  // Step 3: Call OpenRouter
  const data = await callOpenRouter(model, finalPrompt, maxTokens)

  // Normalize response to match what the frontend expects
  // OpenRouter returns OpenAI-format: { choices: [{ message: { content } }] }
  // Transform to Anthropic-like format for frontend compatibility
  const choices = (data as { choices?: { message?: { content?: string } }[] }).choices
  const content = choices?.[0]?.message?.content || ""

  const normalized = {
    content: [{ type: "text", text: content }],
  }

  return new Response(JSON.stringify(normalized), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
