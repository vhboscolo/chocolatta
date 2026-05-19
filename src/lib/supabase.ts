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
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  quantity: number
  unit_price: number
  expiry_date?: string
  description?: string
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
