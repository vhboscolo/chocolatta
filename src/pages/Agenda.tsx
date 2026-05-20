import { useMemo } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageCircle, Package, ShoppingCart, Mail, Phone, Repeat,
  CheckCircle2, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useContacts, useProducts, useOrders, useFollowUpTasks, IS_CONFIGURED,
} from '../hooks/useData'
import * as db from '../lib/db'
import type { FollowUpTask, Contact, SequenceAction } from '../lib/supabase'
import { Link } from 'react-router-dom'
import NotificationBanner from '../components/NotificationBanner'
import { useNotificationDispatcher } from '../hooks/useNotificationDispatcher'

function buildWhatsApp(phone: string, name: string, customMsg?: string) {
  const clean = phone.replace(/\D/g, '')
  const msg = encodeURIComponent(
    customMsg ??
    `Olá ${name}, tudo bem? Sou Victor da Aris Importação — passando para retomar nosso contato sobre os chocolates Sölen. Como posso ajudar?`
  )
  return `https://wa.me/55${clean}?text=${msg}`
}

function buildMailto(email: string, subject: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`
}

function buildTel(phone: string) {
  return `tel:+55${phone.replace(/\D/g, '')}`
}

type Priority = 'urgente' | 'atencao' | 'andamento' | 'ganho'
type ItemType = 'lead' | 'produto' | 'pedido' | 'tarefa'
type AgendaAction = {
  label: string
  href: string
  external?: boolean
  variant?: 'whatsapp' | 'email' | 'phone' | 'neutral'
  onClick?: () => void
}
type AgendaItem = {
  id: string
  priority: Priority
  type: ItemType
  title: string
  subtitle: string
  badge: string
  badgeColor: string
  action?: AgendaAction
  link: string
}

export default function Agenda() {
  const { data: contacts } = useContacts()
  const { data: products } = useProducts()
  const { data: orders } = useOrders()
  const { data: tasks, setData: setTasks, reload: reloadTasks } = useFollowUpTasks()

  // Notification dispatcher — checks every 5 min while app open
  useNotificationDispatcher({ products, orders, contacts, tasks })

  async function completeTask(taskId: string) {
    try {
      if (IS_CONFIGURED) {
        await db.completeFollowUpTask(taskId)
        await reloadTasks()
      } else {
        setTasks(prev => prev.map(t =>
          t.id === taskId
            ? { ...t, status: 'concluido' as const, completed_at: new Date().toISOString() }
            : t
        ))
      }
      toast.success('Tarefa concluída')
    } catch {
      toast.error('Erro ao concluir tarefa')
    }
  }

  function taskAction(task: FollowUpTask, contact: Contact | undefined): AgendaAction | undefined {
    const label = task.label ?? 'Follow-up'
    const onClick = () => completeTask(task.id)
    if (!contact) return undefined
    const phone = (contact.phone ?? '').replace(/\D/g, '')
    switch (task.action as SequenceAction) {
      case 'whatsapp':
        if (!phone) return { label: 'Concluir', href: '#', onClick, variant: 'neutral' }
        return {
          label: 'WhatsApp',
          href: buildWhatsApp(phone, contact.name, label),
          external: true,
          variant: 'whatsapp',
          onClick,
        }
      case 'email':
        if (!contact.email) return { label: 'Concluir', href: '#', onClick, variant: 'neutral' }
        return {
          label: 'E-mail',
          href: buildMailto(contact.email, label),
          variant: 'email',
          onClick,
        }
      case 'ligacao':
        if (!phone) return { label: 'Concluir', href: '#', onClick, variant: 'neutral' }
        return {
          label: 'Ligar',
          href: buildTel(phone),
          variant: 'phone',
          onClick,
        }
      case 'visita':
        return { label: 'Ver lead', href: '/leads', variant: 'neutral', onClick }
    }
  }

  const items = useMemo<AgendaItem[]>(() => {
    const result: AgendaItem[] = []
    const hoje = new Date()
    const todayStr = hoje.toISOString().split('T')[0]

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
          action: c.phone ? { label: 'WhatsApp', href: buildWhatsApp(c.phone, c.name), external: true, variant: 'whatsapp' } : undefined,
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
          action: c.phone ? { label: 'WhatsApp', href: buildWhatsApp(c.phone, c.name), external: true, variant: 'whatsapp' } : undefined,
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
          action: c.phone ? { label: 'WhatsApp', href: buildWhatsApp(c.phone, c.name), external: true, variant: 'whatsapp' } : undefined,
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

    // === FOLLOW-UP TASKS ===
    tasks.forEach(t => {
      if (t.status !== 'pendente') return
      if (t.scheduled_for > todayStr) return // skip future

      const contact = t.contact ?? contacts.find(c => c.id === t.contact_id)
      const name = contact?.name ?? 'Contato'
      const company = contact?.company
      const actionName =
        t.action === 'whatsapp' ? 'WhatsApp'
        : t.action === 'email' ? 'E-mail'
        : t.action === 'ligacao' ? 'Ligação'
        : 'Visita'
      const subtitle = company ? `${name} · ${company} · ${actionName}` : `${name} · ${actionName}`
      const title = t.label ?? 'Follow-up'

      if (t.scheduled_for < todayStr) {
        const lateDays = Math.abs(differenceInDays(parseISO(t.scheduled_for), hoje))
        result.push({
          id: `task-${t.id}`,
          priority: 'urgente',
          type: 'tarefa',
          title,
          subtitle,
          badge: `🔴 Atrasada ${lateDays}d`,
          badgeColor: 'bg-red-100 text-red-700',
          action: taskAction(t, contact),
          link: '/sequencias',
        })
      } else {
        // today
        result.push({
          id: `task-${t.id}`,
          priority: 'atencao',
          type: 'tarefa',
          title,
          subtitle,
          badge: 'Hoje',
          badgeColor: 'bg-amber-100 text-amber-700',
          action: taskAction(t, contact),
          link: '/sequencias',
        })
      }
    })

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, products, orders, tasks])

  const urgentes = items.filter(i => i.priority === 'urgente')
  const atencao = items.filter(i => i.priority === 'atencao')
  const andamento = items.filter(i => i.priority === 'andamento')
  const ganhos = items.filter(i => i.priority === 'ganho')

  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Notification banner */}
      <NotificationBanner />

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

function ItemIcon({ type }: { type: ItemType }) {
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
  if (type === 'tarefa') {
    return (
      <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
        <Repeat size={16} className="text-purple-500" />
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
      <ShoppingCart size={16} className="text-green-500" />
    </div>
  )
}

function ActionButton({ action }: { action: AgendaAction }) {
  const variant = action.variant ?? 'whatsapp'
  const classes =
    variant === 'whatsapp' ? 'text-white bg-[#25D366] active:bg-[#1da851]'
    : variant === 'email' ? 'text-white bg-blue-500 active:bg-blue-600'
    : variant === 'phone' ? 'text-white bg-gray-700 active:bg-gray-800'
    : 'text-gray-700 bg-gray-100 active:bg-gray-200'

  const Icon =
    variant === 'whatsapp' ? MessageCircle
    : variant === 'email' ? Mail
    : variant === 'phone' ? Phone
    : Repeat

  const isHash = action.href === '#'

  if (isHash) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); action.onClick?.() }}
        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-colors ${classes}`}
      >
        <Icon size={11} />
        {action.label}
      </button>
    )
  }

  return (
    <a
      href={action.href}
      target={action.external ? '_blank' : undefined}
      rel={action.external ? 'noreferrer' : undefined}
      onClick={() => action.onClick?.()}
      className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-colors ${classes}`}
    >
      <Icon size={11} />
      {action.label}
    </a>
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
              <ActionButton action={item.action} />
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
