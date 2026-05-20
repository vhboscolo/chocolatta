/**
 * AI Business Analyst
 *
 * Two responsibilities:
 *   1. generateDailyBriefing()  — full CRM data analysis → actionable plan of the day
 *   2. suggestProspectingTargets() — recommend what to scrape today based on
 *      coverage gaps, brand fit, and regional opportunities
 *
 * Both are bundled into one daily briefing object (cached 1/day in ai_briefings).
 *
 * The LLM receives:
 *   - Sölen brand context
 *   - CRM snapshot (aggregated stats, no PII bulk dumps)
 *   - Last 7-30 days operational data
 */

import { callLlm, extractJson, LLM_MODEL } from './llm'
import type {
  Contact, Order, Product, FollowUpTask, TrackedLink,
} from './supabase'
import { differenceInDays, parseISO } from 'date-fns'

// ─── Brand + analyst context ─────────────────────────────────────────────

const ANALYST_CONTEXT = `
EMPRESA: Aris Importação & Exportação — distribuidora oficial Sölen Biscolata Brasil.
PRODUTOS: Wafers premium turcos (Nutymax Pistache, DuoMax Avelã), Biscolata Mood (biscoito copo).
TARGET B2B: Supermercados premium, padarias gourmet, confeitarias, atacadistas alimentos,
lojas de conveniência, cafeterias, hotéis butique, empórios, distribuidores secundários.
PEDIDO MÍNIMO: R$ 500. ENTREGA: 24h em SP. META MENSAL: R$ 422.083.
DIFERENCIAIS: Origem turca premium, alto giro, margem atrativa, exclusividade.

VOCÊ É: Um analista de negócios sênior trabalhando dentro do CRM da Aris,
focado em maximizar receita, identificar riscos e gerar insights acionáveis.
TOM: Direto, prático, brasileiro. Foque em AÇÃO — não em obviedades.
`.trim()

// ─── Data structures ──────────────────────────────────────────────────────

export interface BriefingItem {
  title: string
  detail: string
  contact_id?: string
  urgency: 'alta' | 'media' | 'baixa'
}

export interface ProspectingSuggestion {
  search_query: string         // e.g. "padaria premium"
  region: string               // e.g. "Jardins, São Paulo"
  rationale: string            // 1-2 sentences
  confidence: number           // 0-100
  expected_value: 'alto' | 'medio' | 'baixo'
  emoji: string                // visual indicator (☕ 🍰 🥖 etc)
}

export interface DailyBriefing {
  summary: string
  foco_do_dia: BriefingItem[]
  leads_quentes: BriefingItem[]
  leads_esfriando: BriefingItem[]
  riscos: BriefingItem[]
  insights: string[]
  oportunidades: string[]
  prospecting_suggestions: ProspectingSuggestion[]
  tokensUsed: number
  model: string
}

// ─── CRM snapshot builder ────────────────────────────────────────────────

export interface CrmSnapshot {
  date: string
  totalContacts: number
  contactsByLeadStatus: Record<string, number>
  contactsBySegment: Record<string, number>
  contactsByCity: Record<string, number>           // extracted from notes
  hotLeads: { name: string; segment?: string; score?: number; reason: string }[]
  stuckLeads: { name: string; days_no_contact: number }[]
  todaysTasks: { contact: string; action: string }[]
  overdueTasks: { contact: string; days_overdue: number; action: string }[]
  ordersLast30Days: { count: number; total_revenue: number; avg_ticket: number }
  pipelineSummary: Record<string, number>          // by order status
  lowStock: { product: string; qty: number }[]
  expiringSoon: { product: string; days: number }[]
  topClickedLinks: { contact?: string; clicks: number }[]
  recentlyQualifiedByAi: number                    // AI-qualified in last 7d
}

