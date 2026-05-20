import { useState, useMemo } from 'react'
import {
  MapPin, Plus, X, ArrowRight, Sparkles, ExternalLink, Share2,
  Search, Filter, Building2, Phone, Route as RouteIcon, Clock,
  Trash2, Loader2, Home,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  optimizeRoute, DEFAULT_ORIGIN, routeTotalKm, buildGoogleMapsUrl,
  buildWhatsAppRoute,
  type RouteStop, type OptimizedRoute,
} from '../lib/routeOptimizer'
import { useContacts, useContactsWithCoords, IS_CONFIGURED } from '../hooks/useData'
import { geocodeAddress } from '../lib/apify'
import * as db from '../lib/db'
import type { Contact } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────

function contactToStop(c: Contact): RouteStop | null {
  if (c.lat == null || c.lng == null) return null
  return {
    id: c.id,
    name: c.name,
    address: (c.notes?.match(/Endereço:\s*(.+)/)?.[1] ?? c.company ?? c.name).split('\n')[0],
    lat: c.lat,
    lng: c.lng,
    phone: c.phone,
    segment: c.segment,
  }
}

function statusBadgeColor(status?: string): string {
  switch (status) {
    case 'frio': return 'bg-gray-100 text-gray-600 border-gray-200'
    case 'contactado': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'interessado': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'proposta': return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'cliente': return 'bg-green-50 text-green-700 border-green-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export default function Rotas() {
  const { data: contactsWithCoords, reload: reloadCoords } = useContactsWithCoords()
  const { data: allContacts } = useContacts()

  // State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [optimized, setOptimized] = useState<OptimizedRoute | null>(null)
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN)
  const [geocodingId, setGeocodingId] = useState<string | null>(null)
  const [originEditing, setOriginEditing] = useState(false)
  const [tmpOriginAddr, setTmpOriginAddr] = useState(origin.address)

  // Available contacts (with coords) — filtered by search + status
  const availableContacts = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return contactsWithCoords.filter(c => {
      if (statusFilter !== 'todos' && c.lead_status !== statusFilter) return false
      if (!term) return true
      return (
        c.name.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term) ||
        c.segment?.toLowerCase().includes(term)
      )
    })
  }, [contactsWithCoords, searchTerm, statusFilter])

  // Contacts WITHOUT coords (need geocoding)
  const contactsWithoutCoords = useMemo(
    () => allContacts.filter(c => c.lat == null || c.lng == null).slice(0, 5),
    [allContacts],
  )

  const selectedStops: RouteStop[] = useMemo(() => {
    return Array.from(selectedIds)
      .map(id => {
        const c = contactsWithCoords.find(x => x.id === id)
        return c ? contactToStop(c) : null
      })
      .filter((s): s is RouteStop => s !== null)
  }, [selectedIds, contactsWithCoords])

  const unoptimizedDistance = useMemo(
    () => routeTotalKm(origin, selectedStops),
    [origin, selectedStops],
  )

  // Actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setOptimized(null)
  }

  const clearAll = () => {
    setSelectedIds(new Set())
    setOptimized(null)
  }

  const handleOptimize = () => {
    if (selectedStops.length === 0) {
      toast.error('Selecione ao menos uma parada')
      return
    }
    if (selectedStops.length === 1) {
      toast('Apenas 1 parada — sem necessidade de otimização', { icon: 'ℹ️' })
    }
    const result = optimizeRoute(selectedStops, origin)
    setOptimized(result)
    toast.success(`Rota otimizada! ${result.totalDistanceKm.toFixed(1)} km — ${result.estimatedTimeMin} min`)
  }

  const handleOpenGoogleMaps = () => {
    const url = optimized?.googleMapsUrl ?? buildGoogleMapsUrl(origin, selectedStops)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleShareWhatsApp = () => {
    const stops = optimized?.stops ?? selectedStops
    const km = optimized?.totalDistanceKm ?? unoptimizedDistance
    const url = optimized?.googleMapsUrl ?? buildGoogleMapsUrl(origin, stops)
    const msg = buildWhatsAppRoute(origin, stops, km)
    window.open(`https://wa.me/?text=${msg}%0A%0A🔗 ${encodeURIComponent(url)}`, '_blank')
  }

  const handleSaveOrigin = () => {
    if (!tmpOriginAddr.trim()) { setOriginEditing(false); return }
    // Geocode the new origin
    geocodeAddress(tmpOriginAddr).then(coords => {
      if (!coords) { toast.error('Não foi possível localizar este endereço'); return }
      setOrigin({ name: 'Ponto de partida', address: tmpOriginAddr, ...coords })
      setOriginEditing(false)
      setOptimized(null)
      toast.success('Ponto de partida atualizado')
    })
  }

  const handleGeocodeContact = async (contact: Contact) => {
    const addr = (contact.notes?.match(/Endereço:\s*(.+)/)?.[1] ?? '').trim()
    if (!addr) {
      toast.error('Contato sem endereço cadastrado')
      return
    }
    setGeocodingId(contact.id)
    try {
      const coords = await geocodeAddress(addr)
      if (!coords) { toast.error('Endereço não localizado'); return }
      if (IS_CONFIGURED) {
        await db.saveContactCoords(contact.id, coords.lat, coords.lng)
      }
      toast.success(`${contact.name} geolocalizado!`)
      reloadCoords()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGeocodingId(null)
    }
  }

  const displayStops = optimized?.stops ?? selectedStops

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Otimização de Rotas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Monte rotas inteligentes com seus leads — economize gasolina e tempo de campo
        </p>
      </div>

      {/* Origin selector */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1E2535] text-white flex items-center justify-center flex-shrink-0">
            <Home size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
              Ponto de Partida
            </div>
            {originEditing ? (
              <div className="flex gap-2 mt-1">
                <input
                  value={tmpOriginAddr}
                  onChange={e => setTmpOriginAddr(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg"
                  placeholder="Av. Paulista, 1000, São Paulo"
                />
                <button
                  onClick={handleSaveOrigin}
                  className="text-xs bg-[#B82020] text-white px-3 py-1 rounded-lg"
                >
                  Salvar
                </button>
              </div>
            ) : (
              <button onClick={() => { setTmpOriginAddr(origin.address); setOriginEditing(true) }} className="text-sm font-semibold text-gray-900 mt-0.5 hover:underline truncate w-full text-left">
                {origin.name} <span className="font-normal text-gray-500">— {origin.address}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── LEFT: Contact list ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-400" />
                Leads disponíveis ({availableContacts.length})
              </h2>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar contato…"
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2"
              >
                <option value="todos">Todos</option>
                <option value="frio">Frio</option>
                <option value="contactado">Contactado</option>
                <option value="interessado">Interessado</option>
                <option value="proposta">Proposta</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
          </div>

          {availableContacts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-4 py-12 text-center">
              <div>
                <MapPin size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Nenhum lead com coordenadas geográficas.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Use <strong>Prospecção Google Maps</strong> para importar leads com lat/lng,
                  ou geocode contatos existentes abaixo.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto divide-y divide-gray-100">
              {availableContacts.map(c => {
                const selected = selectedIds.has(c.id)
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-2 px-4 py-3 cursor-pointer transition-colors ${
                      selected ? 'bg-[#B82020]/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelect(c.id)}
                      className="mt-1 accent-[#B82020] flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm text-gray-900 truncate">{c.name}</div>
                        <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full border ${statusBadgeColor(c.lead_status)}`}>
                          {c.lead_status ?? 'frio'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="flex-shrink-0" />
                        {c.lat?.toFixed(4)}, {c.lng?.toFixed(4)}
                      </div>
                      {c.segment && (
                        <span className="inline-block text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full mt-1">
                          {c.segment}
                        </span>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {/* Contacts without coords — geocode CTA */}
          {contactsWithoutCoords.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 bg-amber-50/40">
              <div className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold mb-1.5">
                Leads sem coordenadas ({contactsWithoutCoords.length})
              </div>
              <div className="space-y-1.5 max-h-32 overflow-auto">
                {contactsWithoutCoords.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-700">{c.name}</span>
                    <button
                      onClick={() => handleGeocodeContact(c)}
                      disabled={geocodingId === c.id}
                      className="flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-900 font-semibold disabled:opacity-50"
                    >
                      {geocodingId === c.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <MapPin size={10} />
                      )}
                      Geocodificar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Route builder ──────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <RouteIcon size={14} className="text-[#B82020]" />
              Rota {optimized ? 'otimizada' : 'em construção'} ({selectedStops.length} paradas)
            </h2>
            {selectedStops.length > 0 && (
              <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1">
                <Trash2 size={11} />
                Limpar
              </button>
            )}
          </div>

          {selectedStops.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-4 py-12 text-center">
              <div>
                <Plus size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Adicione paradas à sua rota</p>
                <p className="text-xs text-gray-400 mt-1">
                  Marque contatos na lista ao lado para começar
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                {/* Origin */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#1E2535] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    🏁
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-700">{origin.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{origin.address}</div>
                  </div>
                </div>

                {/* Stops */}
                {displayStops.map((stop, idx) => (
                  <div key={stop.id} className="px-4 py-3 border-b border-gray-100 flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full ${optimized ? 'bg-[#B82020]' : 'bg-gray-400'} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm text-gray-900 truncate">{stop.name}</div>
                        <button
                          onClick={() => toggleSelect(stop.id)}
                          className="text-gray-300 hover:text-red-500 flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        <MapPin size={9} />
                        {stop.address}
                      </div>
                      {stop.phone && (
                        <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone size={9} />
                          {stop.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Return to origin */}
                <div className="px-4 py-3 bg-gray-50 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#1E2535] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    🏁
                  </div>
                  <div className="text-xs text-gray-500">Retorno ao ponto de partida</div>
                </div>
              </div>

              {/* Stats */}
              <div className="border-t border-gray-100 px-4 py-3 bg-gradient-to-br from-gray-50 to-white">
                {optimized ? (
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Distância total</div>
                      <div className="font-bold text-lg text-gray-900">
                        {optimized.totalDistanceKm.toFixed(1)} <span className="text-xs font-normal">km</span>
                      </div>
                      {unoptimizedDistance > optimized.totalDistanceKm && (
                        <div className="text-[10px] text-green-600 font-semibold">
                          ↓ {(unoptimizedDistance - optimized.totalDistanceKm).toFixed(1)} km economizados
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Tempo estimado</div>
                      <div className="font-bold text-lg text-gray-900 flex items-center justify-center gap-1">
                        <Clock size={14} />
                        {Math.floor(optimized.estimatedTimeMin / 60)}h{(optimized.estimatedTimeMin % 60).toString().padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-gray-400">a 30 km/h</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-gray-500">
                    Distância (ordem atual): <span className="font-bold text-gray-900">{unoptimizedDistance.toFixed(1)} km</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-100 p-3 space-y-2">
                {!optimized ? (
                  <button
                    onClick={handleOptimize}
                    className="w-full flex items-center justify-center gap-2 bg-[#B82020] hover:bg-[#9a1b1b] text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    <Sparkles size={15} />
                    Otimizar rota
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleOpenGoogleMaps}
                      className="flex items-center justify-center gap-1.5 bg-[#1E2535] hover:bg-[#252d40] text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      <ExternalLink size={13} />
                      Abrir Maps
                    </button>
                    <button
                      onClick={handleShareWhatsApp}
                      className="flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1ea855] text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      <Share2 size={13} />
                      Enviar WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Help section */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs text-gray-600">
        <div className="flex items-start gap-2">
          <Filter size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-gray-900">Como funciona:</strong> O CRM calcula a rota mais curta
            entre o ponto de partida e todas as paradas selecionadas usando o algoritmo do{' '}
            <em>vizinho mais próximo</em>. A rota é depois aberta no Google Maps para navegação
            turn-by-turn, ou enviada via WhatsApp para o vendedor de campo.
            <ArrowRight size={11} className="inline ml-1" />
          </div>
        </div>
      </div>
    </div>
  )
}
