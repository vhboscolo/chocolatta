import { useState } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Package, TrendingDown, Edit2, Check, X } from 'lucide-react'
import type { Product } from '../lib/supabase'
import { useProducts, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import toast from 'react-hot-toast'

const DESCONTOS = [
  { label: 'Tabela cheia', pct: 0 },
  { label: 'B2B 10%', pct: 10 },
  { label: 'B2B 15%', pct: 15 },
  { label: 'B2B 20%', pct: 20 },
  { label: 'B2B 30%', pct: 30 },
]

const SKU_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  'GOF.9607': { bg: 'bg-[#E0F5EC]', border: 'border-[#1A7F5A]/20', dot: 'bg-[#1A7F5A]' },
  'BIS.0705': { bg: 'bg-[#F3E8DD]', border: 'border-[#8B4513]/20', dot: 'bg-[#8B4513]' },
  'BIS.5705': { bg: 'bg-[#F7EEEE]', border: 'border-[#B82020]/20', dot: 'bg-[#B82020]' },
  'BIS.5700': { bg: 'bg-[#FDF8F8]', border: 'border-[#CC3333]/20', dot: 'bg-[#CC3333]' },
}

function ExpiryBadge({ date }: { date?: string }) {
  if (!date) return null
  const days = differenceInDays(parseISO(date), new Date())
  if (days <= 15) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      🔴 Vence em {days}d
    </span>
  )
  if (days <= 30) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      🟡 Vence em {days}d
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      🟢 Vence em {days}d
    </span>
  )
}