export function buildCrmSnapshot(input: {
  contacts: Contact[]
  orders: Order[]
  products: Product[]
  tasks: FollowUpTask[]
  links: TrackedLink[]
}): CrmSnapshot {
  const today = new Date().toISOString().split('T')[0]
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 86400000
  const sevenDaysAgo = now - 7 * 86400000

  // Contacts breakdown
  const byLeadStatus: Record<string, number> = {}
  const bySegment: Record<string, number> = {}
  const byCity: Record<string, number> = {}
  input.contacts.forEach(c => {
    const ls = c.lead_status ?? 'sem_status'
    byLeadStatus[ls] = (byLeadStatus[ls] ?? 0) + 1
    if (c.segment) bySegment[c.segment] = (bySegment[c.segment] ?? 0) + 1
    // Best-effort city extraction from notes (Endereço: ..., São Paulo - SP)
    const addrMatch = c.notes?.match(/Endereço:[^,]*,\s*([^-,]+)\s*-\s*[A-Z]{2}/)
    const city = addrMatch?.[1]?.trim()
    if (city) byCity[city] = (byCity[city] ?? 0) + 1
  })

  // Hot leads: highest AI score among non-cliente
  const hotLeads = input.contacts
    .filter(c => c.lead_score != null && c.lead_status !== 'cliente')
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .slice(0, 10)
    .map(c => ({
      name: c.name,
      segment: c.segment,
      score: c.lead_score,
      reason: c.ai_rationale ?? 'Alto score IA',
    }))

  // Stuck leads: contactado/interessado without recent activity (no follow-up tasks)
  const stuckLeads = input.contacts
    .filter(c => c.lead_status === 'contactado' || c.lead_status === 'interessado')
    .map(c => {
      const daysSinceUpdate = differenceInDays(new Date(), parseISO(c.updated_at))
      return { name: c.name, days_no_contact: daysSinceUpdate }
    })
    .filter(c => c.days_no_contact >= 5)
    .sort((a, b) => b.days_no_contact - a.days_no_contact)
    .slice(0, 10)

  // Tasks
  const todaysTasks = input.tasks
    .filter(t => t.status === 'pendente' && t.scheduled_for === today)
    .map(t => ({
      contact: t.contact?.name ?? 'Desconhecido',
      action: t.label ?? t.action,
    }))

  const overdueTasks = input.tasks
    .filter(t => t.status === 'pendente' && t.scheduled_for < today)
    .map(t => ({
      contact: t.contact?.name ?? 'Desconhecido',
      action: t.label ?? t.action,
      days_overdue: differenceInDays(new Date(), parseISO(t.scheduled_for)),
    }))
    .sort((a, b) => b.days_overdue - a.days_overdue)
    .slice(0, 15)

  // Orders last 30d
  const recentOrders = input.orders.filter(o => new Date(o.created_at).getTime() >= thirtyDaysAgo)
  const totalRev = recentOrders.reduce((sum, o) => sum + (o.total ?? 0), 0)
  const ordersLast30Days = {
    count: recentOrders.length,
    total_revenue: totalRev,
    avg_ticket: recentOrders.length ? totalRev / recentOrders.length : 0,
  }

  // Pipeline
  const pipelineSummary: Record<string, number> = {}
  input.orders.forEach(o => {
    if (o.status !== 'entregue' && o.status !== 'cancelado') {
      pipelineSummary[o.status] = (pipelineSummary[o.status] ?? 0) + 1
    }
  })

  // Inventory alerts
  const lowStock = input.products
    .filter(p => p.quantity < 1000)
    .map(p => ({ product: p.name, qty: p.quantity }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 5)

  const expiringSoon = input.products
    .filter(p => p.expiry_date)
    .map(p => {
      const days = differenceInDays(parseISO(p.expiry_date!), new Date())
      return { product: p.name, days }
    })
    .filter(p => p.days <= 60 && p.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5)

  // Top clicked links
  const contactNameById = new Map(input.contacts.map(c => [c.id, c.name]))
  const topClickedLinks = input.links
    .filter(l => l.click_count > 0)
    .sort((a, b) => b.click_count - a.click_count)
    .slice(0, 5)
    .map(l => ({
      contact: l.contact_id ? contactNameById.get(l.contact_id) : undefined,
      clicks: l.click_count,
    }))

  // Recently AI-qualified
  const recentlyQualifiedByAi = input.contacts.filter(c =>
    c.ai_qualified_at && new Date(c.ai_qualified_at).getTime() >= sevenDaysAgo,
  ).length

  return {
    date: today,
    totalContacts: input.contacts.length,
    contactsByLeadStatus: byLeadStatus,
    contactsBySegment: bySegment,
    contactsByCity: byCity,
    hotLeads,
    stuckLeads,
    todaysTasks,
    overdueTasks,
    ordersLast30Days,
    pipelineSummary,
    lowStock,
    expiringSoon,
    topClickedLinks,
    recentlyQualifiedByAi,
  }
}

// ─── Briefing generator ──────────────────────────────────────────────────

export async function generateDailyBriefing(snapshot: CrmSnapshot): Promise<DailyBriefing> {
  const prompt = `${ANALYST_CONTEXT}

DADOS DO CRM HOJE (${snapshot.date}):
${JSON.stringify(snapshot, null, 2)}

TAREFA: Analise esse snapshot e produza o briefing DO DIA da Aris/Sölen.

Retorne APENAS um JSON válido (sem markdown, sem texto fora). Estrutura EXATA:
{
  "summary": "<2-3 frases executivas em PT-BR sobre o estado do negócio hoje>",
  "foco_do_dia": [
    { "title": "<ação curta>", "detail": "<justificativa breve>", "urgency": "alta|media|baixa", "contact_id": "<id se aplicável>" }
  ],
  "leads_quentes": [
    { "title": "<nome do lead>", "detail": "<por que está quente + ação>", "urgency": "alta|media|baixa", "contact_id": "<id>" }
  ],
  "leads_esfriando": [
    { "title": "<nome>", "detail": "<dias parado + sugestão>", "urgency": "media", "contact_id": "<id>" }
  ],
  "riscos": [
    { "title": "<problema>", "detail": "<impacto + ação imediata>", "urgency": "alta|media|baixa" }
  ],
  "insights": ["<observação 1>", "<observação 2>", "..."],
  "oportunidades": ["<oportunidade de mercado/produto/região>", "..."],
  "prospecting_suggestions": [
    {
      "search_query": "<termo de busca específico, ex: 'padaria premium' ou 'confeitaria gourmet'>",
      "region": "<bairro ou cidade específica, ex: 'Jardins, São Paulo' ou 'Campinas centro'>",
      "rationale": "<por que esta combinação tem alto potencial — 1-2 frases>",
      "confidence": <0-100>,
      "expected_value": "alto|medio|baixo",
      "emoji": "<1 emoji que representa o tipo de negócio>"
    }
  ]
}

REGRAS CRÍTICAS:
1. foco_do_dia: máximo 5 itens, ordenados por prioridade
2. leads_quentes: máximo 5 (pegue dos hotLeads do snapshot)
3. leads_esfriando: máximo 5 (pegue dos stuckLeads)
4. riscos: incluir baixo estoque, validade próxima, pagamentos atrasados, leads quentes parados
5. prospecting_suggestions: EXATAMENTE 5 sugestões DIFERENTES — varie tipo de negócio E região
6. As sugestões de prospecção devem considerar:
   - Segmentos onde NÃO há cobertura ainda (gap de mercado)
   - Regiões onde já temos clientes (expandir)
   - Match com perfil Sölen (premium, snack-shelf)
   - NÃO sugira o mesmo tipo de negócio que já dominamos
7. insights: padrões NÃO óbvios que você notou nos dados
8. oportunidades: ideias acionáveis (campanhas, produtos, regiões)
9. NÃO invente dados. Use APENAS o que está no snapshot.
10. Use português brasileiro coloquial mas profissional.`

  const response = await callLlm({
    messages: [
      { role: 'system', content: 'Você é um analista de negócios sênior. Responde sempre em JSON válido, em português brasileiro, com foco em ação.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    maxTokens: 4096,
    jsonMode: true,
  })

  const parsed = extractJson<Omit<DailyBriefing, 'tokensUsed' | 'model'>>(response.content)
  if (!parsed) {
    throw new Error(`LLM retornou JSON inválido. Conteúdo: ${response.content.slice(0, 300)}`)
  }

  // Sanity defaults
  return {
    summary: parsed.summary ?? '',
    foco_do_dia: parsed.foco_do_dia ?? [],
    leads_quentes: parsed.leads_quentes ?? [],
    leads_esfriando: parsed.leads_esfriando ?? [],
    riscos: parsed.riscos ?? [],
    insights: parsed.insights ?? [],
    oportunidades: parsed.oportunidades ?? [],
    prospecting_suggestions: parsed.prospecting_suggestions ?? [],
    tokensUsed: response.tokensUsed,
    model: LLM_MODEL,
  }
}

// ─── Just prospecting suggestions (lightweight call) ─────────────────────

export async function suggestProspectingTargets(snapshot: CrmSnapshot): Promise<ProspectingSuggestion[]> {
  // Reuse same briefing — caller should cache. This is a convenience wrapper.
  const briefing = await generateDailyBriefing(snapshot)
  return briefing.prospecting_suggestions
}
