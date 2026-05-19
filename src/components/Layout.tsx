import { NavLink, Outlet } from 'react-router-dom'
import {
  Users, Package, Megaphone, ShoppingCart,
  LayoutDashboard, ChevronRight, Bell
} from 'lucide-react'
import { mockProducts } from '../lib/mockData'
import { differenceInDays, parseISO } from 'date-fns'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/estoque', icon: Package, label: 'Estoque' },
  { to: '/campanhas', icon: Megaphone, label: 'Campanhas' },
  { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
]

function getExpiryAlerts() {
  const today = new Date()
  return mockProducts.filter(p => {
    if (!p.expiry_date) return false
    const days = differenceInDays(parseISO(p.expiry_date), today)
    return days <= 30
  }).length
}

export default function Layout() {
  const alerts = getExpiryAlerts()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-[#1E2535] text-white">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#B82020] flex items-center justify-center text-white font-bold text-sm">S</div>
            <div>
              <div className="font-bold text-sm tracking-wide leading-none">SÖLEN</div>
              <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">CRM Biscolata</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#B82020] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Rodapé */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-[11px] text-white/40 mb-1">Aris Importação & Exportação</div>
          <div className="text-[11px] text-white/30">vendas@arisimportacao.com</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <ChevronRight size={14} />
            <span>Sistema CRM</span>
          </div>
          <div className="flex items-center gap-3">
            {alerts > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200">
                <Bell size={12} />
                {alerts} validade(s) próximas
              </div>
            )}
            <div className="w-8 h-8 rounded-full bg-[#B82020] flex items-center justify-center text-white text-xs font-bold">VH</div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
