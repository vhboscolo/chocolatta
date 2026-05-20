/**
 * LLM abstraction layer.
 *
 * Provider-agnostic — current default: Kimi K2.6 via Fireworks AI.
 * Easy to swap to OpenAI / Anthropic / Groq / local Ollama by changing
 * VITE_LLM_PROVIDER + VITE_LLM_MODEL + VITE_*_API_KEY env vars.
 *
 * All providers normalize to OpenAI-compatible chat completion shape:
 *   { messages: [{ role, content }], temperature, max_tokens }
 *   → { content, tokensUsed }
 *
 * Token security note: keys with VITE_* prefix are exposed to the browser.
 * Acceptable for a single-tenant internal CRM, but for multi-tenant or
 * public-facing apps proxy through a Supabase Edge Function.
 */

export type LlmProvider = 'fireworks' | 'openai' | 'anthropic' | 'groq'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmCallParams {
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean    // request JSON output
}

export interface LlmResponse {
  content: string
  tokensUsed: number
  model: string
  provider: LlmProvider
}

// ─── Config ───────────────────────────────────────────────────────────────

const PROVIDER = (import.meta.env.VITE_LLM_PROVIDER as LlmProvider) ?? 'fireworks'
const MODEL = (import.meta.env.VITE_LLM_MODEL as string) ?? 'accounts/fireworks/models/kimi-k2p6'

function getApiKey(): string {
  switch (PROVIDER) {
    case 'fireworks': return (import.meta.env.VITE_FIREWORKS_API_KEY as string) ?? ''
    case 'openai':    return (import.meta.env.VITE_OPENAI_API_KEY as string) ?? ''
    case 'anthropic': return (import.meta.env.VITE_ANTHROPIC_API_KEY as string) ?? ''
    case 'groq':      return (import.meta.env.VITE_GROQ_API_KEY as string) ?? ''
  }
}

export const IS_LLM_CONFIGURED = !!getApiKey()
export const LLM_PROVIDER = PROVIDER
export const LLM_MODEL = MODEL

// ─── Provider endpoints (all use OpenAI-compatible /chat/completions) ────

const ENDPOINTS: Record<LlmProvider, string> = {
  fireworks: 'https://api.fireworks.ai/inference/v1/chat/completions',
  openai:    'https://api.openai.com/v1/chat/completions',
  groq:      'https://api.groq.com/openai/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',   // different shape — handled separately
}

// ─── Core call ────────────────────────────────────────────────────────────

export async function callLlm(params: LlmCallParams): Promise<LlmResponse> {
  if (!IS_LLM_CONFIGURED) {
    throw new Error(
      `LLM não configurado. Defina VITE_${PROVIDER.toUpperCase()}_API_KEY em .env.local`,
    )
  }

  const apiKey = getApiKey()

  // Anthropic uses a different shape
  if (PROVIDER === 'anthropic') {
    return callAnthropic(params, apiKey)
  }

  // OpenAI-compatible (Fireworks, OpenAI, Groq)
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: params.messages,
    temperature: params.temperature ?? 0.6,
    max_tokens: params.maxTokens ?? 2048,
    top_p: 1,
  }

  if (params.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(ENDPOINTS[PROVIDER], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LLM (${PROVIDER}) error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[]
    usage?: { total_tokens?: number }
    model?: string
  }

  return {
    content: json.choices?.[0]?.message?.content ?? '',
    tokensUsed: json.usage?.total_tokens ?? 0,
    model: json.model ?? MODEL,
    provider: PROVIDER,
  }
}

// Anthropic special-case
async function callAnthropic(params: LlmCallParams, apiKey: string): Promise<LlmResponse> {
  const systemMsg = params.messages.find(m => m.role === 'system')?.content
  const userMessages = params.messages.filter(m => m.role !== 'system')

  const res = await fetch(ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.6,
      system: systemMsg,
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    content: { text: string }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }

  const tokens = (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0)
  return {
    content: json.content?.[0]?.text ?? '',
    tokensUsed: tokens,
    model: MODEL,
    provider: 'anthropic',
  }
}

// ─── Safe JSON parsing ────────────────────────────────────────────────────

export function extractJson<T = unknown>(content: string): T | null {
  // Strip markdown code fences if present
  const cleaned = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim()
  // Try direct parse first
  try { return JSON.parse(cleaned) as T } catch { /* fallthrough */ }
  // Try to find a JSON object substring
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) as T } catch { /* noop */ }
  }
  return null
}
