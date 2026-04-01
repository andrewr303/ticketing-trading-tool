import type { ModelTier } from '../lib/prompts'
import type { EventSearchResult, DeepResearchRequest, DeepResearchResult } from '../lib/types'

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

interface CallOptions {
  prompt: string
  modelTier?: ModelTier
  maxTokens?: number
  searchQueries?: string[]
}

export async function callLLM({
  prompt,
  modelTier: _modelTier = 'standard',
  maxTokens = 4000,
  searchQueries: _searchQueries = [],
}: CallOptions): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing VITE_OPENROUTER_API_KEY. Add it to your .env file."
    );
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
      messages: [{ role: "user", content: prompt }],
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
// Event Search (lightweight — uses OpenRouter with search prompt)
// ---------------------------------------------------------------------------

export async function searchEvents(query: string): Promise<EventSearchResult[]> {
  const prompt = `Search for upcoming live events matching: "${query}". Return a JSON array of objects with fields: id (string), name (string), venue (string), date (string ISO), category ("concert"|"sports"|"theater"|"comedy"|"festival"|"other"), source (string), url (string, optional), price_range (string, optional). Return only the JSON array, no other text.`;
  const raw = await callLLM({ prompt, searchQueries: [query] });
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Deep Research (multi-phase: search + LLM synthesis via OpenRouter)
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
  const startTime = Date.now();
  const regions = options.regions?.join(', ') || 'nationwide';
  const categories = options.categories?.length ? options.categories.join(', ') : 'all categories';
  const dateRange = options.dateRange || 'next_2_weeks';

  const searchQueries = [
    `upcoming ${categories} events ${regions} tickets ${dateRange.replace(/_/g, ' ')}`,
    `ticket resale market trends ${regions} 2026`,
    `live event on-sale dates this week ${regions}`,
  ];

  const prompt = `You are a ticket market research analyst. Research upcoming live events for the ${regions} market, focusing on ${categories} in the ${dateRange.replace(/_/g, ' ')} timeframe. Effort level: ${options.effortLevel || 'standard'}.

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

Return only the JSON, no other text.`;

  const raw = await callLLM({ prompt, modelTier: 'advanced', maxTokens: 8000, searchQueries });
  const result: DeepResearchResult = JSON.parse(raw);

  return {
    result,
    metadata: {
      search_queries_run: searchQueries.length,
      research_effort: options.effortLevel || 'standard',
      total_sources: result.sources?.length || 0,
      generation_time_ms: Date.now() - startTime,
    },
  };
}
