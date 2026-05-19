import { useState } from 'react'
import { Plus, Megaphone, Mail, MessageCircle, Clock, CheckCircle2, Send, X, Copy } from 'lucide-react'
import { mockContacts, mockProducts } from '../lib/mockData'
import type { Campaign } from '../lib/supabase'
import { useCampaigns, useTemplates, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

const statusColors: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  agendada: 'bg-blue-50 text-blue-700',
  enviada: 'bg-green-50 text-green-700',
  cancelada: 'bg-red-50 text-red-600',
}

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho', agendada: 'Agendada', enviada: 'Enviada', cancelada: 'Cancelada',
}

const SEGMENTOS = ['corporativo', 'food-service', 'varejo', 'eventos', 'representante', 'atacado']

function interpolate(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export default function Campanhas() {
  const { data: campaigns, setData: setCampaigns, reload: reloadCampaigns } = useCampaigns()
  const { data: templates } = useTemplates()
  const [showNova, setShowNova] = useState(false)
  const [showLinks, setShowLinks] = useState<{ links: string[]; nome: string } | null>(null)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNova(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#B82020] px-4 py-2 rounded-lg hover:bg-[#9E1C1C] transition-colors"
        >
          <Plus size={14} />
          Nova Campanha
        </button>
      </div>

      {/* Lista de campanhas */}
      <div className="space-y-3">
        {campaigns.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.channel === 'email' ? 'bg-blue-50' : 'bg-green-50'}`}>
                  {c.channel === 'email'
                    ? <Mail size={16} className="text-blue-600" />
                    : <MessageCircle size={16} className="text-green-600" />
                  }
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[c.status]}`}>
                      {statusLabels[c.status]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {c.recipient_count} destinatário{c.recipient_count !== 1 ? 's' : ''}
                    </span>
                    {c.scheduled_at && (
                      <span className="text-xs text-blue-600 flex items-center gap-1">
                        <Clock size={10} />
                        {format(parseISO(c.scheduled_at), "d MMM, HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {c.sent_at && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Enviada em {format(parseISO(c.sent_at), "d MMM", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {c.channel === 'whatsapp' && c.status === 'enviada' && (
                <span className="text-xs text-gray-400">Links gerados</span>
              )}
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Megaphone size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhuma campanha criada ainda.</p>
          </div>
        )}
      </div>

      {/* Templates disponíveis */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Templates Disponíveis</h2>
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium text-sm text-gray-900">{t.name}</div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full capitalize">{t.channel}</span>
              </div>
              {t.subject && <div className="text-xs text-gray-500 mb-1">Assunto: {t.subject}</div>}
              <p className="text-xs text-gray-600 line-clamp-2">{t.body}</p>
              {t.variables && t.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.variables.map(v => (
                    <span key={v} className="text-[10px] font-mono bg-[#F7EEEE] text-[#B82020] px-1.5 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal nova campanha */}
      {showNova && (
        <NovaCampanhaModal
          templates={templates}
          onClose={() => setShowNova(false)}
          onSave={async (c, links) => {
            if (IS_CONFIGURED) {
              await db.createCampaign(c)
              await reloadCampaigns()
            } else {
              setCampaigns(prev => [c, ...prev])
            }
            setShowNova(false)
            if (links) {
              setShowLinks({ links, nome: c.name })
            } else {
              toast.success('Campanha criada!')
            }
          }}
        />
      )}

      {/* Modal links WhatsApp */}
      {showLinks && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Links WhatsApp gerados</h2>
                <p className="text-sm text-gray-500">{showLinks.nome}</p>
              </div>
              <button onClick={() => setShowLinks(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-2">
              {showLinks.links.map((link, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5">
                  <MessageCircle size={14} className="text-green-600 flex-shrink-0" />
                  <span className="text-xs text-gray-600 flex-1 truncate">{decodeURIComponent(link.split('?text=')[1] ?? '').substring(0, 60)}...</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado!') }}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    <Copy size={13} />
                  </button>
                  <a href={link} target="_blank" rel="noreferrer" className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md hover:bg-green-100">
                    Abrir
                  </a>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(showLinks.links.join('\n'))
                  toast.success('Todos os links copiados!')
                }}
                className="w-full text-sm font-medium text-gray-700 border border-gray-200 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Copy size={14} />
                Copiar todos os links
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NovaCampanhaModal({ onClose, onSave, templates }: {
  onClose: () => void
  onSave: (c: Campaign, links?: string[]) => void
  templates: import('../lib/supabase').Template[]
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nome: '',
    canal: 'whatsapp',
    templateId: '',
    segmento: '',
    produto: '',
    mensagemCustom: '',
    scheduledAt: '',
  })

  const templateSelecionado = templates.find(t => t.id === form.templateId)
  const contatosFiltrados = form.segmento
    ? mockContacts.filter(c => c.segment === form.segmento && c.phone)
    : mockContacts.filter(c => c.phone)
  const produtoSelecionado = mockProducts.find(p => p.id === form.produto)

  function previewMensagem(contato = mockContacts[0]) {
    const base = form.mensagemCustom || templateSelecionado?.body || ''
    return interpolate(base, {
      nome: contato.name,
      empresa: contato.company ?? '',
      produto: produtoSelecionado?.name ?? '',
      preco: produtoSelecionado ? `R$ ${produtoSelecionado.unit_price.toFixed(2).replace('.', ',')}` : '',
      quantidade: produtoSelecionado ? produtoSelecionado.quantity.toLocaleString('pt-BR') : '',
      prazo_entrega: '24 horas',
    })
  }

  function handleCreate() {
    const campanha: Campaign = {
      id: `camp-${Date.now()}`,
      name: form.nome,
      channel: form.canal,
      template_id: form.templateId || undefined,
      status: form.scheduledAt ? 'agendada' : 'enviada',
      scheduled_at: form.scheduledAt || undefined,
      sent_at: form.scheduledAt ? undefined : new Date().toISOString(),
      recipient_count: contatosFiltrados.length,
      created_at: new Date().toISOString(),
    }

    if (form.canal === 'whatsapp') {
      const links = contatosFiltrados
        .filter(c => c.phone)
        .map(c => {
          const msg = encodeURIComponent(previewMensagem(c))
          const tel = c.phone!.replace(/\D/g, '')
          return `https://wa.me/55${tel}?text=${msg}`
        })
      onSave(campanha, links)
    } else {
      onSave(campanha)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Nova Campanha</h2>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-6 h-1 rounded-full transition-colors ${step >= s ? 'bg-[#B82020]' : 'bg-gray-200'}`} />
              ))}
              <span className="text-xs text-gray-400 ml-1">Passo {step} de 3</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nome da campanha *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Prospecção Varejo — Junho 2026"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30 focus:border-[#B82020]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Canal de disparo</label>
                <div className="grid grid-cols-2 gap-2">
                  {['whatsapp', 'email'].map(canal => (
                    <button
                      key={canal}
                      onClick={() => setForm(p => ({ ...p, canal }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${form.canal === canal ? 'border-[#B82020] bg-[#F7EEEE]' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      {canal === 'whatsapp'
                        ? <MessageCircle size={16} className="text-green-600" />
                        : <Mail size={16} className="text-blue-600" />
                      }
                      <span className="text-sm font-medium capitalize">{canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</span>
                    </button>
                  ))}
                </div>
                {form.canal === 'whatsapp' && (
                  <p className="text-xs text-gray-400 mt-2">Links personalizados serão gerados para envio manual 1 a 1.</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Filtrar por segmento (opcional)</label>
                <select
                  value={form.segmento}
                  onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                >
                  <option value="">Todos os contatos ({mockContacts.filter(c => c.phone).length})</option>
                  {SEGMENTOS.map(s => (
                    <option key={s} value={s}>
                      {s} ({mockContacts.filter(c => c.segment === s && c.phone).length})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Produto em destaque (opcional)</label>
                <select
                  value={form.produto}
                  onChange={e => setForm(p => ({ ...p, produto: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                >
                  <option value="">Selecionar produto</option>
                  {mockProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.quantity.toLocaleString('pt-BR')} un.</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Template base</label>
                <div className="space-y-2">
                  {templates.filter(t => t.channel === 'ambos' || t.channel === form.canal).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setForm(p => ({ ...p, templateId: t.id, mensagemCustom: '' }))}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${form.templateId === t.id ? 'border-[#B82020] bg-[#F7EEEE]' : 'border-gray-100 hover:border-gray-200 bg-gray-50'}`}
                    >
                      <div className="font-medium text-sm text-gray-900">{t.name}</div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.body.substring(0, 80)}...</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Ou escreva uma mensagem customizada</label>
                <textarea
                  value={form.mensagemCustom}
                  onChange={e => setForm(p => ({ ...p, mensagemCustom: e.target.value, templateId: '' }))}
                  rows={3}
                  placeholder="Use {nome}, {empresa}, {produto}, {preco}, {quantidade}"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preview da mensagem</h3>
                <div className="bg-white rounded-xl border border-gray-200 p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {previewMensagem()}
                </div>
              </div>
              <div className="bg-[#F7EEEE] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resumo</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Canal</span><span className="font-medium capitalize">{form.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Destinatários</span><span className="font-medium">{contatosFiltrados.length} contatos</span></div>
                  {form.segmento && <div className="flex justify-between"><span className="text-gray-500">Segmento</span><span className="font-medium capitalize">{form.segmento}</span></div>}
                  {produtoSelecionado && <div className="flex justify-between"><span className="text-gray-500">Produto</span><span className="font-medium">{produtoSelecionado.name}</span></div>}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Agendar para (opcional — deixe em branco para disparar agora)</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#B82020]/30"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Voltar
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <div className="flex-1" />
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !form.nome}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#B82020] rounded-lg hover:bg-[#9E1C1C] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!form.nome || (!form.templateId && !form.mensagemCustom)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#B82020] rounded-lg hover:bg-[#9E1C1C] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              {form.scheduledAt ? 'Agendar' : 'Disparar agora'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
