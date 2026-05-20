import { supabase } from './supabase'
import type {
  Contact, Product, Order, OrderItem, Campaign, Template, Interaction,
  TrackedLink, FollowUpSequence, FollowUpTask, SequenceStep,
  ProspectingRun, WhatsAppTemplate, WhatsAppMessage, AiBriefing,
} from './supabase'

// ── Contacts ──────────────────────────────────────────────
export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact> {
  const { data, error } = await supabase.from('contacts').insert(contact).select().single()
  if (error) throw error
  return data
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<void> {
  const { error } = await supabase.from('contacts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// ── Products ──────────────────────────────────────────────
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const { error } = await supabase.from('products').update(updates).eq('id', id)
  if (error) throw error
}

// ── Orders ──────────────────────────────────────────────
export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, contact:contacts(name, company, email, phone)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchOrderByToken(token: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, contact:contacts(name, company, email, phone)')
    .eq('public_token', token)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createOrder(order: Omit<Order, 'id' | 'created_at'>): Promise<Order> {
  // Auto-generate public_token + valid_until (7 days)
  const enriched = {
    ...order,
    public_token: order.public_token ?? crypto.randomUUID(),
    valid_until: order.valid_until ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  }
  const { data, error } = await supabase.from('orders').insert(enriched).select().single()
  if (error) throw error
  return data
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) throw error
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<void> {
  const { error } = await supabase.from('orders').update(updates).eq('id', id)
  if (error) throw error
}

export async function incrementOrderView(token: string): Promise<Order | null> {
  const { data, error } = await supabase.rpc('increment_order_view', { p_token: token })
  if (error) throw error
  return data as Order | null
}

export async function acceptOrder(token: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ accepted_at: new Date().toISOString(), status: 'aguardando-pagamento' })
    .eq('public_token', token)
  if (error) throw error
}

export async function rejectOrder(token: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ rejected_at: new Date().toISOString(), status: 'cancelado' })
    .eq('public_token', token)
  if (error) throw error
}

// ── Order items ──────────────────────────────────────────
export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items').select('*, product:products(*)').eq('order_id', orderId)
  if (error) throw error
  return data ?? []
}

export async function createOrderItems(items: Omit<OrderItem, 'id'>[]): Promise<void> {
  if (!items.length) return
  const { error } = await supabase.from('order_items').insert(items)
  if (error) throw error
}

// ── Campaigns ──────────────────────────────────────────────
export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createCampaign(campaign: Omit<Campaign, 'id' | 'created_at'>): Promise<Campaign> {
  const { data, error } = await supabase.from('campaigns').insert(campaign).select().single()
  if (error) throw error
  return data
}

// ── Templates ──────────────────────────────────────────────
export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase.from('templates').select('*').order('name')
  if (error) throw error
  return data ?? []
}

// ── Interactions ──────────────────────────────────────────────
export async function fetchInteractions(contactId: string): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from('interactions').select('*').eq('contact_id', contactId).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createInteraction(interaction: Omit<Interaction, 'id' | 'created_at'>): Promise<Interaction> {
  const { data, error } = await supabase.from('interactions').insert(interaction).select().single()
  if (error) throw error
  return data
}

// ── Stock deduction ──────────────────────────────────────────────
export async function deductStock(productId: string, quantity: number): Promise<void> {
  const { data: product, error: fetchErr } = await supabase
    .from('products').select('quantity').eq('id', productId).single()
  if (fetchErr) throw fetchErr
  const { error } = await supabase
    .from('products').update({ quantity: product.quantity - quantity }).eq('id', productId)
  if (error) throw error
}

// ── Feature #2: tracked links ────────────────────────────────
export async function createTrackedLink(input: {
  contact_id?: string
  destination: TrackedLink['destination']
  destination_id?: string
  label?: string
}): Promise<TrackedLink> {
  const token = crypto.randomUUID().split('-')[0]   // 8 chars enough for clean URL
  const { data, error } = await supabase
    .from('tracked_links').insert({ ...input, token, click_count: 0 }).select().single()
  if (error) throw error
  return data
}

