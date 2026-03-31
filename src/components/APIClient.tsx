import { supabase } from '../lib/supabase'
import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import type { ModelTier } from '../lib/prompts'
import type { EventSearchResult, DeepResearchRequest, DeepResearchResult } from '../lib/types'

interface CallOptions {
  prompt: string
  modelTier?: ModelTier
  maxTokens?: number
  searchQueries?: string[]
}

type LLMContentBlock = {
  type?: string
  text?: string
}

type LLMResponsePayload = {
  content?: LLMContentBlock[] | string
  choices?: Array<{
    message?: {
      content?: string | LLMContentBlock[]
    }
  }>
  output_text?: string
}

function extractText(value: string | LLMContentBlock[] | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry?.type === 'text' && typeof entry.text === 'string')
      .map((entry) => entry.text)
      .join('')
  }

  return ''
}

async function buildFunctionError(error: Error, functionName: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    let detail: string
    try {
      const body = await error.context.json()
      detail = body?.error || body?.message || JSON.stringify(body)
    } catch {
      detail = error.message
    }
    return new Error(`${functionName} (${error.context.status}): ${detail}`)
  }
  if (error instanceof FunctionsRelayError) {
    return new Error(`${functionName} relay error: ${error.message}`)
  }
  return new Error(`${functionName}: ${error.message}`)
}

function normalizeLLMResponse(data: LLMResponsePayload | null): string {
  if (!data) {
    return ''
  }

  const directContent = extractText(data.content)
  if (directContent) {
    return directContent.replace(/```json\s*|```\s*/g, '').trim()
  }

  const choiceContent = extractText(data.choices?.[0]?.message?.content)
  if (choiceContent) {
    return choiceContent.replace(/```json\s*|```\s*/g, '').trim()
  }

  if (typeof data.output_text === 'string') {
    return data.output_text.replace(/```json\s*|```\s*/g, '').trim()
  }

  return ''
}

export async function callLLM({
  prompt,
  modelTier = 'standard',
  maxTokens = 4000,
  searchQueries = [],
}: CallOptions): Promise<string> {
  const { data, error } = await supabase.functions.invoke<LLMResponsePayload>('claude-proxy', {
    body: { prompt, modelTier, maxTokens, searchQueries },
  })

  if (error) throw await buildFunctionError(error, 'claude-proxy')

  const text = normalizeLLMResponse(data)
  if (!text) {
    throw new Error('Analysis engine returned an empty response')
  }

  return text
}

// Backward-compatible wrapper for pages that haven't migrated yet
export async function callClaude(prompt: string): Promise<string> {
  return callLLM({ prompt, modelTier: 'standard', searchQueries: [] })
}

// ---------------------------------------------------------------------------
// Event Search (lightweight — no LLM, just You.com search + parsing)
// ---------------------------------------------------------------------------

export async function searchEvents(query: string): Promise<EventSearchResult[]> {
  const { data, error } = await supabase.functions.invoke<EventSearchResult[]>('event-search', {
    body: { query },
  })

  if (error) throw await buildFunctionError(error, 'event-search')
  return data ?? []
}

// ---------------------------------------------------------------------------
// Deep Research (multi-phase: search → research → LLM synthesis)
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
  const { data, error } = await supabase.functions.invoke<DeepResearchResponse>('deep-research', {
    body: options,
  })

  if (error) throw await buildFunctionError(error, 'deep-research')

  if (!data) {
    throw new Error('Deep research returned no data')
  }

  return data
}
