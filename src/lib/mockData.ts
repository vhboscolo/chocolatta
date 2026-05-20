import type {
  Contact, Product, Order, Campaign, Template, Interaction,
  FollowUpSequence, FollowUpTask, TrackedLink,
} from './supabase'

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Nutymax Pistache 44g',
    sku: 'GOF.9607',
    quantity: 42048,
    unit_price: 7.00,
    expiry_date: '2026-08-15',
    description: 'Wafer crocante com creme de pistache coberto com chocolate ao leite',
    image_url: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&q=80',
    tagline: 'Wafer crocante de pistache turco premium',
    category: 'Wafer',
    featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'DuoMax Avelã 44g',
    sku: 'BIS.0705',
    quantity: 33552,
    unit_price: 6.00,
    expiry_date: '2026-07-20',
    description: 'Wafer com recheio de creme de avelã e cacau, coberto com chocolate ao leite',
    image_url: 'https://images.unsplash.com/photo-1582176604856-e824b4736522?w=600&q=80',
    tagline: 'Creme de avelã coberto com chocolate ao leite',
    category: 'Wafer',
    featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Biscolata Mood 125g',
    sku: 'BIS.5705',
    quantity: 5064,
    unit_price: 14.00,
    expiry_date: '2026-06-10',
    description: 'Biscoito crocante com recheio cremoso de chocolate e avelã, em embalagem copo',
    image_url: 'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=600&q=80',
    tagline: 'Biscoito copo premium para snack ou coffee break',
    category: 'Biscoito',
    featured: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Biscolata Mood 40g',
    sku: 'BIS.5700',
    quantity: 6624,
    unit_price: 5.50,
    expiry_date: '2026-06-25',
    description: 'Biscoito com recheio de creme de chocolate e avelã, formato individual',
    image_url: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=600&q=80',
    tagline: 'Formato individual ideal para presente corporativo',
    category: 'Biscoito',
    featured: false,
    created_at: new Date().toISOString(),
  },
]

