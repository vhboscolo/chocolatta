/**
 * Autonomous Prospecting Agent
 *
 * Pipeline (per lead):
 *   1. Apify Google Maps result → ApifyPlace
 *   2. LLM qualifies (returns score 0-100 + rationale)
 *   3. If score >= QUALIFICATION_THRESHOLD: LLM drafts WhatsApp first contact
 *   4. Save to contacts with lead_score, ai_draft_message, ai_rationale
 *
 * Runs:
 *   - Manually from Prospecção page ("Qualificar com IA")
 *   - Daily via cron (Supabase Edge Function — set up separately)
 *
 * Brand context fed to LLM:
 *   Aris is the official Sölen Biscolata distributor in Brazil.
 *   Premium Turkish chocolates/wafers — Nutymax (pistachio), DuoMax (hazelnut),
 *   Biscolata Mood, etc. Target: snack-shelf businesses with foot traffic.
 */

import { callLlm, extractJson, LLM_MODEL } from './llm'
import type { ApifyPlace } from './apify'

export const QUALIFICATION_THRESHOLD = 70   // score >= 70 = qualified
export const DAILY_TARGET_LEADS = 20         // user spec

// ─── Brand context (fed into every LLM call) ─────────────────────────────

const BRAND_CONTEXT = `
EMPRESA: Aris Importação & Exportação — distribuidora oficial da Sölen Biscolata no Brasil.
PRODUTOS PREMIUM:
- Nutymax Pistache 44g — wafer com creme de pistache turco coberto com chocolate ao leite
- DuoMax Avelã 44g — wafer recheado com avelã + cacau
- Biscolata Mood 125g — biscoito copo gourmet
- Biscolata Mood 40g — formato individual para presente corporativo
DIFERENCIAIS: Origem turca premium, alto giro em snack-shelf, margem atrativa, entrega 24h em SP.
PEDIDO MÍNIMO: R$ 500.
PERFIL IDEAL DE CLIENTE B2B:
- Supermercados de bairro, médios e grandes
- Padarias e confeitarias de alto padrão
- Atacadistas de alimentos
- Lojas de conveniência
- Cafeterias e empórios premium
- Distribuidores secundários
SINAIS POSITIVOS: avaliação Google >= 4.0, > 100 reviews, telefone disponível, categoria alinhada.
SINAIS NEGATIVOS: avaliação < 3.5, < 30 reviews, categoria irrelevante (oficinas, salões, etc).
`.trim()

// ─── Types ───────────────────────────────────────────────────────────────

export interface QualificationResult {
  score: number          // 0-100
  rationale: string      // brief justification in PT-BR
  qualified: boolean
  draftMessage?: string  // generated only if qualified
  tokensUsed: number
}

export interface AgentRunSummary {
  total: number
  qualified: number
  rejected: number
  errors: number
  tokensUsed: number
}

// ─── Qualification (LLM scoring) ─────────────────────────────────────────

