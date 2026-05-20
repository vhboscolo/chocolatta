/**
 * Tracking helpers — gera links públicos rastreáveis para
 * propostas, catálogo e links customizados.
 *
 * Padrão de URL:
 *   /p/{token}      → proposta (orders.public_token)
 *   /c/{token}      → catálogo dedicado a um cliente
 *   /l/{token}      → redirect rastreado (tracked_links.token)
 */

export function publicOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export function proposalUrl(token: string): string {
  return `${publicOrigin()}/p/${token}`
}

export function catalogUrl(token?: string): string {
  return token ? `${publicOrigin()}/c/${token}` : `${publicOrigin()}/c`
}

export function trackedRedirect(token: string): string {
  return `${publicOrigin()}/l/${token}`
}

/** Encurta visualmente (para mostrar na UI) */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

/** Copia para o clipboard com feedback de toast (consumidor passa o toast) */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Builders de mensagem com link embutido */
export function whatsappWithLink(phone: string, message: string, url: string): string {
  const clean = phone.replace(/\D/g, '')
  const fullMsg = encodeURIComponent(`${message}\n\n${url}`)
  return `https://wa.me/55${clean}?text=${fullMsg}`
}

export function emailWithLink(email: string, subject: string, body: string, url: string): string {
  const fullBody = encodeURIComponent(`${body}\n\n${url}`)
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${fullBody}`
}

export function shareViaWebApi(title: string, text: string, url: string): boolean {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    navigator.share({ title, text, url }).catch(() => {})
    return true
  }
  return false
}
