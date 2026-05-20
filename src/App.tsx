import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Agenda from './pages/Agenda'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Estoque from './pages/Estoque'
import Campanhas from './pages/Campanhas'
import Pedidos from './pages/Pedidos'

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
        <Route path="/" element={<Layout />}>
          <Route index element={<Agenda />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="estoque" element={<Estoque />} />
          <Route path="campanhas" element={<Campanhas />} />
          <Route path="pedidos" element={<Pedidos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
