import { useState, useMemo } from 'react'
import {
  Brain, Sparkles, Send, Edit3, Check, X, Phone, Mail, MapPin,
  TrendingUp, Calendar, AlertCircle, Loader2, MessageCircle,
  ChevronRight, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAiQualifiedLeads, useProspectingRuns, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { sendWhatsAppMessage, normalizePhoneBR, WHATSAPP_PROVIDER } from '../lib/whatsapp'
import { IS_LLM_CONFIGURED, LLM_MODEL } from '../lib/llm'
import { QUALIFICATION_THRESHOLD, DAILY_TARGET_LEADS } from '../lib/prospectingAgent'
import type { Contact } from '../lib/supabase'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function scoreBadgeColor(score: number): string {
  if (score >= 90) return 'bg-green-100 text-green-700 border-green-300'
  if (score >= QUALIFICATION_THRESHOLD) return 'bg-purple-100 text-purple-700 border-purple-300'
  if (score >= 50) return 'bg-amber-100 text-amber-700 border-amber-300'
  return 'bg-gray-100 text-gray-500 border-gray-300'
}

export default function Agente() {
  const { data: qualifiedLeads, reload: reloadLeads } = useAiQualifiedLeads()
  const { data: runs } = useProspectingRuns()

  const [filterMinScore, setFilterMinScore] = useState<number>(QUALIFICATION_THRESHOLD)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)

  const visibleLeads = useMemo(
    () => qualifiedLeads.filter(l => (l.lead_score ?? 0) >= filterMinScore),
    [qualifiedLeads, filterMinScore],
  )

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id)
    setEditDraft(contact.ai_draft_message ?? '')
  }

  const saveEdit = async () => {
    if (!editingId) return
    try {
      if (IS_CONFIGURED) {
        await db.updateContactAiFields(editingId, { ai_draft_message: editDraft })
      }
      toast.success('Mensagem atualizada')
      setEditingId(null)
      reloadLeads()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleSend = async (contact: Contact) => {
    if (!contact.phone) {
      toast.error('Lead sem telefone cadastrado')
      return
    }
    if (!contact.ai_draft_message) {
      toast.error('Sem mensagem para enviar')
      return
    }
    setSendingId(contact.id)
    try {
      const result = await sendWhatsAppMessage({
        to: contact.phone,
        body: contact.ai_draft_message,
      })
      if (result.status === 'failed') {
        toast.error(`Falha: ${result.error}`)
        return
      }
      // Log message + mark contact as contactado
      if (IS_CONFIGURED) {
        await db.logWhatsAppMessage({
          contact_id: contact.id,
          direction: 'outbound',
          body: contact.ai_draft_message,
          provider: WHATSAPP_PROVIDER === 'waha' ? 'waha' : WHATSAPP_PROVIDER === 'meta' ? 'meta_cloud' : 'wa_link',
          provider_message_id: result.providerMessageId,
          status: result.status,
        })
        await db.updateContact(contact.id, { lead_status: 'contactado' })
      }
      toast.success(
        WHATSAPP_PROVIDER === 'wa_link'
          ? 'WhatsApp aberto em nova aba — confira e envie manualmente'
          : 'Mensagem enviada com sucesso!',
      )
      reloadLeads()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSendingId(null)
    }
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────
  const todayRuns = runs.filter(r => {
    const today = new Date().toISOString().split('T')[0]
    return r.started_at.startsWith(today)
  })
  const totalQualifiedToday = todayRuns.reduce((acc, r) => acc + r.leads_qualified, 0)
  const totalTokensThisMonth = runs
    .filter(r => {
      const monthAgo = Date.now() - 30 * 86400000
      return new Date(r.started_at).getTime() >= monthAgo
    })
    .reduce((acc, r) => acc + r.llm_tokens_used, 0)
  const lastRun = runs[0]

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain size={20} className="text-purple-600" />
            Agente de Prospecção IA
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Leads qualificados automaticamente por <strong>{LLM_MODEL.split('/').pop()}</strong> — {DAILY_TARGET_LEADS}/dia
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
            IS_LLM_CONFIGURED
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            <div className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${IS_LLM_CONFIGURED ? 'bg-green-500' : 'bg-red-500'}`} />
            LLM {IS_LLM_CONFIGURED ? 'ativo' : 'offline'}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
            WHATSAPP_PROVIDER !== 'wa_link'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <div className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${WHATSAPP_PROVIDER !== 'wa_link' ? 'bg-green-500' : 'bg-amber-500'}`} />
            WhatsApp: {WHATSAPP_PROVIDER === 'waha' ? 'WAHA' : WHATSAPP_PROVIDER === 'meta' ? 'Meta API' : 'wa.me'}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp size={14} />}
          label="Qualificados hoje"
          value={totalQualifiedToday}
          sub={`Meta: ${DAILY_TARGET_LEADS}/dia`}
          color="purple"
        />
        <KpiCard
          icon={<Brain size={14} />}
          label="Total na fila"
          value={qualifiedLeads.length}
          sub="Aguardando contato"
          color="blue"
        />
        <KpiCard
          icon={<Sparkles size={14} />}
          label="Tokens (30d)"
          value={totalTokensThisMonth.toLocaleString('pt-BR')}
          sub="LLM usage"
          color="amber"
        />
        <KpiCard
          icon={<Calendar size={14} />}
          label="Última run"
          value={lastRun ? formatDistanceToNow(parseISO(lastRun.started_at), { locale: ptBR, addSuffix: true }) : '—'}
          sub={lastRun?.status ?? 'sem dados'}
          color="green"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
        <Filter size={13} className="text-gray-400" />
        <label className="text-xs text-gray-600 font-medium">Score mínimo:</label>
        <input
          type="range" min={0} max={100} step={5}
          value={filterMinScore}
          onChange={e => setFilterMinScore(Number(e.target.value))}
          className="flex-1 accent-purple-600 max-w-xs"
        />
        <span className="text-sm font-bold text-purple-700 min-w-[2.5em] text-right">{filterMinScore}</span>
        <span className="text-xs text-gray-400">{visibleLeads.length} de {qualifiedLeads.length}</span>
      </div>

      {/* Empty state */}
      {visibleLeads.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <Brain size={36} className="text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Nenhum lead qualificado ainda</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Vá em <strong>Prospecção Google Maps</strong>, busque negócios e clique em <strong>"Qualificar com IA"</strong> para a IA pontuar e gerar mensagens automaticamente.
          </p>
        </div>
      )}

      {/* Lead cards */}
      <div className="space-y-3">
        {visibleLeads.map(contact => {
          const isEditing = editingId === contact.id
          const isSending = sendingId === contact.id
          return (
            <div
              key={contact.id}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-purple-200 transition-colors"
            >
              {/* Header */}
              <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-gray-100">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${scoreBadgeColor(contact.lead_score ?? 0)}`}>
                      <Brain size={9} className="inline mr-0.5" />
                      {contact.lead_score}
                    </span>
                    <h3 className="font-semibold text-sm text-gray-900 truncate">{contact.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                    {contact.segment && <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">{contact.segment}</span>}
                    {contact.phone && (
                      <span className="flex items-center gap-1"><Phone size={9} />{contact.phone}</span>
                    )}
                    {contact.email && (
                      <span className="flex items-center gap-1"><Mail size={9} />{contact.email}</span>
                    )}
                    {contact.lat && contact.lng && (
                      <span className="flex items-center gap-1 text-green-600">
                        <MapPin size={9} />Geo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI rationale */}
              {contact.ai_rationale && (
                <div className="px-4 py-2 bg-purple-50/40 text-[11px] text-purple-700 italic flex items-start gap-1.5">
                  <Brain size={10} className="flex-shrink-0 mt-0.5" />
                  {contact.ai_rationale}
                </div>
              )}

              {/* Draft message */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                    Mensagem gerada pela IA
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(contact)}
                      className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <Edit3 size={10} /> Editar
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      rows={6}
                      className="w-full border border-purple-200 rounded-lg p-2 text-sm font-mono"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg"
                      >
                        <X size={11} className="inline mr-1" />Cancelar
                      </button>
                      <button
                        onClick={saveEdit}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-semibold"
                      >
                        <Check size={11} className="inline mr-1" />Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {contact.ai_draft_message ?? <em className="text-gray-400">Sem mensagem gerada</em>}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isEditing && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-400">
                    {contact.ai_qualified_at && (
                      <>Qualificado {formatDistanceToNow(parseISO(contact.ai_qualified_at), { locale: ptBR, addSuffix: true })}</>
                    )}
                  </span>
                  <div className="flex gap-2">
                    {contact.phone && (
                      <a
                        href={`https://wa.me/${normalizePhoneBR(contact.phone)}`}
                        target="_blank"
                        rel="noopener"
                        className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
                      >
                        <MessageCircle size={11} /> Abrir conversa
                      </a>
                    )}
                    <button
                      onClick={() => handleSend(contact)}
                      disabled={isSending || !contact.phone || !contact.ai_draft_message}
                      className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ea855] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isSending ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Send size={11} />
                      )}
                      {WHATSAPP_PROVIDER === 'wa_link' ? 'Enviar (wa.me)' : 'Enviar via WhatsApp'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recent runs */}
      {runs.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            Histórico de execuções
          </h2>
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {runs.slice(0, 10).map(run => (
              <div key={run.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      run.status === 'completed' ? 'bg-green-500'
                        : run.status === 'failed' ? 'bg-red-500'
                        : 'bg-amber-500 animate-pulse'
                    }`} />
                    <span className="text-sm font-medium text-gray-900">{run.search_query}</span>
                    <span className="text-xs text-gray-400">— {run.location}</span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {run.triggered_by}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] text-gray-500 mt-0.5">
                    <span>{run.apify_result_count} encontrados</span>
                    <span className="text-purple-600 font-semibold">{run.leads_qualified} qualificados</span>
                    <span className="text-green-600">{run.leads_created} criados</span>
                    {run.llm_tokens_used > 0 && <span>{run.llm_tokens_used.toLocaleString()} tokens</span>}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400">
                  {formatDistanceToNow(parseISO(run.started_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WAHA setup hint */}
      {WHATSAPP_PROVIDER === 'wa_link' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>WhatsApp ainda não conectado.</strong> Mensagens são abertas em nova aba no <code className="text-xs">wa.me</code> para envio manual.
              <div className="text-xs mt-1.5 text-amber-700">
                Para envio automático: deploy do WAHA (Docker grátis) ou Meta Cloud API. Veja docs em <strong>Templates WhatsApp → Configuração</strong>.
                <ChevronRight size={11} className="inline" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: 'purple' | 'blue' | 'amber' | 'green'
}) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }[color]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`p-1 rounded-lg border ${colorClasses}`}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
