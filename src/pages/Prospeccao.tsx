import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, MapPin, Loader2, CheckCircle2, AlertTriangle, XCircle,
  Phone, Mail, Star, Users, RefreshCw, ChevronDown, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  SP_CITIES, BUSINESS_TYPES, IS_APIFY_CONFIGURED,
  startGoogleMapsScrape, getRunStatus, getRunResults,
  normalizeLat, normalizeLng,
  type ApifyPlace, type ApifyRunStatus,
} from '../lib/apify'
import { IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { mockScrapeResults } from '../lib/mockData'
import { useContacts } from '../hooks/useData'

// ─── Dedup status ─────────────────────────────────────────────────────────

type DedupStatus = 'clean' | 'similar' | 'duplicate'

interface ScrapeRow {
  place: ApifyPlace
  selected: boolean
  dedup: DedupStatus
  dupContactName?: string
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

  const handleSearch = async () => {
    const query = customQuery.trim() || businessType.query
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
      const id = await startGoogleMapsScrape({ searchQuery: query, location: city, maxResults })
      setRunId(id)
      setRunStatus('RUNNING')
    } catch (e) {
      setPhase('error')
      setErrorMsg((e as Error).message)
    }
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
      const contacts = selected.map(({ place }) => ({
        name: place.title,
        phone: place.phone ?? undefined,
        email: place.email ?? undefined,
        company: place.title,
        notes: [
          place.address ? `Endereço: ${place.address}` : null,
          place.website ? `Site: ${place.website}` : null,
          place.totalScore ? `Avaliação Google: ${place.totalScore}★ (${place.reviewsCount ?? 0} avaliações)` : null,
          place.categories?.length ? `Categoria: ${place.categories.join(', ')}` : null,
        ].filter(Boolean).join('\n'),
        segment: place.categories?.[0] ?? 'Alimentação',
        status: 'ativo',
        source: 'google-maps-scrape',
        lead_status: 'frio' as const,
        lat: normalizeLat(place),
        lng: normalizeLng(place),
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
          onClick={handleSearch}
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
            <button
              onClick={toggleAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {rows.some(r => r.selected) ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
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
              const { place, selected, dedup, dupContactName } = row
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
