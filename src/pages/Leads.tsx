import { useState, useRef } from 'react'
import {
  Search, Plus, MessageCircle, Mail, Upload, Download,
  ChevronDown, X, Phone, Building2, Tag, FileText
} from 'lucide-react'
import type { Contact, Interaction } from '../lib/supabase'
import { useContacts, useInteractions, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Papa from 'papaparse'
import toast from 'react-hot-toast'

const SEGMENTOS = ['corporativo', 'food-service', 'varejo', 'eventos', 'representante', 'atacado']
const STATUS_LIST = ['novo', 'contatado', 'proposta-enviada', 'negociando', 'fechado', 'perdido']

const statusColors: Record<string, string> = {
  novo: 'bg-gray-100 text-gray-600 border-gray-200',
  contatado: 'bg-blue-50 text-blue-700 border-blue-200',
  'proposta-enviada': 'bg-purple-50 text-purple-700 border-purple-200',
  negociando: 'bg-amber-50 text-amber-700 border-amber-200',
  fechado: 'bg-green-50 text-green-700 border-green-200',
  perdido: 'bg-red-50 text-red-600 border-red-200',
}

const statusLabels: Record<string, string> = {
  novo: 'Novo', contatado: 'Contatado', 'proposta-enviada': 'Proposta Enviada',
  negociando: 'Negociando', fechado: 'Fechado', perdido: 'Perdido',
}

function exportCSV(contacts: Contact[]) {
  const rows = contacts.map(c => ({
    nome: c.name,
    empresa: c.company ?? '',
    email: c.email ?? '',
    telefone: c.phone ?? '',
    segmento: c.segment ?? '',
    status: c.status,
    notas: c.notes ?? '',
    fonte: c.source ?? '',
    criado_em: c.created_at,
    atualizado_em: c.updated_at,
  }))
  const csv = Papa.unparse(rows)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-solen-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildWhatsApp(phone: string, name: string, company?: string) {
  const clean = phone.replace(/\D/g, '')
  const msg = encodeURIComponent(
    `Olá ${name}${company ? ` da ${company}` : ''}, tudo bem? Sou Victor da Aris Importação, distribuidora oficial da Sölen Biscolata no Brasil. Gostaria de apresentar nossa linha de chocolates turcos premium. Posso enviar nosso catálogo?`
  )
  return `https://wa.me/55${clean}?text=${msg}`
}

function NeedFollowUp({ updatedAt }: { updatedAt: string }) {
  const days = differenceInDays(new Date(), parseISO(updatedAt))
  if (days < 3) return null
  return (
    <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
      {days}d
    </span>
  )
}

export default function Leads() {
  const { data: contacts, setData: setContacts, reload: reloadContacts } = useContacts()
  const [busca, setBusca] = useState('')
  const [filtroSegmento, setFiltroSegmento] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [selecionado, setSelecionado] = useState<Contact | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: interactions, setData: setInteractions } = useInteractions(selecionado?.id ?? null)
  const [novaInteracao, setNovaInteracao] = useState({ type: 'whatsapp', notes: '', next_action: '', next_action_date: '' })

  const filtered = contacts.filter(c => {
    const q = busca.toLowerCase()
    const matchBusca = !busca || c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
    const matchSegmento = !filtroSegmento || c.segment === filtroSegmento
    const matchStatus = !filtroStatus || c.status === filtroStatus
    return matchBusca && matchSegmento && matchStatus
  })

  function handleImportCSV(file: File) {
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        const mapped = rows.filter(r => r.name || r.nome).map(r => ({
          name: r.name || r.nome || '',
          company: r.company || r.empresa || '',
          email: r.email || '',
          phone: r.phone || r.telefone || r.whatsapp || '',
          segment: r.segment || r.segmento || '',
          status: 'novo',
          tags: [] as string[],
          source: 'importação',
        }))
        if (IS_CONFIGURED) {
          await Promise.all(mapped.map(c => db.createContact(c)))
          await reloadContacts()
        } else {
          const novos: Contact[] = mapped.map((c, i) => ({
            ...c, id: `import-${Date.now()}-${i}`,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }))
          setContacts(prev => [...prev, ...novos])
        }
        toast.success(`${mapped.length} contatos importados com sucesso!`)
        setShowImport(false)
      }
    })
  }

  async function handleSaveInteracao() {
    if (!selecionado || !novaInteracao.notes) return
    try {
      if (IS_CONFIGURED) {
        const nova = await db.createInteraction({ contact_id: selecionado.id, ...novaInteracao, created_by: 'Victor Hugo' })
        setInteractions(prev => [nova, ...prev])
        await db.updateContact(selecionado.id, { status: 'contatado' })
        await reloadContacts()
      } else {
        const nova: Interaction = { id: `int-${Date.now()}`, contact_id: selecionado.id, ...novaInteracao, created_by: 'Victor Hugo', created_at: new Date().toISOString() }
        setInteractions(prev => [nova, ...prev])
        setContacts(prev => prev.map(c => c.id === selecionado.id ? { ...c, updated_at: new Date().toISOString(), status: 'contatado' } : c))
      }
      setNovaInteracao({ type: 'whatsapp', notes: '', next_action: '', next_action_date: '' })
      toast.success('Interação registrada!')
    } catch {
      toast.error('Erro ao salvar interação')
    }
  }

  const fichaInteracoes = IS_CONFIGURED ? interactions : interactions.filter(i => i.contact_id === selecionado?.id)

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100dvh-3.5rem)] gap-3 max-w-7xl">

      {/* ── Lista ── */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden min-h-0">
        {/* Header */}
        <div className="p-3 border-b border-gray-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-gray-900">Leads</h1>
              <p className="text-xs text-gray-400">{filtered.length} contato{filtered.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportCSV(filtered)}
                title="Exportar como CSV"
                className="flex items-center gap-1 text-sm font-medium text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Exportar</span>
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1 text-sm font-medium text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload size={13} />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1 text-sm font-medium text-white bg-[#B82020] px-2.5 py-1.5 rounded-lg hover:bg-[#9E1C1C] transition-colors"
              >
                <Plus size={13} />
                <span className="hidden sm:inline">Novo</span>
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar nome, empresa ou e-mail..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B82020]/30 focus:border-[#B82020]"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <select
              value={filtroSegmento}
              onChange={e => setFiltroSegmento(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30 text-gray-600"
            >
              <option value="">Segmento</option>
              {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30 text-gray-600"
            >
              <option value="">Status</option>
              {STATUS_LIST.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
          </div>
        </div>

        {/* Lista de contatos — cards no mobile, tabela no desktop */}
        <div className="flex-1 overflow-auto">
          {/* Mobile: cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => setSelecionado(c)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer active:bg-gray-50 ${selecionado?.id === c.id ? 'bg-[#F7EEEE]' : ''}`}
              >
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-900 text-sm truncate">{c.name}</span>
                    <NeedFollowUp updatedAt={c.updated_at} />
                  </div>
                  {c.company && <div className="text-xs text-gray-400 truncate">{c.company}</div>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusColors[c.status]}`}>
                    {statusLabels[c.status]}
                  </span>
                  {c.phone && (
                    <a
                      href={buildWhatsApp(c.phone, c.name, c.company)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center justify-end gap-0.5 text-[10px] text-green-700 mt-1"
                    >
                      <MessageCircle size={10} />
                      WA
                    </a>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-gray-400">Nenhum lead encontrado</div>
            )}
          </div>

          {/* Desktop: tabela */}
          <table className="hidden md:table w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left font-medium text-gray-500 px-4 py-3">Nome / Empresa</th>
                <th className="text-left font-medium text-gray-500 px-4 py-3">Segmento</th>
                <th className="text-left font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-left font-medium text-gray-500 px-4 py-3">Contato</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setSelecionado(c)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${selecionado?.id === c.id ? 'bg-[#F7EEEE]' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.company && <div className="text-xs text-gray-400">{c.company}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {c.segment && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{c.segment}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[c.status]}`}>{statusLabels[c.status]}</span>
                    <NeedFollowUp updatedAt={c.updated_at} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.phone && (
                        <a href={buildWhatsApp(c.phone, c.name, c.company)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-md">
                          <MessageCircle size={11} />WhatsApp
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                          <Mail size={11} />E-mail
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400"><ChevronDown size={14} className="-rotate-90" /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">Nenhum lead encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Ficha: bottom sheet mobile / painel lateral desktop ── */}
      {selecionado && (
        <>
          {/* Overlay mobile */}
          <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSelecionado(null)} />

          <div className={`
            fixed bottom-16 left-0 right-0 z-40 max-h-[75vh] flex flex-col bg-white rounded-t-2xl shadow-2xl
            md:static md:max-h-none md:h-auto md:w-80 md:flex-shrink-0 md:rounded-xl md:shadow-none md:border md:border-gray-200
            overflow-hidden
          `}>
            {/* Handle mobile */}
            <div className="md:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-8 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="font-bold text-gray-900 text-sm">{selecionado.name}</h2>
                {selecionado.company && <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Building2 size={11} />{selecionado.company}</div>}
              </div>
              <button onClick={() => setSelecionado(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {/* Dados */}
              <div className="p-4 space-y-3 border-b border-gray-100">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[selecionado.status]}`}>{statusLabels[selecionado.status]}</span>
                  {selecionado.segment && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{selecionado.segment}</span>}
                </div>
                {selecionado.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={13} className="text-gray-400" />
                    <span className="text-gray-700">{selecionado.phone}</span>
                  </div>
                )}
                {selecionado.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={13} className="text-gray-400" />
                    <span className="text-gray-700 truncate">{selecionado.email}</span>
                  </div>
                )}
                {selecionado.tags && selecionado.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Tag size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {selecionado.tags.map(t => <span key={t} className="text-xs bg-[#F7EEEE] text-[#B82020] px-1.5 py-0.5 rounded">{t}</span>)}
                    </div>
                  </div>
                )}
                {selecionado.notes && <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">{selecionado.notes}</div>}
                {selecionado.phone && (
                  <a href={buildWhatsApp(selecionado.phone, selecionado.name, selecionado.company)} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full text-sm font-medium text-white bg-[#25D366] py-2.5 rounded-xl transition-colors active:bg-[#1da851]">
                    <MessageCircle size={15} />
                    Abrir WhatsApp
                  </a>
                )}
              </div>

              {/* Nova interação */}
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar Interação</h3>
                <div className="space-y-2">
                  <select value={novaInteracao.type} onChange={e => setNovaInteracao(p => ({ ...p, type: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="ligacao">Ligação</option>
                    <option value="email">E-mail</option>
                    <option value="visita">Visita</option>
                    <option value="reuniao">Reunião</option>
                  </select>
                  <textarea value={novaInteracao.notes} onChange={e => setNovaInteracao(p => ({ ...p, notes: e.target.value }))}
                    placeholder="O que aconteceu?" rows={2}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#B82020]/30" />
                  <input value={novaInteracao.next_action} onChange={e => setNovaInteracao(p => ({ ...p, next_action: e.target.value }))}
                    placeholder="Próxima ação"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30" />
                  <button onClick={handleSaveInteracao}
                    className="w-full text-sm font-medium text-white bg-[#B82020] py-2.5 rounded-xl transition-colors active:bg-[#9E1C1C]">
                    Registrar
                  </button>
                </div>
              </div>

              {/* Histórico */}
              <div className="p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                  <FileText size={11} />Histórico
                </h3>
                {fichaInteracoes.length === 0
                  ? <p className="text-xs text-gray-400">Sem interações registradas.</p>
                  : (
                    <div className="space-y-3">
                      {fichaInteracoes.map(i => (
                        <div key={i.id} className="text-xs bg-gray-50 rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-700 capitalize">{i.type}</span>
                            <span className="text-gray-400">{format(parseISO(i.created_at), "d MMM", { locale: ptBR })}</span>
                          </div>
                          <p className="text-gray-600">{i.notes}</p>
                          {i.next_action && <p className="text-[#B82020] mt-1">→ {i.next_action}</p>}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal: Novo Lead */}
      {showForm && <LeadFormModal onClose={() => setShowForm(false)} onSave={async (c) => {
        if (IS_CONFIGURED) { await reloadContacts() } else { setContacts(prev => [c, ...prev]) }
        setShowForm(false)
        toast.success('Lead adicionado!')
      }} />}

      {/* Modal: Importar CSV */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-1">Importar CSV</h2>
            <p className="text-sm text-gray-500 mb-4">
              Colunas: <code className="bg-gray-100 px-1 rounded text-xs">nome</code>, <code className="bg-gray-100 px-1 rounded text-xs">empresa</code>, <code className="bg-gray-100 px-1 rounded text-xs">telefone</code>, <code className="bg-gray-100 px-1 rounded text-xs">email</code>, <code className="bg-gray-100 px-1 rounded text-xs">segmento</code>
            </p>
            <input type="file" accept=".csv" ref={fileRef} onChange={e => { if (e.target.files?.[0]) handleImportCSV(e.target.files[0]) }} className="hidden" />
            <div className="flex gap-2">
              <button onClick={() => setShowImport(false)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl">Cancelar</button>
              <button onClick={() => fileRef.current?.click()} className="flex-1 text-sm font-medium text-white bg-[#B82020] py-2.5 rounded-xl">Selecionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeadFormModal({ onClose, onSave }: { onClose: () => void; onSave: (c: Contact) => void }) {
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', segment: '', status: 'novo', notes: '', source: 'manual'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return
    if (IS_CONFIGURED) {
      const created = await db.createContact({ ...form, tags: [] })
      onSave(created)
    } else {
      onSave({ id: `new-${Date.now()}`, ...form, tags: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Novo Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Nome *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30 focus:border-[#B82020]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Empresa</label>
              <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Segmento</label>
              <select value={form.segment} onChange={e => setForm(p => ({ ...p, segment: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30">
                <option value="">Selecionar</option>
                {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Telefone / WhatsApp</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="11987654321" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Notas</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#B82020]/30" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="flex-1 text-sm font-medium text-white bg-[#B82020] py-2 rounded-lg hover:bg-[#9E1C1C]">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
