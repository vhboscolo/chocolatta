import { useState, useMemo } from 'react'
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageCircle, Mail, Phone, Calendar, Check, X,
  ChevronDown, ChevronUp, Zap, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type {
  FollowUpSequence, FollowUpTask, SequenceAction, Contact,
} from '../lib/supabase'
import { useSequences, useFollowUpTasks, useContacts, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'

function actionIcon(action: SequenceAction, size = 14) {
  const cls = 'flex-shrink-0'
  switch (action) {
    case 'whatsapp': return <MessageCircle size={size} className={`${cls} text-[#25D366]`} />
    case 'email': return <Mail size={size} className={`${cls} text-blue-500`} />
    case 'ligacao': return <Phone size={size} className={`${cls} text-gray-600`} />
    case 'visita': return <Calendar size={size} className={`${cls} text-purple-500`} />
  }
}

function actionLabel(action: SequenceAction) {
  switch (action) {
    case 'whatsapp': return 'WhatsApp'
    case 'email': return 'E-mail'
    case 'ligacao': return 'Ligação'
    case 'visita': return 'Visita'
  }
}

function buildActionHref(action: SequenceAction, contact: Contact | undefined, label: string): string | null {
  if (!contact) return null
  const phone = (contact.phone ?? '').replace(/\D/g, '')
  const msg = encodeURIComponent(label)
  switch (action) {
    case 'whatsapp':
      if (!phone) return null
      return `https://wa.me/55${phone}?text=${msg}`
    case 'email':
      if (!contact.email) return null
      return `mailto:${contact.email}?subject=${encodeURIComponent(label)}&body=${msg}`
    case 'ligacao':
      if (!phone) return null
      return `tel:+55${phone}`
    case 'visita':
      return '/leads'
  }
}

function relativeDateLabel(scheduledFor: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = parseISO(scheduledFor)
  const days = differenceInDays(date, today)
  if (days === 0) return 'Hoje'
  if (days < 0) return `Atrasada ${Math.abs(days)}d`
  if (days === 1) return 'Amanhã'
  return `Em ${days} dias`
}

export default function Sequencias() {
  const { data: sequences } = useSequences()
  const { data: tasks, setData: setTasks, reload: reloadTasks } = useFollowUpTasks()
  const { data: contacts } = useContacts()

  const [applyModal, setApplyModal] = useState<FollowUpSequence | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayStr = today.toISOString().split('T')[0]

  const pendentes = tasks.filter(t => t.status === 'pendente')
  const concluidas = tasks
    .filter(t => t.status === 'concluido')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))

  const atrasadas = pendentes.filter(t => t.scheduled_for < todayStr)
  const hoje = pendentes.filter(t => t.scheduled_for === todayStr)
  const proximas = pendentes
    .filter(t => t.scheduled_for > todayStr)
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))

  // Enrich tasks with contact (in mock mode the contact join is missing)
  function enrichContact(task: FollowUpTask): Contact | undefined {
    return task.contact ?? contacts.find(c => c.id === task.contact_id)
  }

  async function handleComplete(task: FollowUpTask) {
    try {
      if (IS_CONFIGURED) {
        await db.completeFollowUpTask(task.id)
        await reloadTasks()
      } else {
        setTasks(prev => prev.map(t =>
          t.id === task.id
            ? { ...t, status: 'concluido' as const, completed_at: new Date().toISOString() }
            : t
        ))
      }
      toast.success('Tarefa concluída')
    } catch {
      toast.error('Erro ao concluir tarefa')
    }
  }

  async function handleCancel(task: FollowUpTask) {
    try {
      if (IS_CONFIGURED) {
        await db.cancelFollowUpTask(task.id)
        await reloadTasks()
      } else {
        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, status: 'cancelado' as const } : t
        ))
      }
      toast.success('Tarefa cancelada')
    } catch {
      toast.error('Erro ao cancelar')
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Sequências de Follow-up</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Aplique uma sequência a um lead para programar contatos automaticamente
        </p>
      </div>

      {/* === Sequências disponíveis === */}
      <section>
        <div className="mb-2.5">
          <h2 className="font-semibold text-gray-800 text-sm">Sequências disponíveis</h2>
          <p className="text-xs text-gray-400">Escolha uma sequência e aplique a um lead</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sequences.map(seq => {
            const maxDay = seq.steps.reduce((m, s) => Math.max(m, s.day_offset), 0)
            return (
              <div key={seq.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{seq.name}</h3>
                    {seq.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{seq.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span className="inline-flex items-center gap-1">
                    <Zap size={11} className="text-[#C9A84C]" />
                    {seq.steps.length} {seq.steps.length === 1 ? 'passo' : 'passos'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} />
                    {maxDay} dias de duração
                  </span>
                </div>

                {/* Timeline — vertical no mobile, horizontal no desktop (evita esmagar com >3 passos) */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2 sm:space-y-0">
                  {seq.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 sm:gap-0 sm:items-start sm:flex-col sm:text-center sm:relative">
                      <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 sm:mb-1 sm:mx-auto">
                        {actionIcon(step.action, 12)}
                      </div>
                      <div className="flex-1 min-w-0 sm:flex-none">
                        <div className="text-[10px] font-semibold text-gray-700">Dia {step.day_offset}</div>
                        <div className="text-[10px] text-gray-500 sm:truncate sm:w-full">{step.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setApplyModal(seq)}
                  className="mt-auto text-sm font-medium text-white bg-[#B82020] py-2 rounded-lg hover:bg-[#9E1C1C] transition-colors"
                >
                  Aplicar a um lead
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* === Tarefas pendentes === */}
      <section>
        <div className="mb-2.5">
          <h2 className="font-semibold text-gray-800 text-sm">Tarefas pendentes</h2>
          <p className="text-xs text-gray-400">{pendentes.length} {pendentes.length === 1 ? 'tarefa' : 'tarefas'} em aberto</p>
        </div>

        {pendentes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <Check size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Nenhuma tarefa pendente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {atrasadas.length > 0 && (
              <TaskGroup
                title="Atrasadas"
                color="text-red-600"
                tasks={atrasadas}
                enrich={enrichContact}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            )}
            {hoje.length > 0 && (
              <TaskGroup
                title="Hoje"
                color="text-amber-600"
                tasks={hoje}
                enrich={enrichContact}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            )}
            {proximas.length > 0 && (
              <TaskGroup
                title="Próximos dias"
                color="text-gray-700"
                tasks={proximas}
                enrich={enrichContact}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            )}
          </div>
        )}
      </section>

      {/* === Histórico === */}
      <section>
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="text-left">
            <h2 className="font-semibold text-gray-800 text-sm">Histórico de tarefas concluídas</h2>
            <p className="text-xs text-gray-400">{concluidas.length} concluídas no total</p>
          </div>
          {historyOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {historyOpen && (
          <div className="mt-2 space-y-1.5">
            {concluidas.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
                Nenhuma tarefa concluída ainda
              </div>
            ) : (
              <>
                {concluidas.slice(0, 10).map(task => {
                  const contact = enrichContact(task)
                  return (
                    <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                        {actionIcon(task.action, 12)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {contact?.name ?? 'Contato'} <span className="text-gray-400 font-normal">· {task.label}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {actionLabel(task.action)} · {task.completed_at
                            ? formatDistanceToNow(parseISO(task.completed_at), { addSuffix: true, locale: ptBR })
                            : 'concluída'}
                        </p>
                      </div>
                      <Check size={14} className="text-green-500 flex-shrink-0" />
                    </div>
                  )
                })}
                {concluidas.length > 10 && (
                  <div className="text-center text-xs text-gray-400 py-2">
                    + {concluidas.length - 10} tarefas anteriores
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Custom sequence stub */}
      <button
        disabled
        className="w-full text-sm font-medium text-gray-400 border border-dashed border-gray-300 py-3 rounded-xl cursor-not-allowed"
      >
        + Criar sequência customizada (em breve)
      </button>

      {/* Apply modal */}
      {applyModal && (
        <ApplyModal
          sequence={applyModal}
          contacts={contacts}
          onClose={() => setApplyModal(null)}
          onApplied={async (newTasks) => {
            if (IS_CONFIGURED) {
              await reloadTasks()
            } else {
              setTasks(prev => [...prev, ...newTasks])
            }
            setApplyModal(null)
            toast.success(`Sequência aplicada — ${newTasks.length} tarefas criadas`)
          }}
        />
      )}
    </div>
  )
}

function TaskGroup({
  title, color, tasks, enrich, onComplete, onCancel,
}: {
  title: string
  color: string
  tasks: FollowUpTask[]
  enrich: (t: FollowUpTask) => Contact | undefined
  onComplete: (t: FollowUpTask) => void
  onCancel: (t: FollowUpTask) => void
}) {
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${color}`}>
        {title} <span className="text-gray-400">· {tasks.length}</span>
      </h3>
      <div className="space-y-2">
        {tasks.map(task => {
          const contact = enrich(task)
          const href = buildActionHref(task.action, contact, task.label ?? '')
          const isExternal = href?.startsWith('http')
          const dateLbl = relativeDateLabel(task.scheduled_for)
          const isLate = task.scheduled_for < new Date().toISOString().split('T')[0]

          return (
            <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                {actionIcon(task.action, 16)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">
                    {contact?.name ?? 'Contato'}
                  </span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    isLate ? 'bg-red-100 text-red-700'
                      : dateLbl === 'Hoje' ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {dateLbl}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {task.label} {contact?.company ? `· ${contact.company}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {href ? (
                  <a
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noreferrer' : undefined}
                    onClick={() => onComplete(task)}
                    className="flex items-center gap-1 text-xs font-medium text-white bg-[#25D366] px-2.5 py-1.5 rounded-lg active:bg-[#1da851] transition-colors"
                  >
                    {actionIcon(task.action, 11)}
                    Executar
                  </a>
                ) : (
                  <button
                    onClick={() => onComplete(task)}
                    className="flex items-center gap-1 text-xs font-medium text-white bg-[#25D366] px-2.5 py-1.5 rounded-lg active:bg-[#1da851] transition-colors"
                  >
                    <Check size={11} />
                    Concluir
                  </button>
                )}
                <button
                  onClick={() => onCancel(task)}
                  className="text-gray-300 hover:text-red-500 p-1"
                  aria-label="Cancelar"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ApplyModal({
  sequence, contacts, onClose, onApplied,
}: {
  sequence: FollowUpSequence
  contacts: Contact[]
  onClose: () => void
  onApplied: (tasks: FollowUpTask[]) => void
}) {
  const [contactId, setContactId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const maxDay = sequence.steps.reduce((m, s) => Math.max(m, s.day_offset), 0)
  const start = parseISO(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + maxDay)

  async function handleConfirm() {
    if (!contactId) {
      toast.error('Selecione um lead')
      return
    }
    setLoading(true)
    try {
      if (IS_CONFIGURED) {
        const created = await db.applySequenceToContact(sequence, contactId, start)
        onApplied(created)
      } else {
        const created: FollowUpTask[] = sequence.steps.map((step, idx) => {
          const d = new Date(start)
          d.setDate(d.getDate() + step.day_offset)
          return {
            id: `task-local-${Date.now()}-${idx}`,
            sequence_id: sequence.id,
            contact_id: contactId,
            step_index: idx,
            scheduled_for: d.toISOString().split('T')[0],
            action: step.action,
            template_id: step.template_id,
            label: step.label,
            status: 'pendente',
            created_at: new Date().toISOString(),
            contact: contacts.find(c => c.id === contactId),
          }
        })
        onApplied(created)
      }
    } catch {
      toast.error('Erro ao aplicar sequência')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-bold text-gray-900">Aplicar Sequência</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{sequence.name}</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Lead</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
            >
              <option value="">Selecionar contato...</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Começar em</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 mb-4">
          Esta sequência criará <b>{sequence.steps.length} tarefas</b> começando em{' '}
          <b>{format(start, "d 'de' MMM", { locale: ptBR })}</b> e terminando em{' '}
          <b>{format(end, "d 'de' MMM", { locale: ptBR })}</b>.
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-sm text-gray-600 border border-gray-200 py-2 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !contactId}
            className="flex-1 text-sm font-medium text-white bg-[#B82020] py-2 rounded-lg hover:bg-[#9E1C1C] disabled:opacity-50"
          >
            {loading ? 'Aplicando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
