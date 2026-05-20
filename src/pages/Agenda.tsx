import { useMemo } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageCircle, Package, ShoppingCart,
  CheckCircle2, ChevronRight
} from 'lucide-react'
import { useContacts, useProducts, useOrders } from '../hooks/useData'
import { Link } from 'react-router-dom'

function buildWhatsApp(phone: string, name: string) {
  const clean = phone.replace(/\D/g, '')
  const msg = encodeURIComponent(
    `Olá ${name}, tudo bem? Sou Victor da Aris Importação — passando para retomar nosso contato sobre os chocolates Sölen. Como posso ajudar?`
  )
  return `https://wa.me/55${clean}?text=${msg}`
}

type Priority = 'urgente' | 'atencao' | 'andamento' | 'ganho'
type AgendaItem = {
  id: string
  priority: Priority
  type: 'lead' | 'produto' | 'pedido'
  title: string
  subtitle: string
  badge: string
  badgeColor: string
  action?: { label: string; href: string; external?: boolean }
  link: string
}

export default function Agenda() {
  const { data: contacts } = useContacts()
  const { data: products } = useProducts()
  const { data: orders } = useOrders()

  const items = useMemo<AgendaItem[]>(() => {
    const result: AgendaItem[] = []
    const hoje = new Date()

    // === LEADS ===
    contacts.forEach(c => {
      if (c.status === 'fechado' || c.status === 'perdido') return
      const daysSince = differenceInDays(hoje, parseISO(c.updated_at))

      if (daysSince >= 7) {
        result.push({
          id: `lead-urgente-${c.id}`,
          priority: 'urgente',
          type: 'lead',
          title: c.name,
          subtitle: c.company ? `${c.company} · ${daysSince}d sem contato` : `${daysSince}d sem contato`,
          badge: `${daysSince}d`,
          badgeColor: 'bg-red-100 text-red-700',
          action: c.phone ? { label: 'WhatsApp', href: buildWhatsApp(c.phone, c.name), external: true } : undefined,
          link: '/leads',
        })
      } else if (daysSince >= 3) {
        result.push({
          id: `lead-atencao-${c.id}`,
          priority: 'atencao',
          type: 'lead',
          title: c.name,
          subtitle: c.company ? `${c.company} · ${daysSince}d sem contato` : `${daysSince}d sem contato`,
          badge: `${daysSince}d`,
          badgeColor: 'bg-amber-100 text-amber-700',
          action: c.phone ? { label: 'WhatsApp', href: buildWhatsApp(c.phone, c.name), external: true } : undefined,
          link: '/leads',
        })
      } else if (['negociando', 'proposta-enviada'].includes(c.status)) {
        result.push({
          id: `lead-ativo-${c.id}`,
          priority: 'andamento',
          type: 'lead',
          title: c.name,
          subtitle: c.company
            ? `${c.company} · ${c.status === 'negociando' ? 'Negociando' : 'Proposta enviada'}`
            : c.status === 'negociando' ? 'Negociando' : 'Proposta enviada',
          badge: c.status === 'negociando' ? '🤝 Negociando' : '📄 Proposta',
          badgeColor: 'bg-blue-50 text-blue-700',
          action: c.phone ? { label: 'WhatsApp', href: buildWhatsApp(c.phone, c.name), external: true } : undefined,
          link: '/leads',
        })
      }
    })

    // === PRODUTOS ===
    products.forEach(p => {
      if (!p.expiry_date) return
      const daysUntil = differenceInDays(parseISO(p.expiry_date), hoje)

      if (daysUntil <= 15) {
        result.push({
          id: `prod-urgente-${p.id}`,
          priority: 'urgente',
          type: 'produto',
          title: p.name,
          subtitle: `${p.quantity.toLocaleString('pt-BR')} un. em estoque · vence em ${daysUntil}d`,
          badge: `${daysUntil}d`,
          badgeColor: 'bg-red-100 text-red-700',
          link: '/estoque',
        })
      } else if (daysUntil <= 30) {
        result.push({
          id: `prod-atencao-${p.id}`,
          priority: 'atencao',
          type: 'produto',
          title: p.name,
          subtitle: `${p.quantity.toLocaleString('pt-BR')} un. em estoque · vence em ${daysUntil}d`,
          badge: `${daysUntil}d`,
          badgeColor: 'bg-amber-100 text-amber-700',
          link: '/estoque',
        })
      }
    })

    // === PEDIDOS ===
    orders.forEach(o => {
      const daysSince = differenceInDays(hoje, parseISO(o.created_at))
      const valorFmt = `R$ ${(o.total ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

      if (o.status === 'aguardando-pagamento') {
        result.push({
          id: `order-pag-${o.id}`,
          priority: daysSince >= 3 ? 'urgente' : 'atencao',
          type: 'pedido',
          title: 'Aguardando pagamento',
          subtitle: `${valorFmt} · ${daysSince}d em aberto`,
          badge: 'Pag. pendente',
          badgeColor: 'bg-amber-100 text-amber-700',
          link: '/pedidos',
        })
      } else if (o.status === 'proposta' && daysSince >= 5) {
        result.push({
          id: `order-prop-${o.id}`,
          priority: 'atencao',
          type: 'pedido',
          title: 'Proposta sem retorno',
          subtitle: `${valorFmt} · ${daysSince}d sem resposta`,
          badge: 'Follow-up',
          badgeColor: 'bg-purple-100 text-purple-700',
          link: '/pedidos',
        })
      } else if (o.status === 'pago') {
        result.push({
          id: `order-ganho-${o.id}`,
          priority: 'ganho',
          type: 'pedido',
          title: 'Pedido confirmado',
          subtitle: `${valorFmt} recebido`,
          badge: '✓ Pago',
          badgeColor: 'bg-green-100 text-green-700',
          link: '/pedidos',
        })
      }
    })

    return result
  }, [contacts, products, orders])

  const urgentes = items.filter(i => i.priority === 'urgente')
  const atencao = items.filter(i => i.priority === 'atencao')
  const andamento = items.filter(i => i.priority === 'andamento')
  const ganhos = items.filter(i => i.priority === 'ganho')

  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Agenda do Dia</h1>
        <p className="text-xs text-gray-500 mt-0.5 capitalize">{hoje}</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{urgentes.length}</div>
          <div className="text-xs text-red-500 mt-0.5">Urgente</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{atencao.length}</div>
          <div className="text-xs text-amber-500 mt-0.5">Atenção</div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{ganhos.length}</div>
          <div className="text-xs text-green-600 mt-0.5">Fechados</div>
        </div>
      </div>

      {/* Urgente */}
      {urgentes.length > 0 && (
        <AgendaSection
          title="🔴 Urgente"
          subtitle="Ação imediata necessária"
          items={urgentes}
        />
      )}

      {/* Atenção */}
      {atencao.length > 0 && (
        <AgendaSection
          title="🟡 Atenção"
          subtitle="Prioridade para hoje"
          items={atencao}
        />
      )}

      {/* Em andamento */}
      {andamento.length > 0 && (
        <AgendaSection
          title="🔵 Em Andamento"
          subtitle="Leads ativos no momento"
          items={andamento}
        />
      )}

      {/* Ganhos */}
      {ganhos.length > 0 && (
        <AgendaSection
          title="✅ Fechados"
          subtitle="Pedidos confirmados"
          items={ganhos}
        />
      )}

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
          <CheckCircle2 size={36} className="text-green-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">Tudo em dia!</h3>
          <p className="text-sm text-gray-400">Nenhuma ação pendente no momento.</p>
        </div>
      )}
    </div>
  )
}

function ItemIcon({ type }: { type: 'lead' | 'produto' | 'pedido' }) {
  if (type === 'lead') {
    return (
      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        <MessageCircle size={16} className="text-blue-500" />
      </div>
    )
  }
  if (type === 'produto') {
    return (
      <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
        <Package size={16} className="text-amber-500" />
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
      <ShoppingCart size={16} className="text-green-500" />
    </div>
  )
}

function AgendaSection({ title, subtitle, items }: {
  title: string
  subtitle: string
  items: AgendaItem[]
}) {
  return (
    <div>
      <div className="mb-2.5">
        <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3">
            <ItemIcon type={item.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 text-sm">{item.title}</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{item.subtitle}</p>
            </div>
            {item.action ? (
              <a
                href={item.action.href}
                target={item.action.external ? '_blank' : undefined}
                rel={item.action.external ? 'noreferrer' : undefined}
                className="flex items-center gap-1 text-xs font-medium text-white bg-[#25D366] px-2.5 py-1.5 rounded-lg flex-shrink-0 active:bg-[#1da851] transition-colors"
              >
                <MessageCircle size={11} />
                {item.action.label}
              </a>
            ) : (
              <Link to={item.link} className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors">
                <ChevronRight size={16} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