export async function qualifyLead(place: ApifyPlace): Promise<QualificationResult> {
  const placeContext = [
    `Nome: ${place.title}`,
    place.categories?.length ? `Categoria(s): ${place.categories.join(', ')}` : null,
    place.address ? `Endereço: ${place.address}` : null,
    place.totalScore ? `Avaliação Google: ${place.totalScore}★` : null,
    place.reviewsCount ? `Total de avaliações: ${place.reviewsCount}` : null,
    place.phone ? `Telefone: disponível` : 'Telefone: NÃO disponível',
    place.email ? `E-mail: disponível` : null,
    place.website ? `Site: ${place.website}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `${BRAND_CONTEXT}

LEAD PARA AVALIAÇÃO:
${placeContext}

TAREFA: Analise se este negócio é um bom potencial cliente B2B para os produtos Sölen Biscolata.

Retorne APENAS um JSON válido (sem markdown, sem texto fora do JSON) com esta estrutura:
{
  "score": <inteiro 0-100>,
  "rationale": "<justificativa em até 200 caracteres, em português>"
}

Critérios de score:
- 90-100: Match perfeito (supermercado/padaria premium com alta avaliação e muitos reviews)
- 70-89: Bom potencial (categoria correta, avaliação OK)
- 50-69: Potencial limitado (categoria parcialmente alinhada ou avaliação baixa)
- 0-49: Não recomendado (categoria irrelevante ou sinais ruins)`

  const response = await callLlm({
    messages: [
      { role: 'system', content: 'Você é um analista de leads B2B especializado em distribuição de alimentos premium. Responde sempre em JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 200,
    jsonMode: true,
  })

  const parsed = extractJson<{ score: number; rationale: string }>(response.content)
  if (!parsed || typeof parsed.score !== 'number') {
    throw new Error(`LLM retornou JSON inválido: ${response.content.slice(0, 100)}`)
  }

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)))
  const qualified = score >= QUALIFICATION_THRESHOLD

  let draftMessage: string | undefined
  let totalTokens = response.tokensUsed

  if (qualified) {
    const draft = await draftFirstContact(place, score)
    draftMessage = draft.content
    totalTokens += draft.tokensUsed
  }

  return {
    score,
    rationale: parsed.rationale ?? '',
    qualified,
    draftMessage,
    tokensUsed: totalTokens,
  }
}

// ─── Draft first-contact WhatsApp message ────────────────────────────────

async function draftFirstContact(
  place: ApifyPlace,
  score: number,
): Promise<{ content: string; tokensUsed: number }> {
  const firstName = place.title.split(/\s|[-,]/)[0] // best-effort first name guess
  const city = place.address?.split(',').slice(-2, -1)[0]?.trim() ?? 'sua cidade'
  const category = place.categories?.[0] ?? 'seu negócio'

  const prompt = `${BRAND_CONTEXT}

LEAD QUALIFICADO (score ${score}):
Nome: ${place.title}
Categoria: ${category}
Cidade: ${city}
Avaliação Google: ${place.totalScore ?? '?'}★ (${place.reviewsCount ?? '?'} reviews)

TAREFA: Redija uma primeira mensagem de WhatsApp para este lead.

REGRAS RÍGIDAS:
1. Tom: amigável, profissional, brasileiro, NÃO robótico
2. Tamanho: máximo 4 frases curtas
3. Personalize com o nome do estabelecimento e algum elogio sutil (ex: "vi que vocês têm 4.5★")
4. Apresente Victor da Aris/Sölen em uma linha
5. Ofereça enviar o catálogo OU uma amostra cortesia
6. Termine com pergunta aberta (não "podemos conversar?" — algo como "posso enviar o catálogo?")
7. Use UM emoji apropriado (máximo 2 na mensagem inteira)
8. NÃO use "prezado", "venho por meio desta", "atenciosamente"
9. NÃO mencione preços
10. NÃO use markdown — texto puro

Retorne APENAS o texto da mensagem (sem aspas, sem JSON, sem markdown).`

  const response = await callLlm({
    messages: [
      { role: 'system', content: 'Você é o Victor, vendedor da Aris Importação. Escreve mensagens de WhatsApp humanas, curtas e diretas em português brasileiro.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 300,
  })

  // First name was unused — keep helper for future personalization tweaks
  void firstName

  return {
    content: response.content.trim().replace(/^["']|["']$/g, ''),  // strip stray quotes
    tokensUsed: response.tokensUsed,
  }
}

// ─── Batch qualification (used in Prospecção page) ───────────────────────

export async function qualifyBatch(
  places: ApifyPlace[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, QualificationResult>> {
  const results = new Map<string, QualificationResult>()

  // Sequential to avoid rate-limit hammering — LLM call ~2s each, 20 leads = ~40s
  for (let i = 0; i < places.length; i++) {
    const place = places[i]
    try {
      const result = await qualifyLead(place)
      results.set(place.title, result)
    } catch (e) {
      // Don't break the batch on a single failure
      results.set(place.title, {
        score: 0,
        rationale: `Erro: ${(e as Error).message.slice(0, 100)}`,
        qualified: false,
        tokensUsed: 0,
      })
    }
    onProgress?.(i + 1, places.length)
  }

  return results
}

// ─── Summary helper ──────────────────────────────────────────────────────

export function summarizeRun(results: Map<string, QualificationResult>): AgentRunSummary {
  let qualified = 0, rejected = 0, errors = 0, tokensUsed = 0
  results.forEach(r => {
    if (r.score === 0 && r.rationale.startsWith('Erro:')) errors++
    else if (r.qualified) qualified++
    else rejected++
    tokensUsed += r.tokensUsed
  })
  return { total: results.size, qualified, rejected, errors, tokensUsed }
}

export { LLM_MODEL }
