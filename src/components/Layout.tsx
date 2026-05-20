import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Users, Package, Megaphone, ShoppingCart,
  LayoutDashboard, Bell, Menu, X, CalendarCheck
} from 'lucide-react'
import { useProducts, IS_CONFIGURED } from '../hooks/useData'
import { differenceInDays, parseISO } from 'date-fns'

// Full nav — sidebar desktop
const navItems = [
  { to: '/', icon: CalendarCheck, label: 'Agenda' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/estoque', icon: Package, label: 'Estoque' },
  { to: '/campanhas', icon: Megaphone, label: 'Campanhas' },
  { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
]

// Bottom nav — mobile (5 items, Dashboard acessível via drawer)
const bottomNavItems = [
  { to: '/', icon: CalendarCheck, label: 'Agenda' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/estoque', icon: Package, label: 'Estoque' },
  { to: '/campanhas', icon: Megaphone, label: 'Campanhas' },
  { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
]

const pageTitles: Record<string, string> = {
  '/': 'Agenda do Dia',
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/estoque': 'Estoque',
  '/campanhas': 'Campanhas',
  '/pedidos': 'Pedidos',
}

export default function Layout() {
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()
  const { data: products } = useProducts()

  const alerts = products.filter(p => {
    if (!p.expiry_date) return false
    return differenceInDays(parseISO(p.expiry_date), new Date()) <= 30
  }).length

  const titulo = pageTitles[location.pathname] ?? 'CRM'

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-100">

      {/* ── Sidebar desktop (md+) ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-[#1E2535] text-white">
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#B82020] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">S</div>
            <div>
              <div className="font-bold text-sm tracking-wide leading-none">SÖLEN</div>
              <div className="text-[9px] text-white/50 uppercase tracking-widest mt-0.5">CRM Biscolata</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-[#B82020] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 space-y-1">
          {/* Indicador de conexão */}
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${IS_CONFIGURED ? 'bg-green-400' : 'bg-amber-400'}`} />
            <span className="text-[10px] text-white/40">
              {IS_CONFIGURED ? 'Supabase conectado' : 'Modo demonstração'}
            </span>
          </div>
          <div className="text-[10px] text-white/30">Aris Importação & Exportação</div>
        </div>
      </aside>

      {/* ── Drawer menu mobile ── */}
      {menuAberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAberto(false)} />
          {/* Painel */}
          <div className="absolute inset-y-0 left-0 w-64 bg-[#1E2535] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#B82020] flex items-center justify-center text-white font-bold text-xs">S</div>
                <div>
                  <div className="font-bold text-sm text-white">SÖLEN</div>
                  <div className="text-[9px] text-white/50 uppercase tracking-widest">CRM Biscolata</div>
                </div>
              </div>
              <button onClick={() => setMenuAberto(false)} className="text-white/60 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-auto">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMenuAberto(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive ? 'bg-[#B82020] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-white/10 space-y-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${IS_CONFIGURED ? 'bg-green-400' : 'bg-amber-400'}`} />
                <span className="text-[10px] text-white/40">
                  {IS_CONFIGURED ? 'Supabase conectado' : 'Modo demonstração'}
                </span>
              </div>
              <div className="text-[10px] text-white/30">Aris Importação & Exportação</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Botão menu mobile */}
            <button
              onClick={() => setMenuAberto(true)}
              className="md:hidden text-gray-500 hover:text-gray-700 p-1 -ml-1"
            >
              <Menu size={20} />
            </button>
            <span className="font-semibold text-gray-800 text-sm">{titulo}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge modo demo — mobile */}
            {!IS_CONFIGURED && (
              <span className="md:hidden text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                Demo
              </span>
            )}
            {alerts > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2 py-1 rounded-full border border-amber-200">
                <Bell size={11} />
                <span className="hidden sm:inline">{alerts} validade{alerts > 1 ? 's' : ''}</span>
                <span className="sm:hidden">{alerts}</span>
              </div>
            )}
            <div className="w-7 h-7 rounded-full bg-[#B82020] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">VH</div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-3 md:p-5 pb-20 md:pb-5">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom nav mobile (5 itens) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex">
        {bottomNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#B82020]' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
