import { useMemo } from 'react'
import {
  format, parseISO, subMonths, startOfMonth, endOfMonth, differenceInDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  TrendingUp, TrendingDown, BarChart3, PieChart, Users, Package, Clock, Inbox,
} from 'lucide-react'
import { useOrders, useContacts, useProducts } from '../hooks/useData'
import { mockProducts } from '../lib/mockData'
import type { Order, Contact, Product } from '../lib/supabase'

function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

const SEGMENT_COLORS: Record<string, string> = {
  corporativo: '#1E2535',
  'food-service': '#C9A84C',
  varejo: '#B82020',
  eventos: '#1A7F5A',
  atacado: '#8B4513',
  representante: '#4F46E5',
}

const STATUS_COLORS: Record<string, string> = {
  proposta: '#9CA3AF',
  'aguardando-pagamento': '#FBBF24',
  pago: '#22C55E',
  entregue: '#3B82F6',
}

const STATUS_LABELS: Record<string, string> = {
  proposta: 'Proposta',
  'aguardando-pagamento': 'Aguard. Pagamento',
  pago: 'Pago',
  entregue: 'Entregue',
}

export default function Relatorios() {
  const { data: orders } = useOrders()
  const { data: contacts } = useContacts()
  const { data: products } = useProducts()

  const metrics = useMemo(() => computeMetrics(orders, contacts), [orders, contacts])

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-xs text-gray-500 mt-0.5">Análise comercial · {format(new Date(), "MMMM yyyy", { locale: ptBR })}</p>
      </div>

      {/* A. KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Receita do mês"
          value={fmtBRL(metrics.receitaMes)}
          deltaPct={metrics.receitaDelta}
          trend={metrics.receitaTrend}
        />
        <KpiCard
          label="Pedidos novos"
          value={metrics.pedidosMes.toString()}
          deltaPct={metrics.pedidosDelta}
          trend={metrics.pedidosTrend}
        />
        <KpiCard
          label="Taxa conversão"
          value={`${metrics.conversao.toFixed(0)}%`}
          deltaPct={metrics.conversaoDelta}
          trend={metrics.conversaoTrend}
        />
        <KpiCard
          label="Ticket médio"
          value={fmtBRL(metrics.ticketMedio)}
          deltaPct={metrics.ticketDelta}
          trend={metrics.ticketTrend}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* B. Receita mensal */}
        <SectionCard
          title="Receita mensal"
          subtitle="Últimos 6 meses · pedidos pagos"
          icon={<BarChart3 size={16} className="text-[#B82020]" />}
        >
          {metrics.receitaMensal.length === 0 || metrics.receitaMensal.every(m => m.value === 0) ? (
            <EmptyState icon={<BarChart3 size={28} className="text-gray-200" />} text="Sem receita registrada" />
          ) : (
            <HorizontalBarChart data={metrics.receitaMensal} />
          )}
        </SectionCard>

        {/* C. Pipeline funnel */}
        <SectionCard
          title="Pipeline funnel"
          subtitle="Distribuição de pedidos por etapa"
          icon={<TrendingDown size={16} className="text-[#C9A84C]" />}
        >
          {metrics.funnel.every(f => f.count === 0) ? (
            <EmptyState icon={<Inbox size={28} className="text-gray-200" />} text="Nenhum pedido no pipeline" />
          ) : (
            <FunnelChart steps={metrics.funnel} />
          )}
        </SectionCard>
      </div>

      {/* D. Produtos mais vendidos */}
      <SectionCard
        title="Produtos mais vendidos"
        subtitle="Top 3 por receita estimada · demonstração"
        icon={<Package size={16} className="text-[#B82020]" />}
      >
        {products.length === 0 ? (
          <EmptyState icon={<Package size={28} className="text-gray-200" />} text="Nenhum produto cadastrado" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {metrics.topProducts.map(tp => (
              <div key={tp.product.id} className="flex items-center gap-3 border border-gray-200 rounded-xl p-3">
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {tp.product.image_url ? (
                    <img src={tp.product.image_url} alt={tp.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={18} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-400 font-mono">{tp.product.sku}</div>
                  <div className="text-sm font-semibold text-gray-900 truncate">{tp.product.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <span className="font-semibold text-[#B82020]">{fmtBRL(tp.revenue)}</span>
                    <span className="text-gray-400"> · {tp.units} un.</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* E. Leads por segmento */}
        <SectionCard
          title="Leads por segmento"
          subtitle={`${contacts.length} contatos no total`}
          icon={<PieChart size={16} className="text-[#1A7F5A]" />}
        >
          {metrics.segmentos.length === 0 ? (
            <EmptyState icon={<PieChart size={28} className="text-gray-200" />} text="Sem segmentos" />
          ) : (
            <DonutChart slices={metrics.segmentos} total={contacts.length} />
          )}
        </SectionCard>

        {/* F. Leads por fonte */}
        <SectionCard
          title="Leads por fonte"
          subtitle="Origem dos contatos"
          icon={<Users size={16} className="text-[#4F46E5]" />}
        >
          {metrics.fontes.length === 0 ? (
            <EmptyState icon={<Users size={28} className="text-gray-200" />} text="Sem fontes registradas" />
          ) : (
            <SourceBarList data={metrics.fontes} />
          )}
        </SectionCard>
      </div>

      {/* G. Tempo médio para fechar */}
      <SectionCard
        title="Tempo médio para fechar"
        subtitle="Da entrada do contato até o primeiro pedido pago"
        icon={<Clock size={16} className="text-[#C9A84C]" />}
      >
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-bold text-gray-900">
            {metrics.tempoMedioDias !== null ? metrics.tempoMedioDias.toFixed(1) : '—'}
          </div>
          <div className="text-sm text-gray-500">
            {metrics.tempoMedioDias !== null ? 'dias em média' : 'sem dados suficientes'}
          </div>
        </div>
        {metrics.tempoMedioDias !== null && (
          <p className="text-xs text-gray-400 mt-2">
            Baseado em {metrics.tempoMedioAmostra} contato{metrics.tempoMedioAmostra !== 1 ? 's' : ''} convertido{metrics.tempoMedioAmostra !== 1 ? 's' : ''}.
          </p>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Section card ────────────────────────────────────────────
function SectionCard({ title, subtitle, icon, children }: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start gap-2 mb-4">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-xs text-gray-400">{text}</p>
    </div>
  )
}

// ─── KPI card ────────────────────────────────────────────────
function KpiCard({ label, value, deltaPct, trend }: {
  label: string
  value: string
  deltaPct: number
  trend: number[]
}) {
  const positive = deltaPct >= 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1 truncate">{value}</div>
      <div className="flex items-center justify-between mt-2">
        <div className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(deltaPct).toFixed(0)}%
        </div>
        <Sparkline values={trend} positive={positive} />
      </div>
    </div>
  )
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) {
    return <svg width="40" height="20" />
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 40
  const h = 20
  const step = w / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const stroke = positive ? '#16A34A' : '#DC2626'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Horizontal bar chart (receita mensal) ───────────────────
function HorizontalBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2.5">
      {data.map(d => {
        const pct = (d.value / max) * 100
        return (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <div className="w-10 text-gray-500 capitalize">{d.label}</div>
            <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
              <div
                className="h-full bg-[#B82020] rounded-md transition-all"
                style={{ width: `${pct}%` }}
                title={fmtBRL(d.value)}
              />
            </div>
            <div className="w-20 text-right font-semibold text-gray-700 tabular-nums">{fmtBRL(d.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Funnel chart ────────────────────────────────────────────
function FunnelChart({ steps }: { steps: { key: string; count: number }[] }) {
  const total = steps.reduce((s, x) => s + x.count, 0)
  const max = Math.max(...steps.map(s => s.count), 1)
  return (
    <div className="space-y-1.5">
      {steps.map(step => {
        const pct = (step.count / max) * 100
        const sharePct = total > 0 ? (step.count / total) * 100 : 0
        const color = STATUS_COLORS[step.key] ?? '#9CA3AF'
        return (
          <div key={step.key} className="flex items-center gap-3">
            <div className="w-32 text-xs text-gray-600 truncate">{STATUS_LABELS[step.key]}</div>
            <div className="flex-1 h-7 flex items-center">
              <div
                className="h-full rounded-md flex items-center justify-end px-2 transition-all"
                style={{ width: `${Math.max(pct, 6)}%`, backgroundColor: color, minWidth: '36px' }}
              >
                <span className="text-xs font-semibold text-white">{step.count}</span>
              </div>
            </div>
            <div className="w-12 text-right text-xs text-gray-500 tabular-nums">{sharePct.toFixed(0)}%</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Donut chart (segmentos) ─────────────────────────────────
function DonutChart({ slices, total }: { slices: { key: string; count: number }[]; total: number }) {
  const size = 140
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const cx = size / 2
  const cy = size / 2

  let offset = 0
  const segments = slices.map(s => {
    const len = total > 0 ? (s.count / total) * circumference : 0
    const seg = {
      key: s.key,
      color: SEGMENT_COLORS[s.key] ?? '#9CA3AF',
      length: len,
      dashOffset: offset,
      count: s.count,
    }
    offset += len
    return seg
  })

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        {segments.map(seg => (
          <circle
            key={seg.key}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={-seg.dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900" style={{ fontSize: 22, fontWeight: 700 }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 10 }}>
          leads
        </text>
      </svg>
      <div className="flex-1 min-w-0 space-y-1">
        {slices.map(s => {
          const pct = total > 0 ? (s.count / total) * 100 : 0
          return (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: SEGMENT_COLORS[s.key] ?? '#9CA3AF' }} />
              <span className="text-gray-700 capitalize flex-1 truncate">{s.key}</span>
              <span className="text-gray-500 tabular-nums">{s.count}</span>
              <span className="text-gray-400 w-9 text-right tabular-nums">{pct.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Source bar list ─────────────────────────────────────────
function SourceBarList({ data }: { data: { key: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-2">
      {data.map(d => {
        const pct = (d.count / max) * 100
        return (
          <div key={d.key} className="flex items-center gap-2 text-xs">
            <div className="w-24 text-gray-600 capitalize truncate">{d.key}</div>
            <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
              <div className="h-full bg-[#4F46E5]/80 rounded-md" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-8 text-right font-semibold text-gray-700 tabular-nums">{d.count}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Metrics computation ─────────────────────────────────────
function computeMetrics(orders: Order[], contacts: Contact[]) {
  const now = new Date()
  const mesAtualStart = startOfMonth(now)
  const mesAtualEnd = endOfMonth(now)
  const mesAntStart = startOfMonth(subMonths(now, 1))
  const mesAntEnd = endOfMonth(subMonths(now, 1))

  const inRange = (iso: string, a: Date, b: Date) => {
    const d = parseISO(iso)
    return d >= a && d <= b
  }

  const pagosMes = orders.filter(o => o.status === 'pago' && inRange(o.created_at, mesAtualStart, mesAtualEnd))
  const pagosMesAnt = orders.filter(o => o.status === 'pago' && inRange(o.created_at, mesAntStart, mesAntEnd))

  const ordersMes = orders.filter(o => inRange(o.created_at, mesAtualStart, mesAtualEnd))
  const ordersMesAnt = orders.filter(o => inRange(o.created_at, mesAntStart, mesAntEnd))

  const receitaMes = pagosMes.reduce((s, o) => s + (o.total ?? 0), 0)
  const receitaMesAnt = pagosMesAnt.reduce((s, o) => s + (o.total ?? 0), 0)
  const receitaDelta = pctDelta(receitaMes, receitaMesAnt)

  const pedidosMes = ordersMes.length
  const pedidosMesAnt = ordersMesAnt.length
  const pedidosDelta = pctDelta(pedidosMes, pedidosMesAnt)

  const conversao = orders.length > 0
    ? (orders.filter(o => o.status === 'pago').length / orders.length) * 100
    : 0
  const conversaoAnt = ordersMesAnt.length > 0
    ? (pagosMesAnt.length / ordersMesAnt.length) * 100
    : 0
  const conversaoDelta = pctDelta(conversao, conversaoAnt)

  const ticketMedio = pagosMes.length > 0 ? receitaMes / pagosMes.length : 0
  const ticketMedioAnt = pagosMesAnt.length > 0 ? receitaMesAnt / pagosMesAnt.length : 0
  const ticketDelta = pctDelta(ticketMedio, ticketMedioAnt)

  // Sparkline trends — last 30 days, bucket per day for revenue/count
  const receitaTrend = sparklineRevenue30d(orders)
  const pedidosTrend = sparklineCount30d(orders)
  const conversaoTrend = sparklineConversion30d(orders)
  const ticketTrend = sparklineTicket30d(orders)

  // Receita mensal últimos 6 meses
  const receitaMensal: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const m = subMonths(now, i)
    const s = startOfMonth(m)
    const e = endOfMonth(m)
    const valor = orders
      .filter(o => o.status === 'pago' && inRange(o.created_at, s, e))
      .reduce((sum, o) => sum + (o.total ?? 0), 0)
    receitaMensal.push({
      label: format(m, 'MMM', { locale: ptBR }).replace('.', ''),
      value: valor,
    })
  }

  // Funnel
  const funnelKeys = ['proposta', 'aguardando-pagamento', 'pago', 'entregue']
  const funnel = funnelKeys.map(k => ({ key: k, count: orders.filter(o => o.status === k).length }))

  // Segmentos
  const segMap = new Map<string, number>()
  contacts.forEach(c => {
    const seg = c.segment || 'outro'
    segMap.set(seg, (segMap.get(seg) ?? 0) + 1)
  })
  const segmentos = Array.from(segMap.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)

  // Fontes
  const fontMap = new Map<string, number>()
  contacts.forEach(c => {
    const f = c.source || 'desconhecida'
    fontMap.set(f, (fontMap.get(f) ?? 0) + 1)
  })
  const fontes = Array.from(fontMap.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)

  // Tempo médio para fechar
  const paidByContact = new Map<string, Order[]>()
  orders.filter(o => o.status === 'pago' && o.contact_id).forEach(o => {
    const arr = paidByContact.get(o.contact_id!) ?? []
    arr.push(o)
    paidByContact.set(o.contact_id!, arr)
  })
  const tempos: number[] = []
  paidByContact.forEach((ords, contactId) => {
    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return
    const firstPaid = ords
      .map(o => parseISO(o.created_at))
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const created = parseISO(contact.created_at)
    const diff = differenceInDays(firstPaid, created)
    if (diff >= 0) tempos.push(diff)
  })
  const tempoMedioDias = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null
  const tempoMedioAmostra = tempos.length

  // Top produtos — sem order_items reais, distribui receita total proporcionalmente ao unit_price
  const topProducts = computeTopProducts(orders)

  return {
    receitaMes, receitaDelta, receitaTrend,
    pedidosMes, pedidosDelta, pedidosTrend,
    conversao, conversaoDelta, conversaoTrend,
    ticketMedio, ticketDelta, ticketTrend,
    receitaMensal, funnel,
    segmentos, fontes,
    tempoMedioDias, tempoMedioAmostra,
    topProducts,
  }
}

function computeTopProducts(orders: Order[]): { product: Product; revenue: number; units: number }[] {
  // We don't have order_items joined in mock data; produce a demo ranking
  // based on mockProducts distributing total paid revenue proportionally.
  const totalPaid = orders.filter(o => o.status === 'pago').reduce((s, o) => s + (o.total ?? 0), 0)
  const sumPrices = mockProducts.reduce((s, p) => s + p.unit_price, 0) || 1
  const ranked = mockProducts.map(p => {
    const share = p.unit_price / sumPrices
    const revenue = totalPaid * share
    const units = Math.round(revenue / (p.unit_price || 1))
    return { product: p, revenue, units }
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 3)
  return ranked
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function sparklineRevenue30d(orders: Order[]): number[] {
  const buckets = new Array(30).fill(0)
  const now = new Date()
  orders.forEach(o => {
    if (o.status !== 'pago') return
    const d = parseISO(o.created_at)
    const days = differenceInDays(now, d)
    if (days >= 0 && days < 30) {
      buckets[29 - days] += o.total ?? 0
    }
  })
  return buckets
}

function sparklineCount30d(orders: Order[]): number[] {
  const buckets = new Array(30).fill(0)
  const now = new Date()
  orders.forEach(o => {
    const d = parseISO(o.created_at)
    const days = differenceInDays(now, d)
    if (days >= 0 && days < 30) {
      buckets[29 - days] += 1
    }
  })
  return buckets
}

function sparklineConversion30d(orders: Order[]): number[] {
  const total = new Array(30).fill(0)
  const pagos = new Array(30).fill(0)
  const now = new Date()
  orders.forEach(o => {
    const d = parseISO(o.created_at)
    const days = differenceInDays(now, d)
    if (days >= 0 && days < 30) {
      total[29 - days] += 1
      if (o.status === 'pago') pagos[29 - days] += 1
    }
  })
  return total.map((t, i) => t > 0 ? (pagos[i] / t) * 100 : 0)
}

function sparklineTicket30d(orders: Order[]): number[] {
  const sum = new Array(30).fill(0)
  const count = new Array(30).fill(0)
  const now = new Date()
  orders.forEach(o => {
    if (o.status !== 'pago') return
    const d = parseISO(o.created_at)
    const days = differenceInDays(now, d)
    if (days >= 0 && days < 30) {
      sum[29 - days] += o.total ?? 0
      count[29 - days] += 1
    }
  })
  return sum.map((s, i) => count[i] > 0 ? s / count[i] : 0)
}
