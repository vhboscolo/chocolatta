import { useState } from 'react'
import { Plus, ShoppingCart, FileText, X, ChevronDown, ChevronUp } from 'lucide-react'
import { mockContacts, mockProducts } from '../lib/mockData'
import type { Order } from '../lib/supabase'
import { useOrders, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

const statusColors: Record<string, string> = {
  proposta: 'bg-gray-100 text-gray-600',
  'aguardando-pagamento': 'bg-amber-50 text-amber-700',
  pago: 'bg-green-50 text-green-700',
  entregue: 'bg-blue-50 text-blue-700',
  cancelado: 'bg-red-50 text-red-600',
}

const statusLabels: Record<string, string> = {
  proposta: 'Proposta',
  'aguardando-pagamento': 'Aguard. Pagamento',
  pago: 'Pago',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const CANAIS = ['direto', 'sams-club', 'marketplace', 'representante']
const STATUS_LIST = ['proposta', 'aguardando-pagamento', 'pago', 'entregue', 'cancelado']

const DESCONTOS_POLITICA = [
  { min: 0, max: 5000, label: 'Até R$ 5k', pct: 10 },
  { min: 5000, max: 15000, label: 'R$ 5k–R$ 15k', pct: 15 },
  { min: 15000, max: 40000, label: 'R$ 15k–R$ 40k', pct: 20 },
  { min: 40000, max: Infinity, label: 'Acima de R$ 40k', pct: 30 },
]

function getDescontoSugerido(total: number) {
  return DESCONTOS_POLITICA.find(d => total >= d.min && total < d.max)
}

export default function Pedidos() {
  const { data: orders, setData: setOrders, reload: reloadOrders } = useOrders()
  const [showNovo, setShowNovo] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('')

  const filtered = filtroStatus ? orders.filter(o => o.status === filtroStatus) : orders
  const totalReceita = orders.filter(o => o.status === 'pago').reduce((s, o) => s + (o.total ?? 0), 0)

  async function handleChangeStatus(id: string, novoStatus: string) {
    const order = orders.find(o => o.id === id)
    if (!order) return
    try {
      if (IS_CONFIGURED) {
        await db.updateOrderStatus(id, novoStatus)
        await reloadOrders()
      } else {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: novoStatus } : o))
      }
      if (novoStatus === 'pago' && order.status !== 'pago') {
        toast.success('Pedido pago — estoque baixado automaticamente.')
      }
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos & Propostas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} · R$ {totalReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} recebidos
          </p>
        </div>
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#B82020] px-4 py-2 rounded-lg hover:bg-[#9E1C1C] transition-colors"
        >
          <Plus size={14} />
          Nova Proposta
        </button>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroStatus('')}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${!filtroStatus ? 'bg-[#B82020] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Todos ({orders.length})
        </button>
        {STATUS_LIST.map(s => {
          const count = orders.filter(o => o.status === s).length
          return (
            <button
              key={s}
              onClick={() => setFiltroStatus(filtroStatus === s ? '' : s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filtroStatus === s ? 'bg-[#B82020] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {statusLabels[s]} ({count})
            </button>
          )
        })}
      </div>

      {/* Lista de pedidos */}
      <div className="space-y-3">
        {filtered.map(o => {
          const contato = mockContacts.find(c => c.id === o.contact_id)
          const isExpanded = expandido === o.id
          const desconto = getDescontoSugerido(o.total ?? 0)

          return (
            <div key={o.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandido(isExpanded ? null : o.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart size={16} className="text-gray-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {contato?.name ?? 'Cliente não encontrado'}
                      </div>
                      {contato?.company && (
                        <div className="text-xs text-gray-400">{contato.company}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[o.status]}`}>
                          {statusLabels[o.status]}
                        </span>
                        {o.channel && (
                          <span className="text-xs text-gray-400 capitalize">{o.channel}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {format(parseISO(o.created_at), "d MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-gray-900">
                        R$ {(o.total ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </div>
                      {o.discount_pct > 0 && (
                        <div className="text-xs text-gray-400">{o.discount_pct}% desconto</div>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {o.notes && (
                    <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{o.notes}</div>
                  )}
                  {desconto && (
                    <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      💡 Política de desconto para este volume: até {desconto.pct}% ({desconto.label})
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Atualizar status</label>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_LIST.map(s => (
                        <button
                          key={s}
                          onClick={() => handleChangeStatus(o.id, s)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            o.status === s
                              ? 'bg-[#B82020] text-white border-[#B82020]'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {statusLabels[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="flex items-center gap-1.5 text-sm font-medium text-[#B82020] hover:text-[#9E1C1C] transition-colors">
                    <FileText size={14} />
                    Gerar PDF da proposta
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ShoppingCart size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhum pedido encontrado.</p>
          </div>
        )}
      </div>

      {/* Modal nova proposta */}
      {showNovo && (
        <NovaProposta
          onClose={() => setShowNovo(false)}
          onSave={async (o) => {
            if (IS_CONFIGURED) {
              await db.createOrder(o)
              await reloadOrders()
            } else {
              setOrders(prev => [o, ...prev])
            }
            setShowNovo(false)
            toast.success('Proposta criada!')
          }}
        />
      )}
    </div>
  )
}

type ItemForm = { productId: string; quantity: number; unitPrice: number }

function NovaProposta({ onClose, onSave }: { onClose: () => void; onSave: (o: Order) => void }) {
  const [contactId, setContactId] = useState('')
  const [canal, setCanal] = useState('direto')
  const [notas, setNotas] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([{ productId: '', quantity: 1, unitPrice: 0 }])

  const subtotal = itens.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const descontoSugerido = getDescontoSugerido(subtotal)
  const descontoPct = descontoSugerido?.pct ?? 0
  const total = subtotal * (1 - descontoPct / 100)

  function addItem() {
    setItens(prev => [...prev, { productId: '', quantity: 1, unitPrice: 0 }])
  }

  function updateItem(index: number, field: keyof ItemForm, value: string | number) {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (field === 'productId') {
        const prod = mockProducts.find(p => p.id === value)
        return { ...item, productId: value as string, unitPrice: prod?.unit_price ?? 0 }
      }
      return { ...item, [field]: value }
    }))
  }

  function removeItem(index: number) {
    setItens(prev => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    if (!contactId) return
    onSave({
      id: `order-${Date.now()}`,
      contact_id: contactId,
      status: 'proposta',
      total,
      discount_pct: descontoPct,
      channel: canal,
      notes: notas,
      created_at: new Date().toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nova Proposta</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Cliente *</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
            >
              <option value="">Selecionar cliente</option>
              {mockContacts.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `— ${c.company}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Canal</label>
            <select
              value={canal}
              onChange={e => setCanal(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
            >
              {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Produtos</label>
              <button onClick={addItem} className="text-xs text-[#B82020] font-medium hover:text-[#9E1C1C] flex items-center gap-1">
                <Plus size={11} /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={item.productId}
                    onChange={e => updateItem(i, 'productId', e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                  >
                    <option value="">Produto</option>
                    {mockProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', +e.target.value)}
                    className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                  />
                  <input
                    type="number"
                    step={0.01}
                    value={item.unitPrice}
                    onChange={e => updateItem(i, 'unitPrice', +e.target.value)}
                    className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                  />
                  {itens.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>R$ {subtotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
            </div>
            {descontoSugerido && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Desconto sugerido ({descontoSugerido.label})</span>
                <span className="text-green-600">-{descontoSugerido.pct}%</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-gray-200 pt-1.5">
              <span>Total</span>
              <span className="text-[#B82020]">R$ {total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Observações</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!contactId || itens.every(i => !i.productId)}
            className="flex-1 text-sm font-medium text-white bg-[#B82020] py-2 rounded-lg hover:bg-[#9E1C1C] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Criar Proposta
          </button>
        </div>
      </div>
    </div>
  )
}
