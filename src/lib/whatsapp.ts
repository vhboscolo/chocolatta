/**
 * WhatsApp client — abstraction over WAHA (now) / Meta Cloud API (later).
 *
 * WAHA: https://waha.devlike.pro/
 *   - Open source, free, self-hosted Docker container
 *   - Uses WhatsApp Web (so requires a phone connected to the internet)
 *   - Endpoint: http://your-waha-host:3000
 *
 * Meta Cloud API:
 *   - Official, but requires Meta Business approval + WhatsApp Business number
 *   - Free up to 1000 service conversations/month
 *
 * Config via env vars:
 *   VITE_WHATSAPP_PROVIDER=waha | meta | demo
 *   VITE_WAHA_BASE_URL=https://your-waha.host
 *   VITE_WAHA_API_KEY=optional bearer token
 *   VITE_WAHA_SESSION=default  (WAHA session name)
 *   VITE_META_PHONE_ID=...  (for Meta provider)
 *   VITE_META_ACCESS_TOKEN=...  (for Meta provider)
 *
 * When no provider configured: falls back to wa.me deep links (current behavior).
 */

export type WhatsAppProvider = 'waha' | 'meta' | 'demo' | 'wa_link'

const PROVIDER = (import.meta.env.VITE_WHATSAPP_PROVIDER as WhatsAppProvider) ?? 'wa_link'

export const WHATSAPP_PROVIDER = PROVIDER
export const IS_WAHA_CONFIGURED = PROVIDER === 'waha' && !!import.meta.env.VITE_WAHA_BASE_URL
export const IS_META_CONFIGURED = PROVIDER === 'meta' &&
  !!import.meta.env.VITE_META_PHONE_ID &&
  !!import.meta.env.VITE_META_ACCESS_TOKEN

export interface SendMessageParams {
  to: string         // E.164: 5511999999999
  body: string
}

export interface SendMessageResult {
  providerMessageId?: string
  status: 'sent' | 'queued' | 'failed'
  error?: string
}

// ─── Phone normalization ──────────────────────────────────────────────────

/** Normalize Brazilian phone to E.164 (55DDDNNNNNNNNN) */
export function normalizePhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // already has country code
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits
  // local format: 11 digits with 9, or 10 without
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits   // fallback — provider will reject if invalid
}

// ─── Send (router) ────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const to = normalizePhoneBR(params.to)
  switch (PROVIDER) {
    case 'waha': return sendViaWaha(to, params.body)
    case 'meta': return sendViaMeta(to, params.body)
    case 'demo': return { status: 'sent', providerMessageId: `demo-${Date.now()}` }
    case 'wa_link':
    default:
      // Fallback: open wa.me in a new tab (manual send)
      const url = `https://wa.me/${to}?text=${encodeURIComponent(params.body)}`
      window.open(url, '_blank', 'noopener')
      return { status: 'sent', providerMessageId: `walink-${Date.now()}` }
  }
}

// ─── WAHA implementation ──────────────────────────────────────────────────

async function sendViaWaha(to: string, body: string): Promise<SendMessageResult> {
  const base = (import.meta.env.VITE_WAHA_BASE_URL as string).replace(/\/+$/, '')
  const session = (import.meta.env.VITE_WAHA_SESSION as string) ?? 'default'
  const apiKey = import.meta.env.VITE_WAHA_API_KEY as string | undefined

  try {
    const res = await fetch(`${base}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        session,
        chatId: `${to}@c.us`,
        text: body,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { status: 'failed', error: `WAHA ${res.status}: ${errText.slice(0, 200)}` }
    }
    const data = (await res.json()) as { id?: { id?: string } | string }
    const msgId = typeof data.id === 'string' ? data.id : data.id?.id
    return { status: 'sent', providerMessageId: msgId }
  } catch (e) {
    return { status: 'failed', error: (e as Error).message }
  }
}

// ─── Meta Cloud API implementation (placeholder for later) ───────────────

async function sendViaMeta(to: string, body: string): Promise<SendMessageResult> {
  const phoneId = import.meta.env.VITE_META_PHONE_ID as string
  const token = import.meta.env.VITE_META_ACCESS_TOKEN as string

  try {
    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { status: 'failed', error: `Meta ${res.status}: ${errText.slice(0, 200)}` }
    }
    const data = (await res.json()) as { messages?: { id: string }[] }
    return { status: 'sent', providerMessageId: data.messages?.[0]?.id }
  } catch (e) {
    return { status: 'failed', error: (e as Error).message }
  }
}

// ─── Template interpolation ──────────────────────────────────────────────

/**
 * Replace {{variable}} placeholders in a template body.
 * Missing vars stay as-is so they're visible during review.
 */
export function interpolateTemplate(
  body: string,
  values: Record<string, string | number | undefined>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = values[key]
    return v != null ? String(v) : `{{${key}}}`
  })
}
