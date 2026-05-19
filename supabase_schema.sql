-- ============================================================
-- CRM Sölen Biscolata — Schema Supabase / PostgreSQL
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Contatos / Leads
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  segment text, -- corporativo, food-service, varejo, eventos, representante, atacado
  status text default 'novo', -- novo, contatado, proposta-enviada, negociando, fechado, perdido
  tags text[],
  notes text,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Produtos / Estoque
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  quantity integer not null default 0,
  unit_price decimal(10,2) not null,
  expiry_date date,
  description text,
  created_at timestamptz default now()
);

-- Pedidos
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id),
  status text default 'proposta',
  total decimal(10,2),
  discount_pct decimal(5,2) default 0,
  channel text,
  notes text,
  created_at timestamptz default now()
);

-- Itens do pedido
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer not null,
  unit_price decimal(10,2) not null
);

-- Campanhas
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  template_id uuid,
  status text default 'rascunho',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer default 0,
  created_at timestamptz default now()
);

-- Envios individuais por campanha
create table if not exists campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  contact_id uuid references contacts(id),
  status text default 'pendente',
  sent_at timestamptz,
  opened_at timestamptz
);

-- Templates de mensagem
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text,
  body text not null,
  channel text,
  variables text[],
  created_at timestamptz default now()
);

-- Representantes
create table if not exists representatives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  region text,
  commission_pct decimal(5,2) default 8,
  monthly_goal decimal(10,2),
  active boolean default true,
  created_at timestamptz default now()
);

-- Interações / histórico
create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  type text,
  notes text,
  next_action text,
  next_action_date date,
  created_by text,
  created_at timestamptz default now()
);

-- ============================================================
-- SEED: Produtos iniciais
-- ============================================================
insert into products (name, sku, quantity, unit_price, expiry_date, description) values
  ('Nutymax Pistache 44g', 'GOF.9607', 42048, 7.00, '2026-08-15', 'Wafer crocante com creme de pistache coberto com chocolate ao leite'),
  ('DuoMax Avelã 44g', 'BIS.0705', 33552, 6.00, '2026-07-20', 'Wafer com recheio de creme de avelã e cacau, coberto com chocolate ao leite'),
  ('Biscolata Mood 125g', 'BIS.5705', 5064, 14.00, '2026-06-10', 'Biscoito crocante com recheio cremoso de chocolate e avelã, em embalagem copo'),
  ('Biscolata Mood 40g', 'BIS.5700', 6624, 5.50, '2026-06-25', 'Biscoito com recheio de creme de chocolate e avelã, formato individual')
on conflict (sku) do nothing;

-- ============================================================
-- SEED: Templates pré-carregados
-- ============================================================
insert into templates (name, subject, body, channel, variables) values
  (
    'Prospecção inicial',
    'Chocolates turcos premium — amostra grátis para {empresa}',
    'Olá {nome}, trabalho com chocolates turcos premium da marca Sölen — semelhantes ao Ferrero Rocher, porém com origem e sabor únicos. Temos estoque disponível para entrega imediata em SP. Posso enviar uma amostra sem compromisso para vocês experimentarem?',
    'ambos',
    array['{nome}', '{empresa}']
  ),
  (
    'Follow-up (3 dias sem resposta)',
    null,
    'Olá {nome}, passando para retomar nosso contato sobre os chocolates Sölen para {empresa}. Temos condição especial de volume disponível esta semana. Posso ligar para apresentar?',
    'ambos',
    array['{nome}', '{empresa}']
  ),
  (
    'Oferta de volume especial',
    null,
    'Olá {nome}, tenho uma condição especial de volume disponível para {empresa} esta semana: {produto} com desconto progressivo a partir de R$ 3.000. Entrega em 24h em SP. Interesse em receber uma proposta?',
    'ambos',
    array['{nome}', '{empresa}', '{produto}']
  ),
  (
    'Urgência de estoque',
    null,
    'Olá {nome}, comunicado importante: estamos com estoque disponível de {produto} com condição especial por tempo limitado. Temos {quantidade} unidades para entrega imediata. Gostaria de garantir o seu pedido antes que esgote?',
    'ambos',
    array['{nome}', '{produto}', '{quantidade}']
  ),
  (
    'Kit corporativo — Natal',
    'Kit presente corporativo Sölen — Natal 2026',
    'Olá {nome}, chegou a época de surpreender clientes e colaboradores com algo diferente. Montamos kits de presente corporativo com chocolates turcos premium Sölen — a partir de R$ 55 por kit, com entrega em SP. Posso enviar o catálogo completo?',
    'email',
    array['{nome}']
  );

-- ============================================================
-- RLS: Habilitar Row Level Security (produção)
-- Remova o comentário quando adicionar autenticação
-- ============================================================
-- alter table contacts enable row level security;
-- alter table products enable row level security;
-- alter table orders enable row level security;
-- alter table campaigns enable row level security;
-- alter table templates enable row level security;
-- alter table interactions enable row level security;
