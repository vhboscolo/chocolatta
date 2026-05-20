import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { incrementLinkClick } from '../../lib/db'
import { IS_CONFIGURED } from '../../hooks/useData'

/**
 * /l/:token — rastreia o clique e redireciona conforme o destino.
 * Usado para tracking de e-mails / WhatsApp / links genéricos.
 */
export default function LinkRedirect() {
  const { token } = useParams<{ token: string }>()

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        if (IS_CONFIGURED) {
          const link = await incrementLinkClick(token)
          if (cancelled) return
          if (link?.destination === 'catalog') {
            window.location.replace(`/c/${link.destination_id ?? token}`)
            return
          }
          if (link?.destination === 'proposal' && link.destination_id) {
            window.location.replace(`/p/${link.destination_id}`)
            return
          }
          if (link?.destination === 'custom' && link.destination_id) {
            window.location.replace(link.destination_id)
            return
          }
        }
      } catch { /* silent */ }
      // fallback
      window.location.replace('/c')
    })()
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#B82020] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Redirecionando…</p>
      </div>
    </div>
  )
}
