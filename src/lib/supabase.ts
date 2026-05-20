import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  contacts: Contact
  products: Product
  orders: Order
  order_items: OrderItem
  campaigns: Campaign
  campaign_sends: CampaignSend
  templates: Template
  representatives: Representative
  interactions: Interaction
  tracked_links: TrackedLink
  follow_up_sequences: FollowUpSequence
  follow_up_tasks: FollowUpTask
}

export interface Contact {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  segment?: string
  status: string
  tags?: string[]
  notes?: string
  source?: string
  // Geographic coordinates (populated from Apify scrape or Nominatim geocoding)
  lat?: number
  lng?: number
  // Lead lifecycle stage (frio = never contacted)
  lead_status?: 'frio' | 'contactado' | 'interessado' | 'proposta' | 'cliente'
  // AI prospecting fields
  lead_score?: number          // 0-100 from LLM qualification
  ai_draft_message?: string    // LLM-drafted first contact message
  ai_qualified_at?: string
  ai_model?: string
  ai_rationale?: string
  created_at: string
  updated_at: string
}

// ── AI prospecting runs ────────────────────────────────────────────────────
export interface ProspectingRun {
  id: string
  triggered_by: 'cron' | 'manual' | 'api'
  search_query: string
  location: string
  apify_run_id?: string
  apify_result_count: number
  leads_qualified: number
  leads_created: number
  leads_skipped_duplicate: number
  llm_model?: string
  llm_tokens_used: number
  status: 'running' | 'completed' | 'failed'
  error_message?: string
  started_at: string
  completed_at?: string
}

// ── WhatsApp templates ─────────────────────────────────────────────────────
export type WhatsAppPhase = 'frio' | 'contactado' | 'interessado' | 'proposta' | 'pos_venda' | 'aniversario'

export interface WhatsAppTemplate {
  id: string
  name: string
  phase: WhatsAppPhase
  body: string
  variables: string[]
  description?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppMessage {
  id: string
  contact_id?: string
  direction: 'inbound' | 'outbound'
  body: string
  template_id?: string
  provider: 'waha' | 'meta_cloud' | 'wa_link'
  provider_message_id?: string
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  error_message?: string
  sent_at: string
}

// ── Scrape jobs (Apify run tracking) ──────────────────────────────────────
export interface ScrapeJob {
  id: string
  apify_run_id?: string
  search_query: string
  location: string
  status: 'running' | 'completed' | 'failed'
  result_count: number
  leads_created: number
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  quantity: number
  unit_price: number
  expiry_date?: string
  description?: string
  image_url?: string
  tagline?: string
  category?: string
  featured?: boolean
  created_at: string
}

export interface Order {
  id: string
  contact_id?: string
  status: string
  total?: number
  discount_pct: number
  channel?: string
  notes?: string
  created_at: string
  // Tracking & sharing
  public_token?: string
  view_count?: number
  first_viewed_at?: string
  last_viewed_at?: string
  accepted_at?: string
  rejected_at?: string
  valid_until?: string
  // Joins
  contact?: Contact
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  product?: Product
}

export interface Campaign {
  id: string
  name: string
  channel: string
  template_id?: string
  status: string
  scheduled_at?: string
  sent_at?: string
  recipient_count: number
  created_at: string
}

export interface CampaignSend {
  id: string
  campaign_id: string
  contact_id: string
  status: string
  sent_at?: string
  opened_at?: string
}

export interface Template {
  id: string
  name: string
  subject?: string
  body: string
  channel?: string
  variables?: string[]
  created_at: string
}

export interface Representative {
  id: string
  name: string
  email?: string
  phone?: string
  region?: string
  commission_pct: number
  monthly_goal?: number
  active: boolean
  created_at: string
}

export interface Interaction {
  id: string
  contact_id: string
  type?: string
  notes?: string
  next_action?: string
  next_action_date?: string
  created_by?: string
  created_at: string
}

// ── Feature #2: link tracking ─────────────────────────────
export interface TrackedLink {
  id: string
  token: string
  contact_id?: string
  destination: 'catalog' | 'proposal' | 'custom'
  destination_id?: string
  label?: string
  click_count: number
  first_clicked_at?: string
  last_clicked_at?: string
  created_at: string
}

// ── Feature #3: follow-up sequences ───────────────────────
export type SequenceAction = 'whatsapp' | 'email' | 'ligacao' | 'visita'
export interface SequenceStep {
  day_offset: number
  action: SequenceAction
  template_id?: string
  label: string
}
export interface FollowUpSequence {
  id: string
  name: string
  description?: string
  steps: SequenceStep[]
  active: boolean
  created_at: string
}
export interface FollowUpTask {
  id: string
  sequence_id?: string
  contact_id: string
  step_index: number
  scheduled_for: string
  action: SequenceAction
  template_id?: string
  label?: string
  status: 'pendente' | 'concluido' | 'cancelado'
  completed_at?: string
  created_at: string
  // joins
  contact?: Contact
  sequence?: FollowUpSequence
  template?: Template
}