export const mockContacts: Contact[] = [
  {
    id: '1', name: 'Carlos Mendes', company: 'Rede Doces Premium',
    email: 'carlos@rededdoces.com.br', phone: '11987654321',
    segment: 'varejo', status: 'negociando', tags: ['varejo', 'sp'],
    notes: 'Interesse em Nutymax para rede de 12 lojas', source: 'indicação',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: '2', name: 'Fernanda Lima', company: 'Café Gourmet SP',
    email: 'fernanda@cafegourmet.com.br', phone: '11976543210',
    segment: 'food-service', status: 'proposta-enviada', tags: ['food-service', 'coffee-break'],
    notes: 'Usa Mood Copo para coffee break corporativo', source: 'importação',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: '3', name: 'Roberto Alves', company: 'Eventos & Cia',
    email: 'roberto@eventoecia.com.br', phone: '11965432109',
    segment: 'eventos', status: 'novo', tags: ['eventos', 'presente-corporativo'], source: 'manual',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: '4', name: 'Márcia Souza', company: 'Atacadão das Guloseimas',
    email: 'marcia@atacadao.com.br', phone: '11954321098',
    segment: 'atacado', status: 'fechado', tags: ['atacado', 'volume'],
    notes: 'Pedido de R$ 18.000 confirmado', source: 'importação',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: '5', name: 'Paulo Rodrigues', company: 'Supermercado Pão Doce',
    email: 'paulo@paodoce.com.br', phone: '11943210987',
    segment: 'varejo', status: 'contatado', tags: ['varejo', 'supermercado'], source: 'manual',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
]

export const mockTemplates: Template[] = [
  {
    id: '1', name: 'Prospecção inicial',
    subject: 'Chocolates turcos premium — amostra grátis para {empresa}',
    body: 'Olá {nome}, trabalho com chocolates turcos premium da marca Sölen — semelhantes ao Ferrero Rocher, porém com origem e sabor únicos. Temos estoque disponível para entrega imediata em SP. Posso enviar uma amostra sem compromisso para vocês experimentarem?',
    channel: 'ambos', variables: ['{nome}', '{empresa}'], created_at: new Date().toISOString(),
  },
  {
    id: '2', name: 'Follow-up (3 dias sem resposta)',
    body: 'Olá {nome}, passando para retomar nosso contato sobre os chocolates Sölen para {empresa}. Temos condição especial de volume disponível esta semana. Posso ligar para apresentar?',
    channel: 'ambos', variables: ['{nome}', '{empresa}'], created_at: new Date().toISOString(),
  },
  {
    id: '3', name: 'Oferta de volume especial',
    body: 'Olá {nome}, tenho uma condição especial de volume disponível para {empresa} esta semana: {produto} com desconto progressivo a partir de R$ 3.000. Entrega em 24h em SP. Interesse em receber uma proposta?',
    channel: 'ambos', variables: ['{nome}', '{empresa}', '{produto}'], created_at: new Date().toISOString(),
  },
  {
    id: '4', name: 'Urgência de estoque',
    body: 'Olá {nome}, comunicado importante: estamos com estoque disponível de {produto} com condição especial por tempo limitado. Temos {quantidade} unidades para entrega imediata. Gostaria de garantir o seu pedido antes que esgote?',
    channel: 'ambos', variables: ['{nome}', '{produto}', '{quantidade}'], created_at: new Date().toISOString(),
  },
  {
    id: '5', name: 'Kit corporativo — Natal',
    subject: 'Kit presente corporativo Sölen — Natal 2026',
    body: 'Olá {nome}, chegou a época de surpreender clientes e colaboradores com algo diferente. Montamos kits de presente corporativo com chocolates turcos premium Sölen — a partir de R$ 55 por kit, com entrega em SP. Posso enviar o catálogo completo?',
    channel: 'email', variables: ['{nome}'], created_at: new Date().toISOString(),
  },
]

export const mockCampaigns: Campaign[] = [
  {
    id: '1', name: 'Prospecção Varejo — Maio 2026', channel: 'whatsapp', status: 'enviada',
    sent_at: new Date(Date.now() - 3 * 86400000).toISOString(), recipient_count: 24,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: '2', name: 'Follow-up Food Service', channel: 'email', status: 'agendada',
    scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(), recipient_count: 12,
    created_at: new Date().toISOString(),
  },
]

export const mockInteractions: Interaction[] = [
  {
    id: '1', contact_id: '1', type: 'whatsapp',
    notes: 'Enviou catálogo de produtos. Cliente demonstrou interesse.',
    next_action: 'Enviar proposta comercial',
    next_action_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    created_by: 'Victor Hugo', created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: '2', contact_id: '1', type: 'ligacao',
    notes: 'Apresentou linha completa. Pediu amostras.',
    created_by: 'Victor Hugo', created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
]

export const mockOrders: Order[] = [
  {
    id: '1', contact_id: '4', status: 'pago', total: 18000, discount_pct: 20,
    channel: 'direto', notes: 'Pagamento via PIX',
    public_token: 'demo-marcia', view_count: 3,
    accepted_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    valid_until: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: '2', contact_id: '2', status: 'proposta', total: 4200, discount_pct: 10,
    channel: 'direto',
    public_token: 'demo-fernanda', view_count: 1,
    last_viewed_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    valid_until: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
]

export const mockSequences: FollowUpSequence[] = [
  {
    id: 'seq-1',
    name: 'Prospecção Fria (7 dias)',
    description: 'Sequência inicial para novos leads sem resposta',
    steps: [
      { day_offset: 0, action: 'whatsapp', label: 'Apresentação inicial' },
      { day_offset: 3, action: 'whatsapp', label: 'Follow-up: confirmar interesse' },
      { day_offset: 7, action: 'email', label: 'Última tentativa + amostra' },
    ],
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'seq-2',
    name: 'Pós-Proposta (14 dias)',
    description: 'Acompanhamento após envio de proposta comercial',
    steps: [
      { day_offset: 2, action: 'whatsapp', label: 'Confirmar recebimento' },
      { day_offset: 5, action: 'ligacao', label: 'Ligar para responder dúvidas' },
      { day_offset: 10, action: 'whatsapp', label: 'Última condição especial' },
      { day_offset: 14, action: 'email', label: 'Encerrar ou retomar' },
    ],
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'seq-3',
    name: 'Pós-Venda (30 dias)',
    description: 'Fidelização e recompra após pedido pago',
    steps: [
      { day_offset: 3, action: 'whatsapp', label: 'Confirmar satisfação' },
      { day_offset: 15, action: 'whatsapp', label: 'Oferecer recompra' },
      { day_offset: 30, action: 'email', label: 'NPS + condição especial' },
    ],
    active: true,
    created_at: new Date().toISOString(),
  },
]

export const mockFollowUpTasks: FollowUpTask[] = [
  {
    id: 'task-1', sequence_id: 'seq-2', contact_id: '2', step_index: 0,
    scheduled_for: new Date().toISOString().split('T')[0],
    action: 'whatsapp', label: 'Confirmar recebimento', status: 'pendente',
    created_at: new Date().toISOString(),
  },
  {
    id: 'task-2', sequence_id: 'seq-1', contact_id: '3', step_index: 1,
    scheduled_for: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    action: 'whatsapp', label: 'Follow-up: confirmar interesse', status: 'pendente',
    created_at: new Date().toISOString(),
  },
]

export const mockTrackedLinks: TrackedLink[] = [
  {
    id: 'link-1', token: 'demo-link-1', contact_id: '1',
    destination: 'catalog', label: 'Catálogo completo',
    click_count: 4,
    first_clicked_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    last_clicked_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
]
