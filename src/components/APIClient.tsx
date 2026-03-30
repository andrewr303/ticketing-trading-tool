import { supabase } from '../lib/supabase'
import type { ModelTier } from '../lib/prompts'

interface CallOptions {
  prompt: string
  modelTier?: ModelTier
  maxTokens?: number
  searchQueries?: string[]
}

export async function callLLM({
  prompt,
  modelTier = 'standard',
  maxTokens = 4000,
  searchQueries = [],
}: CallOptions): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt, modelTier, maxTokens, searchQueries }),
    }
  )

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.content
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('')
  return text.replace(/```json\s*|```\s*/g, '').trim()
}

// Backward-compatible wrapper for pages that haven't migrated yet
export async function callClaude(prompt: string): Promise<string> {
  return callLLM({ prompt, modelTier: 'standard', searchQueries: [] })
}
