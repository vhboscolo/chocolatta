import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, X, MessageCircle, Loader2, AlertTriangle } from 'lucide-react'
import type { Order } from '../../lib/supabase'
import * as db from '../../lib/db'
import { IS_CONFIGURED } from '../../hooks/useData'
import { mockOrders, mockContacts } from '../../lib/mockData'

const VICTOR_PHONE = '11999999999'

function whatsappVictor(message: string) {
  return `https://wa.me/55${VICTOR_PHONE}?text=${encodeURIComponent(message)}`
}

export default function ProposalView() {
  const { token } = useParams<{ token: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        if (IS_CONFIGURED) {
          db.incrementOrderView(token).catch(() => {})
          const result = await db.fetchOrderByToken(token)
          if (cancelled) return
          if (!result) { setNotFound(true) } else { setOrder(result) }
        } else {
          const mock = mockOrders.find(o => o.public_token === token)
          if (!mock) { setNotFound(true) } else {
            const contact = mockContacts.find(c => c.id === mock.contact_id)
            setOrder({ ...mock, contact })
          }
        }
      } catch {
        setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  async function handleAccept() {
    if (!token || !order) return
    setActionLoading(true)
    try {
      if (IS_CONFIGURED) {
        await db.acceptOrder(token)
      }
      setOrder({ ...order, accepted_at: new Date().toISOString(), status: 'aguardando-pagamento' })
    } catch {
      // silent
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!token || !order) return
    setActionLoading(true)
    try {
      if (IS_CONFIGURED) {
        await db.rejectOrder(token)
        // Anexa o motivo da recusa às notas (apenas Victor verá no CRM)
        if (rejectReason.trim()) {
          const novaNota = `[Recusada] ${rejectReason.trim()}\n\n${order.notes ?? ''}`.trim()
          await db.updateOrder(order.id, { notes: novaNota })
        }
      }
      setOrder({ ...order, rejected_at: new Date().toISOString(), status: 'cancelado' })
      setShowRejectModal(false)
    } catch {
      // silent
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 size={32} className="text-[#B82020] animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando proposta…</p>
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-10 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={26} className="text-[#B82020]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Proposta não encontrada
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Esta proposta não foi encontrada ou expirou. Entre em contato com Victor para receber uma nova proposta.
          </p>
          <a
            href={whatsappVictor('Olá Victor, recebi um link de proposta que não está mais disponível. Pode me enviar uma nova?')}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#25D366] px-5 py-3 rounded-xl hover:bg-[#1da851] transition-colors"
          >
            <MessageCircle size={15} />
            Falar com Victor
          </a>
        </div>
      </div>
    )
  }

  const contact = order.contact
  const total = order.total ?? 0
  const discountPct = Math.min(99.99, Math.max(0, order.discount_pct ?? 0))
  const subtotal = total / (1 - discountPct / 100)
  const desconto = subtotal - total
  const validUntil = order.valid_until ? parseISO(order.valid_until) : null
  const diasRestantes = validUntil ? differenceInDays(validUntil, new Date()) : null
  const expirada = diasRestantes !== null && diasRestantes < 0
  const isAccepted = !!order.accepted_at
  const isRejected = !!order.rejected_at

  // Expired
  if (expirada && !isAccepted && !isRejected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-10 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={26} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Proposta expirada
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Esta proposta expirou em {format(validUntil!, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.
            Entre em contato com Victor para renovar a oferta.
          </p>
          <a
            href={whatsappVictor(`Olá Victor, a proposta Nº ${order.id.slice(-8).toUpperCase()} expirou. Pode me enviar uma nova?`)}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#25D366] px-5 py-3 rounded-xl hover:bg-[#1da851] transition-colors"
          >
            <MessageCircle size={15} />
            Falar com Victor
          </a>
        </div>
      </div>
    )
  }

  const validityBadgeColor =
    diasRestantes === null ? 'bg-white/10 text-white border-white/20'
    : diasRestantes <= 0 ? 'bg-red-500/20 text-red-100 border-red-300/30'
    : diasRestantes <= 3 ? 'bg-amber-400/20 text-amber-100 border-amber-300/30'
    : 'bg-emerald-500/20 text-emerald-100 border-emerald-300/30'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-tight text-[#B82020]" style={{ fontFamily: 'Playfair Display, serif' }}>
              SÖLEN
            </div>
            <div className="text-[10px] text-gray-400 tracking-[2px] uppercase">Biscolata · Aris</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-gray-400 tracking-wider uppercase">Proposta</div>
              <div className="text-xs font-mono font-semibold text-gray-700">Nº {order.id.slice(-8).toUpperCase()}</div>
            </div>
            <a
              href={whatsappVictor(`Olá Victor, tenho uma dúvida sobre a proposta Nº ${order.id.slice(-8).toUpperCase()}`)}
              target="_blank" rel="noreferrer"
              title="Falar com Victor"
              className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white hover:bg-[#1da851] transition-colors"
            >
              <MessageCircle size={15} />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 pb-32 space-y-6">
        {/* Hero */}
        <section className="bg-gradient-to-br from-[#1E2535] to-[#0F1419] rounded-2xl p-8 text-white shadow-lg">
          <div className="text-[10px] tracking-[2px] uppercase text-white/60 font-medium mb-3">
            Proposta Comercial
          </div>
          <h1 className="text-3xl font-bold leading-tight mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            {contact?.company ?? 'Cliente'}
          </h1>
          {contact?.name && (
            <p className="text-sm text-white/70 mb-5">{contact.name}</p>
          )}
          {validUntil && !isAccepted && !isRejected && (
            <span className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${validityBadgeColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              Válida até {format(validUntil, "d MMM", { locale: ptBR })}
              {diasRestantes !== null && diasRestantes > 0 && (
                <span className="opacity-70">· {diasRestantes}d restantes</span>
              )}
            </span>
          )}
          {isAccepted && (
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-100 border border-emerald-300/30">
              <Check size={12} /> Aceita em {format(parseISO(order.accepted_at!), "d MMM yyyy", { locale: ptBR })}
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-500/20 text-red-100 border border-red-300/30">
              <X size={12} /> Declinada em {format(parseISO(order.rejected_at!), "d MMM yyyy", { locale: ptBR })}
            </span>
          )}
        </section>

        {/* Resumo */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-[10px] tracking-[2px] uppercase text-gray-400 font-bold mb-4">Resumo</h2>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="text-center px-2">
              <div className="text-xs text-gray-400 mb-1">Subtotal</div>
              <div className="font-semibold text-gray-700">
                R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-center px-2">
              <div className="text-xs text-gray-400 mb-1">Desconto</div>
              <div className="font-semibold text-emerald-600">
                {order.discount_pct > 0
                  ? `-R$ ${desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </div>
              {order.discount_pct > 0 && (
                <div className="text-[10px] text-emerald-600 mt-0.5">{order.discount_pct}% off</div>
              )}
            </div>
            <div className="text-center px-2">
              <div className="text-xs text-gray-400 mb-1">Total</div>
              <div className="font-bold text-[#B82020] text-lg">
                R$ {(order.total ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </section>

        {/* Detalhes */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-[10px] tracking-[2px] uppercase text-gray-400 font-bold">Detalhes</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400 mb-1">Data de emissão</div>
              <div className="font-medium text-gray-800">
                {format(parseISO(order.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </div>
            </div>
            {order.channel && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Canal</div>
                <div className="font-medium text-gray-800 capitalize">{order.channel}</div>
              </div>
            )}
          </div>
          {/* Observações internas (order.notes) ficam apenas no CRM — não vazam para o cliente */}
        </section>

        {/* Status final messages */}
        {isAccepted && (
          <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-3">
              <Check size={22} className="text-white" />
            </div>
            <h3 className="font-bold text-emerald-900 mb-1">Proposta aceita!</h3>
            <p className="text-sm text-emerald-700 mb-4">
              Victor entrará em contato em breve para combinar pagamento e entrega.
            </p>
            <a
              href={whatsappVictor(`Olá Victor, aceitei a proposta Nº ${order.id.slice(-8).toUpperCase()}. Vamos combinar os próximos passos.`)}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#25D366] px-5 py-2.5 rounded-xl hover:bg-[#1da851] transition-colors"
            >
              <MessageCircle size={14} />
              Falar com Victor
            </a>
          </section>
        )}

        {isRejected && (
          <section className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
            <h3 className="font-bold text-gray-700 mb-2">Esta proposta foi declinada</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se mudou de ideia ou precisa de outras condições, fale com Victor.
            </p>
            <a
              href={whatsappVictor('Olá Victor, gostaria de reabrir uma proposta que tinha declinado.')}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#25D366] px-5 py-2.5 rounded-xl hover:bg-[#1da851] transition-colors"
            >
              <MessageCircle size={14} />
              Falar com Victor
            </a>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-6 pb-4 text-xs text-gray-400 leading-relaxed">
          <div className="font-semibold text-gray-500">Aris Importação & Exportação Ltda.</div>
          <div>vendas@arisimportacao.com.br</div>
          <div className="mt-2 text-[10px]">Proposta gerada automaticamente — sem validade fiscal</div>
        </footer>
      </main>

      {/* Sticky bottom action bar */}
      {!isAccepted && !isRejected && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-30">
          <div className="max-w-2xl mx-auto px-5 py-4 space-y-2">
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 py-4 rounded-xl transition-colors disabled:opacity-60"
            >
              {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              Aceitar Proposta
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
            >
              Recusar / Reagendar
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-1">Recusar proposta</h2>
            <p className="text-sm text-gray-500 mb-4">
              Pode contar brevemente o motivo? Isso ajuda Victor a fazer uma oferta melhor.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ex: preço, prazo, não preciso agora…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#B82020]/30 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 text-sm font-medium text-white bg-[#B82020] py-2.5 rounded-xl hover:bg-[#9E1C1C] disabled:opacity-60"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
