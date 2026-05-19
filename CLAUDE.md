# CRM Sölen Biscolata

Sistema de gestão comercial para Aris Importação & Exportação — distribuidora oficial da Sölen Biscolata no Brasil.

## Stack
- **Frontend:** React 19 + TypeScript + Vite 8
- **Estilo:** Tailwind CSS v4 (via @tailwindcss/vite)
- **Banco:** Supabase (PostgreSQL) — configurar `.env.local`
- **Roteamento:** React Router DOM v7
- **Deploy:** Vercel

## Iniciar
```bash
npm install
npm run dev   # http://localhost:5173
```

## Estrutura
```
src/
  lib/
    supabase.ts    # cliente Supabase + tipos
    mockData.ts    # dados de demonstração (pré-Supabase)
  components/
    Layout.tsx     # sidebar + topbar
  pages/
    Dashboard.tsx  # KPIs, pipeline, alertas
    Leads.tsx      # CRM: listagem, ficha, histórico, importação CSV
    Estoque.tsx    # SKUs, validades, tabela de preços por canal
    Campanhas.tsx  # criação em 3 passos, geração de links WhatsApp
    Pedidos.tsx    # propostas, status, política de desconto
```

## Variáveis de ambiente (.env.local)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RESEND_API_KEY=
```

## Conectar ao Supabase
1. Execute `supabase_schema.sql` no SQL Editor do projeto Supabase
2. Preencha `.env.local` com URL e anon key do projeto
3. Substituir `mockData` por chamadas reais em `src/lib/supabase.ts`

## Regras de negócio
- Baixa automática: ao mudar pedido para `pago`
- Alerta validade: ≤ 30 dias → amarelo, ≤ 15 dias → vermelho
- Follow-up: badge quando lead sem contato há ≥ 3 dias
- Desconto por volume: até R$5k→10%, R$5k–15k→15%, R$15k–40k→20%, acima→30%
- WhatsApp: `https://wa.me/55{telefone}?text={msg_encoded}`
- Meta receita: R$ 422.083

## Identidade visual
- Vermelho: `#B82020` | Dourado: `#C9A84C` | Slate: `#1E2535`
- Fonte: DM Sans (interface) + Playfair Display (display)
- Português brasileiro em toda a interface
