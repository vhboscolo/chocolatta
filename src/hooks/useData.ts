import { useState, useEffect, useCallback } from 'react'
import type {
  Contact, Product, Order, Campaign, Template, Interaction,
  FollowUpSequence, FollowUpTask, TrackedLink,
  ProspectingRun, WhatsAppTemplate, AiBriefing,
} from '../lib/supabase'
import * as db from '../lib/db'
import {
  mockContacts, mockProducts, mockOrders, mockCampaigns,
  mockTemplates, mockInteractions, mockSequences, mockFollowUpTasks, mockTrackedLinks,
} from '../lib/mockData'

const IS_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_url_here'
)

function useResource<T>(fetcher: () => Promise<T[]>, fallback: T[]) {
  const [data, setData] = useState<T[]>(fallback)
  const [loading, setLoading] = useState(IS_CONFIGURED)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!IS_CONFIGURED) return
    try {
      setLoading(true)
      const result = await fetcher()
      setData(result)
    } catch (e) {
      setError((e as Error).message)
      setData(fallback)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { data, setData, loading, error, reload: load }
}

export function useContacts()   { return useResource<Contact>(db.fetchContacts, mockContacts) }
export function useProducts()   { return useResource<Product>(db.fetchProducts, mockProducts) }
export function useOrders()     { return useResource<Order>(db.fetchOrders, mockOrders) }
export function useCampaigns()  { return useResource<Campaign>(db.fetchCampaigns, mockCampaigns) }
export function useTemplates()  { return useResource<Template>(db.fetchTemplates, mockTemplates) }
export function useSequences()  { return useResource<FollowUpSequence>(db.fetchSequences, mockSequences) }
export function useFollowUpTasks() { return useResource<FollowUpTask>(db.fetchFollowUpTasks, mockFollowUpTasks) }

export function useInteractions(contactId: string | null) {
  const [data, setData] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!contactId) return
    if (!IS_CONFIGURED) {
      setData(mockInteractions.filter(i => i.contact_id === contactId))
      return
    }
    setLoading(true)
    db.fetchInteractions(contactId)
      .then(setData)
      .catch(() => setData(mockInteractions.filter(i => i.contact_id === contactId)))
      .finally(() => setLoading(false))
  }, [contactId])

  return { data, setData, loading }
}

export function useAllTrackedLinks() {
  const [data, setData] = useState<TrackedLink[]>(mockTrackedLinks)
  const [loading, setLoading] = useState(IS_CONFIGURED)
  useEffect(() => {
    if (!IS_CONFIGURED) return
    setLoading(true)
    db.fetchAllTrackedLinks()
      .then(setData)
      .catch(() => setData(mockTrackedLinks))
      .finally(() => setLoading(false))
  }, [])
  return { data, setData, loading }
}

export function useTrackedLinks(contactId: string | null) {
  const [data, setData] = useState<TrackedLink[]>([])
  useEffect(() => {
    if (!contactId) return
    if (!IS_CONFIGURED) {
      setData(mockTrackedLinks.filter(l => l.contact_id === contactId))
      return
    }
    db.fetchTrackedLinksByContact(contactId).then(setData).catch(() => setData([]))
  }, [contactId])
  return { data, setData }
}

/** Contacts with lat/lng — for route planning */
export function useContactsWithCoords() {
  const [data, setData] = useState<Contact[]>([])
  const [loading, setLoading] = useState(IS_CONFIGURED)
  const reload = useCallback(async () => {
    if (!IS_CONFIGURED) {
      // In mock mode return contacts that happen to have coords in mock data
      setData(mockContacts.filter(c => c.lat != null && c.lng != null))
      return
    }
    try {
      setLoading(true)
      const result = await db.fetchContactsWithCoords()
      setData(result)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, setData, loading, reload }
}

/** AI-qualified leads (lead_score not null) */
export function useAiQualifiedLeads() {
  const [data, setData] = useState<Contact[]>([])
  const [loading, setLoading] = useState(IS_CONFIGURED)
  const reload = useCallback(async () => {
    if (!IS_CONFIGURED) {
      setData(mockContacts.filter(c => c.lead_score != null))
      return
    }
    try {
      setLoading(true)
      const result = await db.fetchAiQualifiedLeads()
      setData(result)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, setData, loading, reload }
}

/** Prospecting run history */
export function useProspectingRuns() {
  const [data, setData] = useState<ProspectingRun[]>([])
  const [loading, setLoading] = useState(IS_CONFIGURED)
  const reload = useCallback(async () => {
    if (!IS_CONFIGURED) { setData([]); return }
    try {
      setLoading(true)
      const result = await db.fetchProspectingRuns()
      setData(result)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, setData, loading, reload }
}

/** WhatsApp templates */
export function useWhatsAppTemplates() {
  const [data, setData] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(IS_CONFIGURED)
  const reload = useCallback(async () => {
    if (!IS_CONFIGURED) { setData([]); return }
    try {
      setLoading(true)
      const result = await db.fetchWhatsAppTemplates()
      setData(result)
    } catch { setData([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, setData, loading, reload }
}

/**
 * Today's AI briefing — checks cache first, generates if missing.
 * Caller must pass orders, products, tasks, links since these aren't
 * always loaded by the consumer.
 */
export function useDailyBriefing(opts: {
  contacts: Contact[]
  orders: Order[]
  products: Product[]
  tasks: FollowUpTask[]
  links: TrackedLink[]
  autoGenerate?: boolean        // if true, generates on mount when cache miss
}) {
  const [briefing, setBriefing] = useState<AiBriefing | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    if (!IS_CONFIGURED) {
      setError('Supabase não configurado — briefing requer banco')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      // Lazy-import heavy LLM module
      const [{ buildCrmSnapshot, generateDailyBriefing }] = await Promise.all([
        import('../lib/aiAnalyst'),
      ])
      const snapshot = buildCrmSnapshot({
        contacts: opts.contacts,
        orders: opts.orders,
        products: opts.products,
        tasks: opts.tasks,
        links: opts.links,
      })
      const result = await generateDailyBriefing(snapshot)
      const saved = await db.saveBriefing({
        briefing_date: new Date().toISOString().split('T')[0],
        llm_model: result.model,
        tokens_used: result.tokensUsed,
        foco_do_dia: result.foco_do_dia,
        leads_quentes: result.leads_quentes,
        leads_esfriando: result.leads_esfriando,
        riscos: result.riscos,
        insights: result.insights,
        oportunidades: result.oportunidades,
        prospecting_suggestions: result.prospecting_suggestions,
        summary: result.summary,
      })
      setBriefing(saved)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [opts.contacts, opts.orders, opts.products, opts.tasks, opts.links])

  // Load cached briefing on mount
  useEffect(() => {
    if (!IS_CONFIGURED) return
    setLoading(true)
    db.fetchTodaysBriefing()
      .then(b => {
        setBriefing(b)
        // Auto-generate if missing and we have data loaded
        if (!b && opts.autoGenerate && opts.contacts.length > 0) {
          generate()
        }
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.autoGenerate, opts.contacts.length > 0])

  return { briefing, loading, generating, error, generate, setBriefing }
}

export { IS_CONFIGURED }
