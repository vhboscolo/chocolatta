import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Agenda from './pages/Agenda'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Estoque from './pages/Estoque'
import Campanhas from './pages/Campanhas'
import Pedidos from './pages/Pedidos'
import Pipeline from './pages/Pipeline'
import Relatorios from './pages/Relatorios'
import Catalogo from './pages/Catalogo'
import Sequencias from './pages/Sequencias'
import Prospeccao from './pages/Prospeccao'
import Rotas from './pages/Rotas'
import ProposalView from './pages/public/ProposalView'
import CatalogView from './pages/public/CatalogView'
import LinkRedirect from './pages/public/LinkRedirect'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: '13px', fontFamily: 'DM Sans, sans-serif' },
          success: { iconTheme: { primary: '#1A7F5A', secondary: '#fff' } },
        }}
      />
      <Routes>
        {/* ── Rotas públicas (sem Layout interno) ── */}
        <Route path="/p/:token" element={<ProposalView />} />
        <Route path="/c/:token" element={<CatalogView />} />
        <Route path="/c" element={<CatalogView />} />
        <Route path="/l/:token" element={<LinkRedirect />} />

        {/* ── Rotas autenticadas (com Layout) ── */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Agenda />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="leads" element={<Leads />} />
          <Route path="estoque" element={<Estoque />} />
          <Route path="catalogo" element={<Catalogo />} />
          <Route path="campanhas" element={<Campanhas />} />
          <Route path="sequencias" element={<Sequencias />} />
          <Route path="prospeccao" element={<Prospeccao />} />
          <Route path="rotas" element={<Rotas />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="relatorios" element={<Relatorios />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
