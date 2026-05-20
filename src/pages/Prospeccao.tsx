import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, MapPin, Loader2, CheckCircle2, AlertTriangle, XCircle,
  Phone, Mail, Star, Users, RefreshCw, ChevronDown, Building2,
  Sparkles, Brain } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  SP_CITIES, BUSINESS_TYPES, IS_APIFY_CONFIGURED,
  startGoogleMapsScrape, getRunStatus, getRunResults,
  normalizeLat, normalizeLng,
  type ApifyPlace, type ApifyRunStatus,
} from '../lib/apify'
import { IS_CONFIGURED, useDailyBriefing, useProducts, useOrders, useFollowUpTasks, useAllTrackedLinks } from '../hooks/useData'
import * as db from '../lib/db'
import { mockScrapeResults } from '../lib/mockData'
import { useContacts } from '../hooks/useData'
import { qualifyBatch, type QualificationResult, QUALIFICATION_THRESHOLD } from '../lib/prospectingAgent'
import { IS_LLM_CONFIGURED, LLM_MODEL } from '../lib/llm'
import { ProspectingSuggestions } from '../components/BriefingPanel'
import type { AiBriefing } from '../lib/supabase'

// ─── Dedup status ─────────────────────────────────────────────────────────

type DedupStatus = 'clean' | 'similar' | 'duplicate'

interface ScrapeRow {
  place: ApifyPlace
  selected: boolean
  dedup: DedupStatus
  dupContactName?: string
  ai?: QualificationResult       // populated after "Qualificar com IA"
}

function computeDedup(
  place: ApifyPlace,
  existing: { phone?: string; email?: string; name: string }[],
): { dedup: DedupStatus; dupContactName?: string } {
  const normalizePhone = (p?: string | null) => (p ?? '').replace(/\D/g, '').slice(-9)
  const normalizeEmail = (e?: string | null) => (e ?? '').toLowerCase().trim()

  const pPhone = normalizePhone(place.phone)
  const pEmail = normalizeEmail(place.email)

  for (const c of existing) {
    const cPhone = normalizePhone(c.phone)
    const cEmail = normalizeEmail(c.email)
    const phoneMatch = pPhone.length >= 8 && cPhone.length >= 8 && pPhone === cPhone
    const emailMatch = pEmail.length > 3 && cEmail.length > 3 && pEmail === cEmail
    if (phoneMatch && emailMatch) return { dedup: 'duplicate', dupContactName: c.name }
    if (phoneMatch || emailMatch) return { dedup: 'similar', dupContactName: c.name }
  }
  return { dedup: 'clean' }
}

// ─── Component ────────────────────────────────────────────────────────────

