import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { MessageCircle, Loader2, Star, Package } from 'lucide-react'
import type { Product } from '../../lib/supabase'
import * as db from '../../lib/db'
import { IS_CONFIGURED } from '../../hooks/useData'
import { mockProducts } from '../../lib/mockData'

const VICTOR_PHONE = '11999999999'

function whatsappVictor(message: string) {
  return `https://wa.me/55${VICTOR_PHONE}?text=${encodeURIComponent(message)}`
}

const PACK_SIZE = 24

export default function CatalogView() {
  const { token } = useParams<{ token: string }>()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('Todos')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (IS_CONFIGURED) {
          if (token) db.incrementLinkClick(token).catch(() => {})
          const result = await db.fetchProducts()
          if (!cancelled) setProducts(result)
        } else {
          setProducts(mockProducts)
        }
      } catch {
        setProducts(mockProducts)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => { if (p.category) set.add(p.category) })
    return ['Todos', ...Array.from(set).sort()]
  }, [products])

  const filtered = category === 'Todos' ? products : products.filter(p => p.category === category)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 size={32} className="text-[#B82020] animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando catálogo…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xl font-black tracking-tight text-[#B82020]" style={{ fontFamily: 'Playfair Display, serif' }}>
                SÖLEN
              </div>
              <div className="text-[10px] text-gray-400 tracking-[2px] uppercase">Catálogo de Produtos</div>
            </div>
          </div>
          <a
            href={whatsappVictor('Olá Victor, vi o catálogo Sölen e tenho interesse em conversar.')}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white bg-[#25D366] px-3 py-2 rounded-lg hover:bg-[#1da851] transition-colors"
          >
            <MessageCircle size={14} />
            <span className="hidden sm:inline">Falar com Victor</span>
            <span className="sm:hidden">Victor</span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1E2535] to-[#0F1419] text-white">
        <div className="max-w-6xl mx-auto px-5 py-14 sm:py-20 text-center">
          <div className="text-[10px] tracking-[3px] uppercase text-[#C9A84C] font-medium mb-4">
            Distribuidora Oficial Brasil
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Chocolates turcos premium
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-xl mx-auto leading-relaxed">
            Aris Importação &amp; Exportação — distribuidora oficial Sölen no Brasil. Estoque pronto em SP, entrega em 24h.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-5 pt-8">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-colors flex-shrink-0 ${
                category === cat
                  ? 'bg-[#B82020] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
            <Package size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Nenhum produto nesta categoria.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-6xl mx-auto px-5 py-8 text-center text-xs text-gray-500 space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Estoque disponível em SP · entrega em 24h · pedido mínimo R$ 500
          </p>
          <p>Pagamento: PIX · boleto · transferência bancária</p>
          <div className="pt-4 mt-4 border-t border-gray-100">
            <div className="text-sm font-bold text-[#B82020]" style={{ fontFamily: 'Playfair Display, serif' }}>SÖLEN</div>
            <div className="text-[10px] tracking-[2px] uppercase text-gray-400">Aris Importação &amp; Exportação</div>
            <div className="mt-2 text-gray-400">vendas@arisimportacao.com.br</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const unit = product.unit_price
  const pack = unit * PACK_SIZE
  const msg = `Olá Victor, tenho interesse em ${product.name} (${product.sku}). Pode me enviar uma proposta?`

  return (
    <article className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={36} className="text-gray-300" />
          </div>
        )}
        {product.category && (
          <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-wider uppercase bg-white/95 text-gray-700 px-2.5 py-1 rounded-full shadow-sm">
            {product.category}
          </span>
        )}
        {product.featured && (
          <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase bg-[#C9A84C] text-white px-2.5 py-1 rounded-full shadow-sm">
            <Star size={10} fill="currentColor" />
            Destaque
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="font-mono text-[10px] text-gray-400 mb-1">{product.sku}</div>
        <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{product.name}</h3>
        {product.tagline && (
          <p className="text-sm text-gray-500 italic mb-3 leading-snug">{product.tagline}</p>
        )}
        {product.description && (
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">{product.description}</p>
        )}

        <div className="mt-auto pt-4 border-t border-gray-100">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-2xl font-bold text-[#B82020]">
                R$ {unit.toFixed(2).replace('.', ',')}<span className="text-sm font-medium text-gray-400">/un</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Caixa com {PACK_SIZE}un: <span className="font-semibold text-gray-700">R$ {pack.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          <a
            href={whatsappVictor(msg)}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full text-sm font-semibold text-white bg-[#25D366] py-3 rounded-xl hover:bg-[#1da851] transition-colors"
          >
            <MessageCircle size={14} />
            Solicitar proposta
          </a>
        </div>
      </div>
    </article>
  )
}
