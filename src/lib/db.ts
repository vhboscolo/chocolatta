import { supabase } from './supabase'
import type { Contact, Product, Order, Campaign, Template, Interaction } from './supabase'

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
    .select('*, contact:contacts(name, company)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createOrder(order: Omit<Order, 'id' | 'created_at'>): Promise<Order> {
  const { data, error } = await supabase.from('orders').insert(order).select().single()
  if (error) throw error
  return data
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
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
    .from('interactions')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
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