export default function Prospeccao() {
  const { data: existingContacts } = useContacts()
  const { data: products } = useProducts()
  const { data: orders } = useOrders()
  const { data: tasks } = useFollowUpTasks()
  const { data: links } = useAllTrackedLinks()

  // AI daily briefing — used for "Negócios sugeridos pela IA"
  const briefingState = useDailyBriefing({
    contacts: existingContacts,
    orders, products, tasks, links,
    autoGenerate: IS_LLM_CONFIGURED && IS_CONFIGURED,
  })

  // Form state
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0])
  const [customQuery, setCustomQuery] = useState('')
  const [city, setCity] = useState<string>('São Paulo')
  const [maxResults, setMaxResults] = useState(50)

  // Scrape state
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [runId, setRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<ApifyRunStatus | null>(null)
  const [rows, setRows] = useState<ScrapeRow[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // UI
  const [adding, setAdding] = useState(false)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)

  // AI qualification
  const [aiPhase, setAiPhase] = useState<'idle' | 'running'>('idle')
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  const handleQualifyAi = async () => {
    if (!IS_LLM_CONFIGURED) {
      toast.error('LLM não configurado. Adicione VITE_FIREWORKS_API_KEY ao .env.local')
      return
    }
    const toQualify = rows.filter(r => r.dedup !== 'duplicate' && !r.ai).map(r => r.place)
    if (!toQualify.length) {
      toast('Nenhum lead novo para qualificar', { icon: 'ℹ️' })
      return
    }
    setAiPhase('running')
    setAiProgress({ done: 0, total: toQualify.length })
    try {
      const results = await qualifyBatch(toQualify, (done, total) => setAiProgress({ done, total }))
      setRows(prev =>
        prev.map(r => {
          const ai = results.get(r.place.title)
          if (!ai) return r
          // Auto-select if qualified (and not duplicate)
          return {
            ...r,
            ai,
            selected: r.dedup !== 'duplicate' && ai.qualified,
          }
        }),
      )
      const qualified = Array.from(results.values()).filter(r => r.qualified).length
      toast.success(`${qualified} de ${results.size} leads qualificados pela IA`)
    } catch (e) {
      toast.error(`Erro na qualificação IA: ${(e as Error).message}`)
    } finally {
      setAiPhase('idle')
    }
  }

  // Poll Apify run status
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const processResults = useCallback(
    (places: ApifyPlace[]) => {
      const mapped: ScrapeRow[] = places.map(p => {
        const { dedup, dupContactName } = computeDedup(p, existingContacts)
        return {
          place: p,
          selected: dedup === 'clean', // auto-select only clean results
          dedup,
          dupContactName,
        }
      })
      setRows(mapped)
      setPhase('done')
    },
    [existingContacts],
  )

  useEffect(() => {
    if (!runId || phase !== 'running') return

    pollRef.current = setInterval(async () => {
      try {
        const run = await getRunStatus(runId)
        setRunStatus(run.status)

        if (run.status === 'SUCCEEDED') {
          stopPolling()
          const results = await getRunResults(runId, maxResults)
          processResults(results)
        } else if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.status)) {
          stopPolling()
          setPhase('error')
          setErrorMsg(`Busca encerrada com status: ${run.status}`)
        }
      } catch (e) {
        stopPolling()
        setPhase('error')
        setErrorMsg((e as Error).message)
      }
    }, 3000)

    return stopPolling
  }, [runId, phase, maxResults, stopPolling, processResults])

  const handleSearch = async (
    overrideQuery?: string,
    overrideLocation?: string,
  ) => {
    const query = overrideQuery ?? (customQuery.trim() || businessType.query)
    const loc = overrideLocation ?? city
    setPhase('running')
    setRows([])
    setErrorMsg('')
    setRunId(null)
    setRunStatus(null)

    // Mock mode: simulate 2s delay then show demo data
    if (!IS_APIFY_CONFIGURED) {
      setTimeout(() => processResults(mockScrapeResults), 2000)
      return
    }

    try {
      const id = await startGoogleMapsScrape({ searchQuery: query, location: loc, maxResults })
      setRunId(id)
      setRunStatus('RUNNING')
    } catch (e) {
      setPhase('error')
      setErrorMsg((e as Error).message)
    }
  }

  /** Triggered when user clicks an AI prospecting suggestion card */
  const handleAiSuggestionClick = (s: AiBriefing['prospecting_suggestions'][number]) => {
    setCustomQuery(s.search_query)
    // Try to extract a known city from the suggested region
    const cityMatch = (s.region || '').split(',').map(p => p.trim())
    const matchedCity = cityMatch.find(part => SP_CITIES.includes(part as (typeof SP_CITIES)[number]))
    if (matchedCity) setCity(matchedCity)
    // Compose final query: "padaria premium em Jardins"
    const fullQuery = `${s.search_query} em ${s.region}`
    toast.success(`IA escolheu: ${s.search_query} — ${s.region}`)
    handleSearch(fullQuery, matchedCity ?? city)
  }

  const toggleRow = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))
  }

  const toggleAll = () => {
    const anySelected = rows.some(r => r.selected)
    setRows(prev => prev.map(r => ({ ...r, selected: !anySelected })))
  }

  const handleAddLeads = async () => {
    const selected = rows.filter(r => r.selected)
    if (!selected.length) { toast.error('Selecione ao menos um resultado'); return }

    setAdding(true)
    try {
      const contacts = selected.map(({ place, ai }) => ({
        name: place.title,
        phone: place.phone ?? undefined,
        email: place.email ?? undefined,
        company: place.title,
        notes: [
          place.address ? `Endereço: ${place.address}` : null,
          place.website ? `Site: ${place.website}` : null,
          place.totalScore ? `Avaliação Google: ${place.totalScore}★ (${place.reviewsCount ?? 0} avaliações)` : null,
          place.categories?.length ? `Categoria: ${place.categories.join(', ')}` : null,
          ai?.rationale ? `IA: ${ai.rationale}` : null,
        ].filter(Boolean).join('\n'),
        segment: place.categories?.[0] ?? 'Alimentação',
        status: 'ativo',
        source: 'google-maps-scrape',
        lead_status: 'frio' as const,
        lat: normalizeLat(place),
        lng: normalizeLng(place),
        lead_score: ai?.score,
        ai_draft_message: ai?.draftMessage,
        ai_rationale: ai?.rationale,
        ai_qualified_at: ai ? new Date().toISOString() : undefined,
        ai_model: ai ? LLM_MODEL : undefined,
      }))

      if (IS_CONFIGURED) {
        await db.createContactsBulk(contacts)
      }
      // In mock mode: just show toast (no persistence)

      toast.success(
        `${selected.length} lead${selected.length > 1 ? 's' : ''} adicionado${selected.length > 1 ? 's' : ''} com sucesso!`,
      )
      // Mark added rows
      setRows(prev =>
        prev.map(r => (r.selected ? { ...r, selected: false, dedup: 'duplicate' } : r)),
      )
    } catch (e) {
      toast.error(`Erro ao criar leads: ${(e as Error).message}`)
    } finally {
      setAdding(false)
    }
  }

  const selectedCount = rows.filter(r => r.selected).length

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Prospecção Google Maps</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Busque potenciais compradores e importe como leads frios para o CRM
        </p>
      </div>

      {!IS_APIFY_CONFIGURED && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Modo demonstração</strong> — Adicione{' '}
            <code className="bg-amber-100 px-1 rounded text-xs">VITE_APIFY_TOKEN</code> ao{' '}
            <code className="bg-amber-100 px-1 rounded text-xs">.env.local</code> para buscas reais.
            Os resultados abaixo são dados de exemplo.
          </div>
        </div>
      )}

      {/* AI-suggested business types */}
      {IS_LLM_CONFIGURED && briefingState.briefing && (
        <ProspectingSuggestions
          briefing={briefingState.briefing}
          onRefresh={briefingState.generate}
          onSelect={(s) => handleAiSuggestionClick(s)}
        />
      )}
      {IS_LLM_CONFIGURED && !briefingState.briefing && !briefingState.loading && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center">
              <Brain size={16} />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-900">Pedir sugestões à IA</div>
              <div className="text-[10px] text-gray-600">
                A IA analisa seu CRM e sugere 5 buscas estratégicas
              </div>
            </div>
          </div>
          <button
            onClick={briefingState.generate}
            disabled={briefingState.generating}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            {briefingState.generating ? (
              <><Loader2 size={11} className="animate-spin" /> Analisando…</>
            ) : (
              <><Sparkles size={11} /> Analisar</>
            )}
          </button>
        </div>
      )}

      {/* Search form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Business type dropdown */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Tipo de negócio
            </label>
            <button
              onClick={() => setShowTypeDropdown(p => !p)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-left hover:border-gray-300 transition-colors"
            >
              <span>{businessType.label}</span>
              <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            </button>
            {showTypeDropdown && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {BUSINESS_TYPES.map(bt => (
                  <button
                    key={bt.query}
                    onClick={() => { setBusinessType(bt); setShowTypeDropdown(false); setCustomQuery('') }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Cidade
            </label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm appearance-none"
            >
              {SP_CITIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom query */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Busca personalizada <span className="font-normal text-gray-400">(opcional — substitui o tipo acima)</span>
          </label>
          <input
            value={customQuery}
            onChange={e => setCustomQuery(e.target.value)}
            placeholder={`Ex: "chocolate presente", "atacadista doces"`}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
          />
        </div>

        {/* Max results */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Máximo de resultados: <span className="text-gray-700 font-bold">{maxResults}</span>
          </label>
          <input
            type="range" min={10} max={200} step={10}
            value={maxResults}
            onChange={e => setMaxResults(Number(e.target.value))}
            className="w-full accent-[#B82020]"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>10</span><span>200</span>
          </div>
        </div>

        <button
          onClick={() => handleSearch()}
          disabled={phase === 'running'}
          className="w-full flex items-center justify-center gap-2 bg-[#B82020] hover:bg-[#9a1b1b] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
        >
          {phase === 'running' ? (
            <><Loader2 size={16} className="animate-spin" /> Buscando no Google Maps…</>
          ) : (
            <><Search size={16} /> Buscar no Google Maps</>
          )}
        </button>

        {/* Run status */}
        {phase === 'running' && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {IS_APIFY_CONFIGURED
              ? `Apify processando… ${runStatus ?? 'aguardando'}`
              : 'Simulando busca (modo demonstração)…'}
          </div>
        )}
      </div>

      {/* Error */}
      {phase === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700">
          <XCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div><strong>Erro na busca:</strong> {errorMsg}</div>
        </div>
      )}

      {/* Results */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Results header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-600" />
              <div>
                <span className="font-semibold text-gray-900 text-sm">
                  {rows.length} resultado{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
                </span>
                <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                  <span className="text-green-600">
                    ✓ {rows.filter(r => r.dedup === 'clean').length} novos
                  </span>
                  <span className="text-amber-600">
                    ~ {rows.filter(r => r.dedup === 'similar').length} similares
                  </span>
                  <span className="text-red-600">
                    ✗ {rows.filter(r => r.dedup === 'duplicate').length} duplicatas
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleQualifyAi}
                disabled={aiPhase === 'running' || rows.every(r => r.ai || r.dedup === 'duplicate')}
                className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-3 py-1.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={IS_LLM_CONFIGURED ? 'Pontuar e gerar mensagens com Kimi K2.6' : 'LLM não configurado'}
              >
                {aiPhase === 'running' ? (
                  <><Loader2 size={11} className="animate-spin" /> {aiProgress.done}/{aiProgress.total}</>
                ) : (
                  <><Sparkles size={11} /> Qualificar com IA</>
                )}
              </button>
              <button
                onClick={toggleAll}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {rows.some(r => r.selected) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
          </div>

          {/* Dedup legend */}
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
            <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />Novo — sem correspondência</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Similar — phone ou email coincide</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Duplicata — phone E email iguais</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const { place, selected, dedup, dupContactName, ai } = row
              const dedupColor =
                dedup === 'clean' ? 'border-green-200 bg-green-50/40'
                : dedup === 'similar' ? 'border-amber-200 bg-amber-50/40'
                : 'border-red-200 bg-red-50/30 opacity-60'

              return (
                <label
                  key={idx}
                  className={`flex gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${dedupColor}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleRow(idx)}
                    className="mt-1 accent-[#B82020] flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
                        <Building2 size={13} className="flex-shrink-0 text-gray-400" />
                        {place.title}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {ai && (
                          <span
                            title={ai.rationale}
                            className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                              ai.score >= QUALIFICATION_THRESHOLD
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                          >
                            <Brain size={10} />
                            IA {ai.score}
                          </span>
                        )}
                        {place.totalScore && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                            <Star size={10} fill="currentColor" />
                            {place.totalScore}
                          </span>
                        )}
                        {place.categories?.[0] && (
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {place.categories[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                      {place.address && (
                        <div className="flex items-start gap-1">
                          <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                          <span className="truncate">{place.address}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3">
                        {place.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} />{place.phone}
                          </span>
                        )}
                        {place.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={11} />{place.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {dedup !== 'clean' && dupContactName && (
                      <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${dedup === 'duplicate' ? 'text-red-600' : 'text-amber-600'}`}>
                        <Users size={10} />
                        {dedup === 'duplicate'
                          ? `Duplicata de "${dupContactName}" — não será importado`
                          : `Similar a "${dupContactName}" no CRM`}
                      </div>
                    )}

                    {/* AI rationale + draft preview */}
                    {ai && (
                      <div className="mt-2 p-2 bg-purple-50/40 border border-purple-100 rounded-lg space-y-1">
                        <div className="text-[10px] text-purple-700 italic flex items-start gap-1">
                          <Brain size={10} className="flex-shrink-0 mt-0.5" />
                          <span>{ai.rationale}</span>
                        </div>
                        {ai.draftMessage && (
                          <details className="mt-1">
                            <summary className="text-[10px] font-semibold text-purple-700 cursor-pointer hover:underline">
                              Ver mensagem gerada pela IA →
                            </summary>
                            <div className="mt-1 p-2 bg-white border border-purple-100 rounded text-[11px] text-gray-700 whitespace-pre-wrap">
                              {ai.draftMessage}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>

          {/* Add leads CTA */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{selectedCount}</span> selecionado{selectedCount !== 1 ? 's' : ''}
              {' '}<span className="text-gray-400">→ serão criados como leads frios, nunca contactados</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRows([]); setPhase('idle') }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <RefreshCw size={13} /> Nova busca
              </button>
              <button
                onClick={handleAddLeads}
                disabled={selectedCount === 0 || adding}
                className="flex items-center gap-2 bg-[#B82020] hover:bg-[#9a1b1b] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {adding ? (
                  <><Loader2 size={14} className="animate-spin" /> Adicionando…</>
                ) : (
                  <><Users size={14} /> Adicionar {selectedCount > 0 ? selectedCount : ''} como Leads</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
