import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  isSupported, getPermission, getPreferences, savePreferences,
  requestPermission, notify,
} from '../lib/notifications'

const DISMISS_KEY = 'notification-banner-dismissed'

export default function NotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [enabled, setEnabled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [supported, setSupported] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSupported(isSupported())
    setPermission(getPermission())
    setEnabled(getPreferences().enabled)
    setDismissed(typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (!supported) return null
  if (permission === 'denied') return null
  if (permission === 'granted' && enabled) return null
  if (dismissed) return null

  async function handleEnable() {
    setLoading(true)
    try {
      const result = await requestPermission()
      setPermission(result)
      if (result === 'granted') {
        const prefs = getPreferences()
        savePreferences({ ...prefs, enabled: true })
        setEnabled(true)
        notify('🍫 Notificações ativadas!', {
          body: 'Você receberá alertas sobre validades, propostas vistas e follow-ups.',
        })
        toast.success('Notificações ativadas')
      } else {
        toast.error('Permissão negada pelo navegador')
      }
    } catch {
      toast.error('Erro ao ativar notificações')
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="bg-white rounded-xl border border-[#B82020]/20 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-[#B82020]/10 flex items-center justify-center flex-shrink-0">
        <Bell size={16} className="text-[#B82020]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Receba alertas no celular</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Validades, propostas vistas, pagamentos pendentes e follow-ups do dia.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-300 hover:text-gray-500 flex-shrink-0 p-1 -mr-1"
            aria-label="Dispensar"
          >
            <X size={14} />
          </button>
        </div>
        <button
          onClick={handleEnable}
          disabled={loading}
          className="mt-3 text-xs font-medium text-white bg-[#B82020] px-3 py-1.5 rounded-lg hover:bg-[#9E1C1C] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Ativando...' : 'Ativar notificações'}
        </button>
      </div>
    </div>
  )
}
