import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Eye, CheckCircle2, X, ExternalLink, GripVertical } from 'lucide-react'
import { useOrders, useContacts, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import type { Order, Contact } from '../lib/supabase'
import toast from 'react-hot-toast'

const COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: 'proposta', label: 'Proposta', dot: 'bg-gray-400' },
  { key: 'aguardando-pagamento', label: 'Aguard. Pagamento', dot: 'bg-amber-400' },
  { key: 'pago', label: 'Pago', dot: 'bg-green-500' },
  { key: 'entregue', label: 'Entregue', dot: 'bg-blue-500' },
]

const STATUS_LABELS: Record<string, string> = {
  proposta: 'Proposta',
  'aguardando-pagamento': 'Aguard. Pagamento',
  pago: 'Pago',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const CANAIS = ['direto', 'sams-club', 'marketplace', 'representante']

function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export default function Pipeline() {
  const { data: orders, setData: setOrders, reload: reloadOrders } = useOrders()
  const { data: contacts } = useContacts()

  const [filtroCanal, setFiltroCanal] = useState<string>('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [detail, setDetail] = useState<Order | null>(null)

  const filtered = useMemo(
    () => (filtroCanal ? orders.filter(o => o.channel === filtroCanal) : orders),
    [orders, filtroCanal],
  )

  const ativos = filtered.filter(o => o.status !== 'cancelado')
  const totalAtivos = ativos.reduce((s, o) => s + (o.total ?? 0), 0)
  const cancelados = filtered.filter(o => o.status === 'cancelado').length

  function contactFor(order: Order): Contact | undefined {
    if (order.contact) return order.contact as Contact
    return contacts.find(c => c.id === order.contact_id)
  }

  async function moveOrder(id: string, novoStatus: string) {
    const order = orders.find(o => o.id === id)
    if (!order || order.status === novoStatus) return
    try {
      if (IS_CONFIGURED) {
        await db.updateOrderStatus(id, novoStatus)
        await reloadOrders()
      } else {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: novoStatus } : o))
      }
      if (novoStatus === 'pago' && order.status !== 'pago') {
        toast.success('Pedido pago — estoque baixado automaticamente')
      } else {
        toast.success(`Pedido movido para ${STATUS_LABELS[novoStatus] ?? novoStatus}`)
      }
    } catch {
      toast.error('Erro ao mover pedido')
    }
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function onDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overCol !== colKey) setOverCol(colKey)
  }

  function onDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    const id = dragId ?? e.dataTransfer.getData('text/plain')
    setDragId(null)
    setOverCol(null)
    if (id) moveOrder(id, colKey)
  }

  function onDragEnd() {
    setDragId(null)
    setOverCol(null)
  }

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {ativos.length} pedido{ativos.length !== 1 ? 's' : ''} em andamento · {fmtBRL(totalAtivos)} total
            {cancelados > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                {cancelados} cancelado{cancelados !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filtro de canais */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          onClick={() => setFiltroCanal('')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${!filtroCanal ? 'bg-[#B82020] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Todos canais
        </button>
        {CANAIS.map(c => {
          const count = orders.filter(o => o.channel === c).length
          return (
            <button
              key={c}
              onClick={() => setFiltroCanal(filtroCanal === c ? '' : c)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap capitalize ${filtroCanal === c ? 'bg-[#B82020] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {c} ({count})
            </button>
          )
        })}
      </div>

      {/* Kanban board */}
      <div className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none scrollbar-none -mx-1 px-1 pb-2">
        {COLUMNS.map(col => {
          const items = ativos.filter(o => o.status === col.key)
          const totalCol = items.reduce((s, o) => s + (o.total ?? 0), 0)
          const isOver = overCol === col.key
          return (
            <div
              key={col.key}
              onDragOver={e => onDragOver(e, col.key)}
              onDrop={e => onDrop(e, col.key)}
              onDragLeave={() => setOverCol(prev => prev === col.key ? null : prev)}
              className={`min-w-[260px] md:min-w-0 snap-start flex-shrink-0 md:flex-shrink rounded-xl border transition-colors ${
                isOver ? 'bg-[#B82020]/5 border-[#B82020]/40' : 'bg-gray-50/60 border-gray-200'
              }`}
            >
              <div className="px-3 pt-3 pb-2 sticky top-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h3 className="text-sm font-semibold text-gray-800 flex-1 truncate">{col.label}</h3>
                  <span className="text-xs text-gray-400 font-medium">{items.length}</span>
                </div>
                <div className="text-xs text-gray-400">{fmtBRL(totalCol)}</div>
              </div>

              <div className="p-2 pt-1 space-y-2 min-h-[120px]">
                {items.length === 0 && (
                  <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
                    <p className="text-xs text-gray-300">Nenhum pedido</p>
                  </div>
                )}
                {items.map(o => {
                  const c = contactFor(o)
                  const days = differenceInDays(new Date(), parseISO(o.created_at))
                  const isStale = days >= 7
                  const isDragging = dragId === o.id
                  return (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={e => onDragStart(e, o.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => setDetail(o)}
                      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all ${
                        isDragging ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical size={12} className="text-gray-300 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm leading-tight truncate">
                            {c?.name ?? 'Cliente'}
                          </div>
                          {c?.company && (
                            <div className="text-xs text-gray-400 truncate">{c.company}</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 font-bold text-gray-900 text-sm">
                        R$ {(o.total ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isStale ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {days}d
                        </span>
                        {o.channel && (
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                            {o.channel}
                          </span>
                        )}
                        {(o.view_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            <Eye size={10} />
                            {o.view_count}
                          </span>
                        )}
                        {o.accepted_at && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                            <CheckCircle2 size={10} />
                            {format(parseISO(o.accepted_at), 'd MMM', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Drawer detalhes */}
      {detail && (
        <OrderDetail order={detail} contact={contactFor(detail)} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function OrderDetail({ order, contact, onClose }: {
  order: Order
  contact: Contact | undefined
  onClose: () => void
}) {
  const days = differenceInDays(new Date(), parseISO(order.created_at))
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-xl max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="font-bold text-gray-900">{contact?.name ?? 'Cliente'}</h2>
            {contact?.company && <p className="text-xs text-gray-400">{contact.company}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Valor</div>
              <div className="font-bold text-gray-900">
                R$ {(order.total ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Status</div>
              <div className="font-semibold text-gray-900 text-sm">{STATUS_LABELS[order.status] ?? order.status}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Canal</div>
              <div className="font-medium text-gray-900 text-sm capitalize">{order.channel ?? '—'}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Desconto</div>
              <div className="font-medium text-gray-900 text-sm">{order.discount_pct}%</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Criado</div>
              <div className="font-medium text-gray-900 text-sm">{format(parseISO(order.created_at), 'd MMM yyyy', { locale: ptBR })}</div>
              <div className="text-xs text-gray-400 mt-0.5">{days}d atrás</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400">Visualizações</div>
              <div className="font-medium text-gray-900 text-sm">{order.view_count ?? 0}</div>
            </div>
          </div>

          {order.accepted_at && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 size={14} />
              Aceita em {format(parseISO(order.accepted_at), "d 'de' MMMM", { locale: ptBR })}
            </div>
          )}

          {order.valid_until && (
            <div className="text-xs text-gray-500">
              Validade da proposta: {format(parseISO(order.valid_until), 'd MMM yyyy', { locale: ptBR })}
            </div>
          )}

          {order.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{order.notes}</div>
          )}

          <Link
            to="/pedidos"
            className="flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-[#B82020] py-2.5 rounded-lg hover:bg-[#9E1C1C] transition-colors"
          >
            Ver pedido
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