export default function Estoque() {
  const { data: products, setData: setProducts, reload: reloadProducts } = useProducts()
  const [canalPreco, setCanalPreco] = useState(0)
  const [editando, setEditando] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Product>>({})
  const [showBaixa, setShowBaixa] = useState<Product | null>(null)
  const [baixaQtd, setBaixaQtd] = useState(0)

  const totalValor = products.reduce((s, p) => s + p.quantity * p.unit_price, 0)
  const totalUnidades = products.reduce((s, p) => s + p.quantity, 0)
  const descontoAtual = DESCONTOS[canalPreco]

  function startEdit(p: Product) {
    setEditando(p.id)
    setEditForm({ quantity: p.quantity, unit_price: p.unit_price, expiry_date: p.expiry_date })
  }

  async function saveEdit(id: string) {
    try {
      if (IS_CONFIGURED) {
        await db.updateProduct(id, editForm)
        await reloadProducts()
      } else {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...editForm } : p))
      }
      setEditando(null)
      toast.success('Estoque atualizado!')
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  async function handleBaixa() {
    if (!showBaixa || baixaQtd <= 0) return
    if (baixaQtd > showBaixa.quantity) {
      toast.error('Quantidade insuficiente em estoque')
      return
    }
    try {
      if (IS_CONFIGURED) {
        await db.deductStock(showBaixa.id, baixaQtd)
        await reloadProducts()
      } else {
        setProducts(prev => prev.map(p =>
          p.id === showBaixa.id ? { ...p, quantity: p.quantity - baixaQtd } : p
        ))
      }
      toast.success(`Baixa de ${baixaQtd} unidades de ${showBaixa.name} realizada.`)
      setShowBaixa(null)
      setBaixaQtd(0)
    } catch {
      toast.error('Erro ao dar baixa')
    }
  }

  function precoComDesconto(preco: number) {
    return preco * (1 - descontoAtual.pct / 100)
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Estoque</h1>
        <p className="text-xs text-gray-500 mt-0.5">{totalUnidades.toLocaleString('pt-BR')} un · R$ {totalValor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
      </div>

      {/* Seletor de canal de preço */}
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="text-xs text-gray-500 mb-2 font-medium">Canal de preço</div>
        <div className="flex flex-wrap gap-1.5">
          {DESCONTOS.map((d, i) => (
            <button
              key={i}
              onClick={() => setCanalPreco(i)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                canalPreco === i ? 'bg-[#B82020] text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de produtos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map(p => {
          const colors = SKU_COLORS[p.sku] ?? { bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' }
          const isEditing = editando === p.id
          const precoFinal = precoComDesconto(p.unit_price)
          const valorTotal = p.quantity * precoFinal
          const maxQty = [42048, 33552, 5064, 6624]
          const idx = products.indexOf(p)
          const baseQty = maxQty[idx] ?? (p.quantity || 1)
          const pctEstoque = Math.min(100, (p.quantity / baseQty) * 100)

          return (
            <div key={p.id} className={`bg-white rounded-xl border ${colors.border} p-5`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                  <div>
                    <div className="text-xs text-gray-400 font-mono">{p.sku}</div>
                    <div className="font-bold text-gray-900 leading-tight">{p.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!isEditing ? (
                    <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-gray-700 p-1">
                      <Edit2 size={14} />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => saveEdit(p.id)} className="text-green-600 hover:text-green-700 p-1">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditando(null)} className="text-red-500 hover:text-red-600 p-1">
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Quantidade e preço */}
              <div className="flex items-end justify-between mb-3">
                <div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.quantity}
                      onChange={e => setEditForm(f => ({ ...f, quantity: +e.target.value }))}
                      className="text-2xl font-bold w-28 border-b-2 border-[#B82020] focus:outline-none bg-transparent"
                    />
                  ) : (
                    <div className="text-3xl font-bold text-gray-900">{p.quantity.toLocaleString('pt-BR')}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">unidades em estoque</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#B82020]">
                    R$ {precoFinal.toFixed(2).replace('.', ',')}
                    {descontoAtual.pct > 0 && (
                      <span className="text-xs text-gray-400 font-normal ml-1 line-through">
                        R$ {p.unit_price.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{descontoAtual.label}</div>
                  <div className="text-sm font-semibold text-gray-700 mt-0.5">
                    Total: R$ {valorTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Barra de estoque */}
              <div className="mb-3">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pctEstoque > 50 ? 'bg-green-500' : pctEstoque > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${pctEstoque}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{pctEstoque.toFixed(0)}% do estoque original</div>
              </div>

              {/* Validade */}
              <div className="flex items-center justify-between">
                <div>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.expiry_date ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, expiry_date: e.target.value }))}
                      className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                    />
                  ) : (
                    <>
                      {p.expiry_date && (
                        <div className="text-xs text-gray-400 mb-1">
                          Validade: {format(parseISO(p.expiry_date), "d MMM yyyy", { locale: ptBR })}
                        </div>
                      )}
                      <ExpiryBadge date={p.expiry_date} />
                    </>
                  )}
                </div>
                <button
                  onClick={() => { setShowBaixa(p); setBaixaQtd(0) }}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <TrendingDown size={12} />
                  Dar baixa
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela de preços por canal */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={16} className="text-[#C9A84C]" />
          Tabela de Preços por Canal
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left font-medium text-gray-500 py-2 pr-4">Produto</th>
                {DESCONTOS.map(d => (
                  <th key={d.label} className="text-center font-medium text-gray-500 py-2 px-3">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.sku}</div>
                  </td>
                  {DESCONTOS.map((d, i) => (
                    <td key={i} className={`text-center py-2.5 px-3 font-medium ${i === canalPreco ? 'text-[#B82020] font-bold' : 'text-gray-700'}`}>
                      R$ {(p.unit_price * (1 - d.pct / 100)).toFixed(2).replace('.', ',')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal baixa de estoque */}
      {showBaixa && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="font-bold text-gray-900 mb-1">Dar Baixa no Estoque</h2>
            <p className="text-sm text-gray-500 mb-4">{showBaixa.name} · {showBaixa.quantity.toLocaleString('pt-BR')} unidades disponíveis</p>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 block mb-1">Quantidade a retirar</label>
              <input
                type="number"
                min={1}
                max={showBaixa.quantity}
                value={baixaQtd}
                onChange={e => setBaixaQtd(+e.target.value)}
                className="w-full text-lg font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#B82020]"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBaixa(null)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleBaixa} className="flex-1 text-sm font-medium text-white bg-[#B82020] py-2 rounded-lg hover:bg-[#9E1C1C]">
                Confirmar baixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
