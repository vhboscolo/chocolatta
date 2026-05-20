import { useState, useEffect, useCallback } from 'react'
import type {
  Contact, Product, Order, Campaign, Template, Interaction,
  FollowUpSequence, FollowUpTask, TrackedLink,
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

export { IS_CONFIGURED }