export async function fetchTrackedLink(token: string): Promise<TrackedLink | null> {
  const { data, error } = await supabase
    .from('tracked_links').select('*').eq('token', token).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchTrackedLinksByContact(contactId: string): Promise<TrackedLink[]> {
  const { data, error } = await supabase
    .from('tracked_links').select('*').eq('contact_id', contactId).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchAllTrackedLinks(): Promise<TrackedLink[]> {
  const { data, error } = await supabase
    .from('tracked_links')
    .select('*, contact:contacts(name, company)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function incrementLinkClick(token: string): Promise<TrackedLink | null> {
  const { data, error } = await supabase.rpc('increment_link_click', { p_token: token })
  if (error) throw error
  return data as TrackedLink | null
}

// ── Feature #3: follow-up sequences ──────────────────────────
export async function fetchSequences(): Promise<FollowUpSequence[]> {
  const { data, error } = await supabase
    .from('follow_up_sequences').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createSequence(seq: Omit<FollowUpSequence, 'id' | 'created_at'>): Promise<FollowUpSequence> {
  const { data, error } = await supabase.from('follow_up_sequences').insert(seq).select().single()
  if (error) throw error
  return data
}

/** Formata Date para 'YYYY-MM-DD' usando componentes locais (não UTC).
 *  Evita bug onde, em UTC-3, `toISOString().split('T')[0]` retorna o dia anterior. */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function applySequenceToContact(
  sequence: FollowUpSequence,
  contactId: string,
  startDate: Date = new Date(),
): Promise<FollowUpTask[]> {
  const tasks = sequence.steps.map((step: SequenceStep, idx: number) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + step.day_offset)
    return {
      sequence_id: sequence.id,
      contact_id: contactId,
      step_index: idx,
      scheduled_for: toLocalDateString(d),
      action: step.action,
      template_id: step.template_id,
      label: step.label,
      status: 'pendente' as const,
    }
  })
  const { data, error } = await supabase.from('follow_up_tasks').insert(tasks).select()
  if (error) throw error
  return data ?? []
}

export async function fetchFollowUpTasks(): Promise<FollowUpTask[]> {
  const { data, error } = await supabase
    .from('follow_up_tasks')
    .select('*, contact:contacts(name, company, phone, email), template:templates(*)')
    .order('scheduled_for')
  if (error) throw error
  return data ?? []
}

export async function completeFollowUpTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('follow_up_tasks')
    .update({ status: 'concluido', completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function cancelFollowUpTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('follow_up_tasks').update({ status: 'cancelado' }).eq('id', id)
  if (error) throw error
}

// ── Feature #8: bulk contact creation (from scrape) ──────────────────────

export async function createContactsBulk(
  contacts: Omit<Contact, 'id' | 'created_at' | 'updated_at'>[],
): Promise<Contact[]> {
  if (!contacts.length) return []
  const enriched = contacts.map(c => ({
    ...c,
    updated_at: new Date().toISOString(),
  }))
  const { data, error } = await supabase
    .from('contacts')
    .insert(enriched)
    .select()
  if (error) throw error
  return data ?? []
}

/** Save lat/lng to an existing contact */
export async function saveContactCoords(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ lat, lng, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Fetch contacts that have coordinates (for route planning) */
export async function fetchContactsWithCoords(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

// ── Feature #9: AI prospecting ────────────────────────────────────────────

export async function fetchAiQualifiedLeads(limit = 100): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .not('lead_score', 'is', null)
    .order('lead_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function updateContactAiFields(
  id: string,
  fields: Partial<Pick<Contact, 'lead_score' | 'ai_draft_message' | 'ai_qualified_at' | 'ai_model' | 'ai_rationale'>>,
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function createProspectingRun(
  run: Omit<ProspectingRun, 'id' | 'started_at' | 'completed_at'>,
): Promise<ProspectingRun> {
  const { data, error } = await supabase
    .from('prospecting_runs')
    .insert(run)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function completeProspectingRun(
  id: string,
  fields: Partial<ProspectingRun>,
): Promise<void> {
  const { error } = await supabase
    .from('prospecting_runs')
    .update({ ...fields, completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function fetchProspectingRuns(limit = 20): Promise<ProspectingRun[]> {
  const { data, error } = await supabase
    .from('prospecting_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ── Feature #10: WhatsApp templates + messages ────────────────────────────

export async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('active', true)
    .order('phase')
  if (error) throw error
  return data ?? []
}

export async function createWhatsAppTemplate(
  t: Omit<WhatsAppTemplate, 'id' | 'created_at' | 'updated_at'>,
): Promise<WhatsAppTemplate> {
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .insert(t)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWhatsAppTemplate(
  id: string,
  updates: Partial<WhatsAppTemplate>,
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function logWhatsAppMessage(
  msg: Omit<WhatsAppMessage, 'id' | 'sent_at'>,
): Promise<WhatsAppMessage> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert(msg)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchContactMessages(contactId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('sent_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Feature #11: AI daily briefings ──────────────────────────────────────

export async function fetchTodaysBriefing(): Promise<AiBriefing | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('ai_briefings')
    .select('*')
    .eq('briefing_date', today)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveBriefing(
  briefing: Omit<AiBriefing, 'id' | 'generated_at'>,
): Promise<AiBriefing> {
  // Upsert by briefing_date (unique constraint)
  const { data, error } = await supabase
    .from('ai_briefings')
    .upsert(briefing, { onConflict: 'briefing_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchRecentBriefings(limit = 7): Promise<AiBriefing[]> {
  const { data, error } = await supabase
    .from('ai_briefings')
    .select('*')
    .order('briefing_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
