import { useEffect } from 'react'
import { differenceInDays, differenceInMinutes, parseISO } from 'date-fns'
import type { Contact, Product, Order, FollowUpTask } from '../lib/supabase'
import { getPermission, getPreferences, notify } from '../lib/notifications'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

interface Args {
  products: Product[]
  orders: Order[]
  contacts: Contact[]
  tasks: FollowUpTask[]
}

export function useNotificationDispatcher({ products, orders, contacts, tasks }: Args) {
  useEffect(() => {
    function check() {
      if (getPermission() !== 'granted') return
      const prefs = getPreferences()
      if (!prefs.enabled) return

      const now = new Date()
      const today = now.toISOString().split('T')[0]

      // 1) Expiring products
      if (prefs.expiringProducts) {
        products.forEach(p => {
          if (!p.expiry_date) return
          const days = differenceInDays(parseISO(p.expiry_date), now)
          if (days >= 0 && days <= 15) {
            notify('🟡 Produto vence em breve', {
              body: `${p.name} vence em ${days} dia${days === 1 ? '' : 's'}`,
              dedupeKey: `expiry-${p.id}`,
            })
          }
        })
      }

      // 2) Proposal viewed (recent)
      if (prefs.proposalViewed) {
        orders.forEach(o => {
          if (o.status !== 'proposta') return
          if (!o.view_count || o.view_count <= 0) return
          if (!o.last_viewed_at) return
          const mins = differenceInMinutes(now, parseISO(o.last_viewed_at))
          if (mins >= 0 && mins <= 60) {
            const contact = o.contact ?? contacts.find(c => c.id === o.contact_id)
            const name = contact?.name ?? 'Cliente'
            notify('👁 Proposta visualizada!', {
              body: `${name} viu sua proposta há ${mins}min`,
              dedupeKey: `viewed-${o.id}`,
            })
          }
        })
      }

      // 3) Follow-up tasks today
      if (prefs.overdueFollowUps) {
        tasks.forEach(t => {
          if (t.status !== 'pendente') return
          if (t.scheduled_for !== today) return
          const contact = t.contact ?? contacts.find(c => c.id === t.contact_id)
          const name = contact?.name ?? 'Contato'
          notify('📅 Follow-up hoje', {
            body: `${name}: ${t.label ?? 'Tarefa pendente'}`,
            dedupeKey: `task-${t.id}`,
          })
        })
      }

      // 4) Overdue payments
      if (prefs.paymentPending) {
        orders.forEach(o => {
          if (o.status !== 'aguardando-pagamento') return
          const days = differenceInDays(now, parseISO(o.created_at))
          if (days > 5) {
            const contact = o.contact ?? contacts.find(c => c.id === o.contact_id)
            const name = contact?.name ?? 'Cliente'
            const total = (o.total ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
            notify('💰 Pagamento atrasado', {
              body: `${name}: R$ ${total}`,
              dedupeKey: `payment-${o.id}`,
            })
          }
        })
      }
    }

    check()
    const id = window.setInterval(check, CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [products, orders, contacts, tasks])
}
