/**
 * Notifications helper — alertas locais no navegador.
 * Estratégia: enquanto o app estiver aberto (ou via PWA instalado),
 * dispara notificações nativas do SO via Notification API.
 *
 * Para push de verdade (com o app fechado) seria necessário um servidor
 * + Web Push Protocol. Aqui usamos uma abordagem mais simples e funcional:
 * a página verifica condições e dispara notificações.
 */

const STORAGE_KEY = 'crm-solen-notifications'
const SHOWN_KEY = 'crm-solen-shown-alerts'

export type NotificationPreference = {
  enabled: boolean
  expiringProducts: boolean
  overdueFollowUps: boolean
  proposalViewed: boolean
  paymentPending: boolean
}

const DEFAULT_PREFS: NotificationPreference = {
  enabled: false,
  expiringProducts: true,
  overdueFollowUps: true,
  proposalViewed: true,
  paymentPending: true,
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission(): NotificationPermission {
  if (!isSupported()) return 'denied'
  return Notification.permission
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return await Notification.requestPermission()
}

export function getPreferences(): NotificationPreference {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePreferences(prefs: NotificationPreference): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

/** Mostra uma notificação local (se permitido) */
export function notify(title: string, options?: NotificationOptions & { dedupeKey?: string }): void {
  if (!isSupported() || Notification.permission !== 'granted') return
  // dedup: não mostrar duas vezes o mesmo alerta no mesmo dia
  if (options?.dedupeKey) {
    const shown = getShownAlerts()
    if (shown[options.dedupeKey] === todayKey()) return
    shown[options.dedupeKey] = todayKey()
    saveShownAlerts(shown)
  }
  try {
    new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options,
    })
  } catch {
    /* iOS Safari sem PWA instalado lança aqui */
  }
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function getShownAlerts(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveShownAlerts(data: Record<string, string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHOWN_KEY, JSON.stringify(data))
}

export function clearShownAlerts(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SHOWN_KEY)
}
