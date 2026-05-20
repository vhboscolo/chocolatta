import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { incrementLinkClick } from '../../lib/db'
import { IS_CONFIGURED } from '../../hooks/useData'
import { mockTrackedLinks } from '../../lib/mockData'

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
      const link = IS_CONFIGURED
        ? await incrementLinkClick(token).catch(() => null)
        : mockTrackedLinks.find(l => l.token === token) ?? null

      if (cancelled) return

      if (link?.destination === 'proposal' && link.destination_id) {
        window.location.replace(`/p/${link.destination_id}`)
        return
      }
      if (link?.destination === 'custom' && link.destination_id) {
        window.location.replace(link.destination_id)
        return
      }
      // 'catalog' ou sem destino — abre catálogo personalizado pelo token
      window.location.replace(`/c/${token}`)
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
