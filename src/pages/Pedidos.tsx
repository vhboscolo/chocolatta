import { useState } from 'react'
import { Plus, ShoppingCart, X, ChevronDown, ChevronUp, Printer } from 'lucide-react'
import { mockProducts } from '../lib/mockData'
import type { Contact, Order } from '../lib/supabase'
import { useOrders, useContacts, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

function gerarPDF(order: Order, contact: Contact | undefined) {
  const dataEmissao = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const subtotal = (order.total ?? 0) / (1 - (order.discount_pct ?? 0) / 100)
  const desconto = subtotal - (order.total ?? 0)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta — ${contact?.name ?? 'Cliente'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1C1C1C; padding: 48px; max-width: 780px; margin: 0 auto; font-size: 14px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 20px; border-bottom: 3px solid #B82020; }
    .logo-name { font-size: 26px; font-weight: 900; color: #B82020; letter-spacing: -0.5px; }
    .logo-sub { font-size: 10px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
    .doc-info { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 700; color: #1C1C1C; }
    .doc-meta { font-size: 12px; color: #666; margin-top: 4px; }
    .doc-num { font-size: 11px; color: #aaa; margin-top: 2px; font-family: monospace; }
    .section { margin-bottom: 28px; }
    .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #aaa; font-weight: 700; margin-bottom: 10px; }
    .client-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f9f9f9; border-radius: 8px; padding: 16px; }
    .client-field label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
    .client-field span { font-weight: 600; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 700; padding: 10px 14px; background: #f5f5f5; text-align: left; }
    th:last-child { text-align: right; }
    td { padding: 12px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    td:last-child { text-align: right; font-weight: 500; }
    .subtotals { margin-top: 4px; border-top: 2px solid #eee; }
    .subtotals td { border-bottom: none; color: #666; font-size: 13px; }
    .subtotals td:first-child { padding-left: 14px; }
    .total-row td { font-size: 17px; font-weight: 800; color: #B82020; border-top: 2px solid #ddd; border-bottom: none; padding-top: 14px; }
    .badge { display: inline-block; background: #FEF3F2; color: #B82020; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 99px; border: 1px solid #FECACA; }
    .notes-box { background: #f9f9f9; border-radius: 8px; padding: 14px; font-size: 13px; color: #444; line-height: 1.6; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999; }
    .footer strong { color: #666; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-name">SÖLEN</div>
      <div class="logo-sub">Biscolata · Aris Importação</div>
    </div>
    <div class="doc-info">
      <div class="doc-title">Proposta Comercial</div>
      <div class="doc-meta">${dataEmissao}</div>
      <div class="doc-num">Nº ${order.id.slice(-8).toUpperCase()}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Cliente</div>
    <div class="client-grid">
      <div class="client-field"><label>Nome</label><span>${contact?.name ?? '—'}</span></div>
      <div class="client-field"><label>Empresa</label><span>${contact?.company ?? '—'}</span></div>
      <div class="client-field"><label>E-mail</label><span>${contact?.email ?? '—'}</span></div>
      <div class="client-field"><label>Telefone</label><span>${contact?.phone ?? '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Produtos / Serviços</div>
    <table>
      <thead>
        <tr>
          <th style="width:50%">Descrição</th>
          <th>Canal</th>
          <th>Qtd</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Linha Sölen Biscolata</strong><br>
            <span style="font-size:12px;color:#888">Chocolates turcos premium — distribuidora oficial Brasil</span>
          </td>
          <td style="text-transform:capitalize">${order.channel ?? '—'}</td>
          <td>—</td>
          <td>R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
      <tfoot class="subtotals">
        ${order.discount_pct > 0 ? `
        <tr>
          <td colspan="3" style="color:#16a34a">Desconto ${order.discount_pct}%</td>
          <td style="color:#16a34a">-R$ ${desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td>R$ ${(order.total ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  ${order.notes ? `
  <div class="section">
    <div class="section-label">Observações</div>
    <div class="notes-box">${order.notes}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-label">Validade</div>
    <p style="font-size:13px;color:#555">Esta proposta é válida por <strong>7 dias</strong> a partir da data de emissão. Pagamento: PIX, transferência bancária ou boleto. Entrega: São Paulo capital e Grande SP em 24h.</p>
  </div>

  <div class="footer">
    <strong>Aris Importação & Exportação Ltda.</strong> — Distribuidora oficial Sölen Biscolata no Brasil<br>
    vendas@arisimportacao.com.br · Este documento foi gerado pelo CRM Sölen e não possui validade fiscal.
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    toast.error('Permita pop-ups para gerar o PDF')
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 600)
}

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
  const { data: contacts } = useContacts()
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
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} · R$ {totalReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} recebidos
          </p>
        </div>
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#B82020] px-3 py-2 rounded-lg active:bg-[#9E1C1C] transition-colors"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Nova </span>Proposta
        </button>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
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
          const contato = contacts.find(c => c.id === o.contact_id)
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
                  <button
                    onClick={() => gerarPDF(o, contato)}
                    className="flex items-center gap-1.5 text-sm font-medium text-[#B82020] hover:text-[#9E1C1C] transition-colors"
                  >
                    <Printer size={14} />
                    Gerar PDF / Imprimir proposta
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
  const { data: contacts } = useContacts()
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
              {contacts.map(c => (
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
