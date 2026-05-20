import { Brain, AlertTriangle, Flame, Snowflake, Sparkles, TrendingUp, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { AiBriefing } from '../lib/supabase'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  briefing: AiBriefing | null
  loading: boolean
  generating: boolean
  error: string | null
  onGenerate: () => void
  /** Compact mode (collapses sections by default) — useful inside Prospecção */
  compact?: boolean
  /** Hide everything except prospecting_suggestions (used in Prospecção page) */
  prospectingOnly?: boolean
}

function urgencyColor(u?: string): string {
  switch (u) {
    case 'alta':  return 'border-l-4 border-red-400 bg-red-50/50'
    case 'media': return 'border-l-4 border-amber-400 bg-amber-50/50'
    case 'baixa': return 'border-l-4 border-gray-300 bg-gray-50/50'
    default:      return 'border-l-4 border-gray-200 bg-gray-50/30'
  }
}

export default function BriefingPanel({
  briefing, loading, generating, error, onGenerate, compact = false, prospectingOnly = false,
}: Props) {
  const [expanded, setExpanded] = useState(!compact)

  // Loading state
  if (loading || generating) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 flex items-center gap-3">
        <Loader2 size={20} className="text-purple-600 animate-spin" />
        <div>
          <div className="font-semibold text-purple-900 text-sm">
            {generating ? 'IA analisando seu CRM…' : 'Carregando briefing…'}
          </div>
          {generating && (
            <div className="text-[10px] text-purple-700 mt-0.5">
              Pode levar até 30 segundos. Análise completa de leads, pipeline, estoque e oportunidades.
            </div>
          )}
        </div>
      </div>
    )
  }

  // No briefing yet
  if (!briefing) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center flex-shrink-0">
            <Brain size={18} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-sm">Briefing do Dia ainda não gerado</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Clique para a IA analisar seu CRM completo e gerar plano do dia + sugestões de prospecção.
            </p>
            {error && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
            <button
              onClick={onGenerate}
              className="mt-3 flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            >
              <Sparkles size={12} />
              Gerar briefing agora
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Prospecting-only mode ─────────────────────────────────────────────
  if (prospectingOnly) {
    return (
      <ProspectingSuggestions briefing={briefing} onRefresh={onGenerate} />
    )
  }

  // ─── Full briefing ─────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center flex-shrink-0">
            <Brain size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-gray-900 text-sm">
                Briefing do Dia — {new Date(briefing.briefing_date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onGenerate}
                  className="text-[10px] text-purple-700 hover:text-purple-900 flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-white/50"
                  title="Re-gerar briefing"
                >
                  <RefreshCw size={10} />
                  Atualizar
                </button>
                {compact && (
                  <button
                    onClick={() => setExpanded(e => !e)}
                    className="text-purple-700 hover:text-purple-900 p-1"
                  >
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>
            </div>
            {briefing.summary && (
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{briefing.summary}</p>
            )}
            <div className="text-[10px] text-purple-700/70 mt-2">
              Gerado {formatDistanceToNow(parseISO(briefing.generated_at), { locale: ptBR, addSuffix: true })}
              {briefing.tokens_used > 0 && ` · ${briefing.tokens_used.toLocaleString('pt-BR')} tokens`}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <>
          {/* Foco do dia */}
          {briefing.foco_do_dia?.length > 0 && (
            <Section title="Foco do dia" icon={<Sparkles size={14} className="text-purple-600" />}>
              {briefing.foco_do_dia.map((item, i) => (
                <ItemCard key={i} item={item} />
              ))}
            </Section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Leads quentes */}
            {briefing.leads_quentes?.length > 0 && (
              <Section title="Leads quentes" icon={<Flame size={14} className="text-red-500" />} compact>
                {briefing.leads_quentes.map((item, i) => (
                  <ItemCard key={i} item={item} />
                ))}
              </Section>
            )}

            {/* Leads esfriando */}
            {briefing.leads_esfriando?.length > 0 && (
              <Section title="Esfriando" icon={<Snowflake size={14} className="text-blue-500" />} compact>
                {briefing.leads_esfriando.map((item, i) => (
                  <ItemCard key={i} item={item} />
                ))}
              </Section>
            )}
          </div>

          {/* Riscos */}
          {briefing.riscos?.length > 0 && (
            <Section title="Atenção / Riscos" icon={<AlertTriangle size={14} className="text-amber-600" />}>
              {briefing.riscos.map((item, i) => (
                <ItemCard key={i} item={item} />
              ))}
            </Section>
          )}

          {/* Insights + Oportunidades side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {briefing.insights?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <h4 className="font-semibold text-xs text-gray-900 mb-2 flex items-center gap-1.5">
                  <Brain size={12} className="text-purple-600" /> Insights
                </h4>
                <ul className="space-y-1.5 text-xs text-gray-700">
                  {briefing.insights.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-purple-400">→</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.oportunidades?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <h4 className="font-semibold text-xs text-gray-900 mb-2 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-green-600" /> Oportunidades
                </h4>
                <ul className="space-y-1.5 text-xs text-gray-700">
                  {briefing.oportunidades.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-green-400">✦</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  function ItemCard({ item }: { item: { title: string; detail: string; urgency?: string; contact_id?: string } }) {
    return (
      <div className={`px-3 py-2 rounded-lg ${urgencyColor(item.urgency)}`}>
        <div className="text-xs font-semibold text-gray-900">{item.title}</div>
        <div className="text-[11px] text-gray-600 mt-0.5">{item.detail}</div>
      </div>
    )
  }
}

function Section({ title, icon, children, compact }: { title: string; icon: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
        {icon}
        <h4 className="font-semibold text-xs text-gray-900">{title}</h4>
      </div>
      <div className={compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2'}>
        {children}
      </div>
    </div>
  )
}

// ─── Prospecting Suggestions widget (used inside Prospecção page) ─────────

interface ProspectingSuggestionsProps {
  briefing: AiBriefing
  onRefresh: () => void
  onSelect?: (suggestion: AiBriefing['prospecting_suggestions'][number]) => void
}

export function ProspectingSuggestions({ briefing, onRefresh, onSelect }: ProspectingSuggestionsProps) {
  const suggestions = briefing.prospecting_suggestions ?? []

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 border border-purple-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center">
            <Brain size={14} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">Negócios sugeridos pela IA</h3>
            <p className="text-[10px] text-gray-600">
              Análise baseada em perfil Sölen + cobertura atual + região
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="text-[10px] text-purple-700 hover:text-purple-900 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/60"
        >
          <RefreshCw size={10} />
          Re-analisar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect?.(s)}
            disabled={!onSelect}
            className="text-left bg-white border border-purple-100 hover:border-purple-300 hover:shadow-md rounded-xl p-3 transition-all disabled:cursor-default group"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xl flex-shrink-0">{s.emoji}</span>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-gray-900 truncate">{s.search_query}</div>
                  <div className="text-[10px] text-gray-500 truncate">📍 {s.region}</div>
                </div>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                s.expected_value === 'alto' ? 'bg-green-50 text-green-700 border-green-200'
                  : s.expected_value === 'medio' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                {s.expected_value.toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] text-gray-600 leading-relaxed italic">{s.rationale}</p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div
                    key={j}
                    className={`w-1.5 h-1.5 rounded-full ${
                      (s.confidence / 20) > j ? 'bg-purple-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
                <span className="text-[9px] text-gray-400 ml-1">{s.confidence}%</span>
              </div>
              {onSelect && (
                <span className="text-[10px] font-semibold text-purple-700 group-hover:underline">
                  Buscar →
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
