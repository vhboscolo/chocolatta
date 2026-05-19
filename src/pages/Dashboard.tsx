import { TrendingUp, Users, Package, ShoppingCart, AlertTriangle, Clock } from 'lucide-react'
import { useProducts, useContacts, useOrders } from '../hooks/useData'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const META_RECEITA = 422083

function getExpiryStatus(dateStr?: string) {
  if (!dateStr) return null
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days <= 15) return { color: 'text-red-600 bg-red-50 border-red-200', label: `${days}d`, urgent: true }
  if (days <= 30) return { color: 'text-amber-600 bg-amber-50 border-amber-200', label: `${days}d`, urgent: false }
  return { color: 'text-green-700 bg-green-50 border-green-200', label: `${days}d`, urgent: false }
}

const statusLabels: Record<string, string> = {
  novo: 'Novo', contatado: 'Contatado', 'proposta-enviada': 'Proposta Enviada',
  negociando: 'Negociando', fechado: 'Fechado', perdido: 'Perdido',
}

const statusColors: Record<string, string> = {
  novo: 'bg-gray-100 text-gray-600',
  contatado: 'bg-blue-50 text-blue-700',
  'proposta-enviada': 'bg-purple-50 text-purple-700',
  negociando: 'bg-amber-50 text-amber-700',
  fechado: 'bg-green-50 text-green-700',
  perdido: 'bg-red-50 text-red-600',
}

export default function Dashboard() {
  const { data: products } = useProducts()
  const { data: contacts } = useContacts()
  const { data: orders } = useOrders()

  const totalEstoque = products.reduce((s, p) => s + p.quantity * p.unit_price, 0)
  const receita = orders.filter(o => o.status === 'pago').reduce((s, o) => s + (o.total ?? 0), 0)
  const progressoPct = Math.min((receita / META_RECEITA) * 100, 100)

  const diasCriticos = products
    .filter(p => {
      if (!p.expiry_date) return false
      return differenceInDays(parseISO(p.expiry_date), new Date()) <= 30
    })
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))

  const leadsPorStatus = ['novo', 'contatado', 'proposta-enviada', 'negociando', 'fechado', 'perdido'].map(s => ({
    status: s,
    count: contacts.filter(c => c.status === s).length,
  }))

  const semFollowUp = contacts.filter(c => {
    const diff = differenceInDays(new Date(), parseISO(c.updated_at))
    return diff >= 3 && !['fechado', 'perdido'].includes(c.status)
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral — {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp size={18} className="text-[#B82020]" />}
          label="Receita Realizada"
          value={`R$ ${receita.toLocaleString('pt-BR')}`}
          sub={`Meta: R$ ${META_RECEITA.toLocaleString('pt-BR')}`}
          accent
        />
        <KpiCard
          icon={<Package size={18} className="text-[#C9A84C]" />}
          label="Valor em Estoque"
          value={`R$ ${totalEstoque.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
          sub={`${products.reduce((s, p) => s + p.quantity, 0).toLocaleString('pt-BR')} unidades`}
        />
        <KpiCard
          icon={<Users size={18} className="text-[#1A7F5A]" />}
          label="Total de Leads"
          value={contacts.length.toString()}
          sub={`${contacts.filter(c => c.status === 'fechado').length} fechados`}
        />
        <KpiCard
          icon={<ShoppingCart size={18} className="text-blue-600" />}
          label="Pedidos Ativos"
          value={orders.filter(o => !['cancelado', 'entregue'].includes(o.status)).length.toString()}
          sub={`${orders.filter(o => o.status === 'pago').length} pagos`}
        />
      </div>

      {/* Progresso da meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="font-semibold text-gray-900">Progresso da Meta</div>
            <div className="text-sm text-gray-500">R$ {receita.toLocaleString('pt-BR')} de R$ {META_RECEITA.toLocaleString('pt-BR')}</div>
          </div>
          <div className="text-2xl font-bold text-[#B82020]">{progressoPct.toFixed(1)}%</div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#B82020] rounded-full transition-all duration-700"
            style={{ width: `${progressoPct}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Falta R$ {(META_RECEITA - receita).toLocaleString('pt-BR')} para a meta
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline de leads */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Pipeline de Leads</h2>
          <div className="space-y-2">
            {leadsPorStatus.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full min-w-[130px] ${statusColors[status]}`}>
                  {statusLabels[status]}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#B82020] rounded-full"
                    style={{ width: `${contacts.length ? (count / contacts.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="space-y-4">
          {/* Validades críticas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Validades Críticas
            </h2>
            {diasCriticos.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum produto próximo do vencimento.</p>
            ) : (
              <div className="space-y-2">
                {diasCriticos.map(p => {
                  const st = getExpiryStatus(p.expiry_date)!
                  return (
                    <div key={p.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.quantity.toLocaleString('pt-BR')} unidades</div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Follow-up atrasado */}
          {semFollowUp.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock size={16} className="text-amber-500" />
                Follow-up Necessário
              </h2>
              <div className="space-y-2">
                {semFollowUp.slice(0, 4).map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.company}</div>
                    </div>
                    <span className="text-xs text-amber-600 font-medium">
                      {differenceInDays(new Date(), parseISO(c.updated_at))}d sem contato
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estoque resumo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Estoque por Produto</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map(p => {
            const st = getExpiryStatus(p.expiry_date)
            const valor = (p.quantity * p.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
            return (
              <div key={p.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-500 mb-1 truncate">{p.sku}</div>
                <div className="font-semibold text-gray-900 text-sm leading-tight mb-2">{p.name}</div>
                <div className="text-lg font-bold text-gray-900">{p.quantity.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-gray-500 mb-2">unidades · {valor}</div>
                {st && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.color}`}>
                    {st.urgent ? '⚠ ' : ''}Vence em {st.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-[#B82020] text-white border-[#B82020]' : 'bg-white border-gray-200'}`}>
      <div className={`flex items-center gap-2 mb-3 ${accent ? 'text-white/80' : 'text-gray-500'}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${accent ? 'text-white/70' : 'text-gray-400'}`}>{sub}</div>
    </div>
  )
}
