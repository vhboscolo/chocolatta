import { useState } from 'react'
import { Eye, Share2, Link2, Copy, MessageCircle, Mail, ExternalLink, Star, Package, BarChart3 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import type { Product, TrackedLink } from '../lib/supabase'
import { useProducts, useContacts, useAllTrackedLinks, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { catalogUrl, copyToClipboard, whatsappWithLink, emailWithLink, shortUrl } from '../lib/tracking'

const PACK_SIZE = 24
type Tab = 'visualizar' | 'compartilhar' | 'links'

export default function Catalogo() {
  const { data: products } = useProducts()
  const { data: contacts } = useContacts()
  const { data: trackedLinks, setData: setTrackedLinks } = useAllTrackedLinks()
  const [tab, setTab] = useState<Tab>('visualizar')

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catálogo</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {products.length} produto{products.length !== 1 ? 's' : ''} · visualize e compartilhe
          </p>
        </div>
        <a
          href="/c"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={13} />
          Abrir catálogo público
        </a>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1 w-fit">
        <TabBtn active={tab === 'visualizar'} onClick={() => setTab('visualizar')} icon={<Eye size={13} />}>
          Visualizar
        </TabBtn>
        <TabBtn active={tab === 'compartilhar'} onClick={() => setTab('compartilhar')} icon={<Share2 size={13} />}>
          Compartilhar
        </TabBtn>
        <TabBtn active={tab === 'links'} onClick={() => setTab('links')} icon={<BarChart3 size={13} />}>
          Links rastreados
        </TabBtn>
      </div>

      {tab === 'visualizar' && <VisualizarTab products={products} />}
      {tab === 'compartilhar' && (
        <CompartilharTab
          contacts={contacts}
          onCreated={(link) => setTrackedLinks(prev => [link, ...prev])}
        />
      )}
      {tab === 'links' && <LinksTab links={trackedLinks} contacts={contacts} />}
    </div>
  )
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
        active ? 'bg-[#B82020] text-white' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function VisualizarTab({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map(p => <PreviewCard key={p.id} product={p} />)}
    </div>
  )
}

function PreviewCard({ product }: { product: Product }) {
  const pack = product.unit_price * PACK_SIZE
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="relative aspect-[4/3] bg-gray-100">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={32} className="text-gray-300" />
          </div>
        )}
        {product.category && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold tracking-wider uppercase bg-white/95 text-gray-700 px-2 py-0.5 rounded-full shadow-sm">
            {product.category}
          </span>
        )}
        {product.featured && (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold uppercase bg-[#C9A84C] text-white px-2 py-0.5 rounded-full shadow-sm">
            <Star size={9} fill="currentColor" />
            Destaque
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="font-mono text-[10px] text-gray-400 mb-0.5">{product.sku}</div>
        <div className="font-bold text-gray-900 leading-tight">{product.name}</div>
        {product.tagline && <div className="text-xs text-gray-500 italic mt-0.5">{product.tagline}</div>}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-lg font-bold text-[#B82020]">
            R$ {product.unit_price.toFixed(2).replace('.', ',')}<span className="text-xs font-medium text-gray-400">/un</span>
          </div>
          <div className="text-[11px] text-gray-500">
            Caixa {PACK_SIZE}un: R$ {pack.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}

function CompartilharTab({
  contacts,
  onCreated,
}: {
  contacts: ReturnType<typeof useContacts>['data']
  onCreated: (l: TrackedLink) => void
}) {
  const [contactId, setContactId] = useState('')
  const [generated, setGenerated] = useState<TrackedLink | null>(null)
  const [loading, setLoading] = useState(false)

  const contact = contacts.find(c => c.id === contactId)
  const url = generated ? catalogUrl(generated.token) : ''

  async function handleGenerate() {
    if (!contactId) return
    setLoading(true)
    try {
      if (IS_CONFIGURED) {
        const link = await db.createTrackedLink({
          contact_id: contactId,
          destination: 'catalog',
          label: 'Catálogo completo',
        })
        setGenerated(link)
        onCreated(link)
      } else {
        const link: TrackedLink = {
          id: `link-${Date.now()}`,
          token: crypto.randomUUID().split('-')[0],
          contact_id: contactId,
          destination: 'catalog',
          label: 'Catálogo completo',
          click_count: 0,
          created_at: new Date().toISOString(),
        }
        setGenerated(link)
        onCreated(link)
      }
      toast.success('Link gerado!')
    } catch {
      toast.error('Erro ao gerar link')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!url) return
    const ok = await copyToClipboard(url)
    if (ok) toast.success('Link copiado!')
    else toast.error('Não foi possível copiar')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5 max-w-2xl">
      <div>
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Link2 size={15} className="text-[#B82020]" />
          Gerar link personalizado
        </h2>
        <p className="text-xs text-gray-500">Cada link tem token único — você sabe quem visualizou e quantas vezes.</p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1">Cliente</label>
        <select
          value={contactId}
          onChange={e => { setContactId(e.target.value); setGenerated(null) }}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
        >
          <option value="">Selecionar cliente</option>
          {contacts.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!contactId || loading}
        className="w-full text-sm font-medium text-white bg-[#B82020] py-2.5 rounded-xl hover:bg-[#9E1C1C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Gerando…' : 'Gerar link personalizado'}
      </button>

      {generated && url && (
        <div className="space-y-3 pt-3 border-t border-gray-100">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">URL rastreável</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shortUrl(url)}
                className="flex-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Copy size={12} />
                Copiar
              </button>
            </div>
          </div>

          {contact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {contact.phone && (
                <a
                  href={whatsappWithLink(
                    contact.phone,
                    `Olá ${contact.name}, segue nosso catálogo completo de chocolates Sölen:`,
                    url,
                  )}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#25D366] py-2.5 rounded-xl hover:bg-[#1da851] transition-colors"
                >
                  <MessageCircle size={14} />
                  Enviar por WhatsApp
                </a>
              )}
              {contact.email && (
                <a
                  href={emailWithLink(
                    contact.email,
                    'Catálogo Sölen Biscolata — chocolates turcos premium',
                    `Olá ${contact.name},\n\nSegue nosso catálogo completo de chocolates turcos Sölen. Estoque pronto em SP, entrega em 24h.`,
                    url,
                  )}
                  className="flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#1E2535] py-2.5 rounded-xl hover:bg-[#0F1419] transition-colors"
                >
                  <Mail size={14} />
                  Enviar por E-mail
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LinksTab({ links, contacts }: { links: TrackedLink[]; contacts: ReturnType<typeof useContacts>['data'] }) {
  if (links.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Link2 size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Nenhum link rastreado ainda.</p>
        <p className="text-xs text-gray-400 mt-1">Vá para "Compartilhar" para gerar o primeiro.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-50">
        {links.map(l => {
          const contact = contacts.find(c => c.id === l.contact_id)
          return (
            <div key={l.id} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F7EEEE] flex items-center justify-center flex-shrink-0">
                <Link2 size={15} className="text-[#B82020]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm truncate">
                    {contact?.name ?? 'Sem cliente'}
                  </span>
                  {contact?.company && (
                    <span className="text-xs text-gray-400">{contact.company}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {l.label ?? l.destination}
                  {l.last_clicked_at && (
                    <span className="text-gray-400"> · último clique {format(parseISO(l.last_clicked_at), "d MMM HH:mm", { locale: ptBR })}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-gray-900">{l.click_count}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">clique{l.click_count !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
