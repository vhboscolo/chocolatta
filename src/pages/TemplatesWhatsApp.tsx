import { useState } from 'react'
import {
  MessageCircle, Plus, Edit3, Save, X, Copy, Check, Server,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useWhatsAppTemplates, IS_CONFIGURED } from '../hooks/useData'
import * as db from '../lib/db'
import { copyToClipboard } from '../lib/tracking'
import { WHATSAPP_PROVIDER, IS_WAHA_CONFIGURED, IS_META_CONFIGURED } from '../lib/whatsapp'
import type { WhatsAppTemplate, WhatsAppPhase } from '../lib/supabase'

const PHASE_LABELS: Record<WhatsAppPhase, { label: string; color: string }> = {
  frio: { label: 'Frio (1º contato)', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  contactado: { label: 'Contactado', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  interessado: { label: 'Interessado', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  proposta: { label: 'Proposta', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  pos_venda: { label: 'Pós-venda', color: 'bg-green-50 text-green-700 border-green-200' },
  aniversario: { label: 'Aniversário', color: 'bg-pink-50 text-pink-700 border-pink-200' },
}

export default function TemplatesWhatsApp() {
  const { data: templates, reload } = useWhatsAppTemplates()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Partial<WhatsAppTemplate>>({})
  const [showSetup, setShowSetup] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // ─── Group by phase ──────────────────────────────────────────────────────
  const grouped = templates.reduce<Record<string, WhatsAppTemplate[]>>((acc, t) => {
    acc[t.phase] ??= []
    acc[t.phase].push(t)
    return acc
  }, {})

  const startEdit = (t: WhatsAppTemplate) => {
    setEditingId(t.id)
    setDraft({ name: t.name, body: t.body, description: t.description, phase: t.phase })
  }

  const startCreate = (phase: WhatsAppPhase) => {
    setCreating(true)
    setDraft({ name: '', body: '', phase, description: '', variables: [] })
  }

  const saveTemplate = async () => {
    if (!draft.name?.trim() || !draft.body?.trim()) {
      toast.error('Nome e corpo da mensagem são obrigatórios')
      return
    }
    // Extract variables from {{var}} placeholders
    const vars = Array.from(new Set([...(draft.body ?? '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])))
    try {
      if (editingId) {
        if (IS_CONFIGURED) {
          await db.updateWhatsAppTemplate(editingId, { ...draft, variables: vars })
        }
        toast.success('Template atualizado')
      } else {
        if (IS_CONFIGURED) {
          await db.createWhatsAppTemplate({
            name: draft.name!,
            phase: draft.phase as WhatsAppPhase,
            body: draft.body!,
            variables: vars,
            description: draft.description,
            active: true,
          })
        }
        toast.success('Template criado')
      }
      setEditingId(null)
      setCreating(false)
      setDraft({})
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const copyBody = async (t: WhatsAppTemplate) => {
    await copyToClipboard(t.body)
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle size={20} className="text-[#25D366]" />
          Templates WhatsApp
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Mensagens prontas por fase do funil — use no Agente IA, sequências ou envio manual
        </p>
      </div>

      {/* Provider status */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server size={16} className="text-gray-400" />
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Provider WhatsApp</div>
              <div className="text-sm font-semibold mt-0.5">
                {WHATSAPP_PROVIDER === 'waha' && (IS_WAHA_CONFIGURED
                  ? <span className="text-green-700">WAHA conectado ✓</span>
                  : <span className="text-amber-700">WAHA configurado, aguardando conexão</span>)}
                {WHATSAPP_PROVIDER === 'meta' && (IS_META_CONFIGURED
                  ? <span className="text-green-700">Meta Cloud API conectado ✓</span>
                  : <span className="text-amber-700">Meta API incompleta</span>)}
                {WHATSAPP_PROVIDER === 'wa_link' && <span className="text-gray-500">wa.me (envio manual)</span>}
                {WHATSAPP_PROVIDER === 'demo' && <span className="text-purple-700">Demo (não envia)</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSetup(s => !s)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            {showSetup ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Configurar
          </button>
        </div>

        {showSetup && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 text-xs">
            <SetupBlock
              title="🟢 WAHA (recomendado para começar — grátis)"
              steps={[
                '1. Deploy WAHA em Railway/Render/Fly.io grátis: docker run -p 3000:3000 devlikeapro/waha',
                '2. Acesse http://seu-host:3000/dashboard e escaneie o QR Code com seu WhatsApp',
                '3. Adicione ao .env.local e Vercel: VITE_WHATSAPP_PROVIDER=waha, VITE_WAHA_BASE_URL=https://seu-host',
                '4. (Opcional) VITE_WAHA_API_KEY=sua-chave para autenticar requests',
              ]}
            />
            <SetupBlock
              title="🔵 Meta Cloud API (oficial, requer aprovação)"
              steps={[
                '1. Crie conta Meta Business: business.facebook.com',
                '2. Adicione número WhatsApp Business e solicite Cloud API (1k conv grátis/mês)',
                '3. Aprove templates no Meta (~24-48h cada)',
                '4. Adicione: VITE_WHATSAPP_PROVIDER=meta, VITE_META_PHONE_ID, VITE_META_ACCESS_TOKEN',
              ]}
            />
          </div>
        )}
      </div>

      {/* Templates by phase */}
      {(Object.entries(PHASE_LABELS) as [WhatsAppPhase, typeof PHASE_LABELS[WhatsAppPhase]][]).map(([phase, info]) => (
        <div key={phase} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.color}`}>
                {info.label}
              </span>
              <span className="text-xs text-gray-400">{grouped[phase]?.length ?? 0} template{(grouped[phase]?.length ?? 0) !== 1 ? 's' : ''}</span>
            </h2>
            <button
              onClick={() => startCreate(phase)}
              className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              <Plus size={12} /> Novo
            </button>
          </div>

          {grouped[phase]?.length ? (
            <div className="space-y-2">
              {grouped[phase].map(t => {
                const isEditing = editingId === t.id
                return (
                  <div key={t.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div className="min-w-0">
                        {isEditing ? (
                          <input
                            value={draft.name ?? ''}
                            onChange={e => setDraft({ ...draft, name: e.target.value })}
                            className="text-sm font-semibold border border-purple-200 rounded-lg px-2 py-1 w-full"
                          />
                        ) : (
                          <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                        )}
                        {t.description && !isEditing && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{t.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => { setEditingId(null); setDraft({}) }} className="text-xs text-gray-400 px-2 py-1">
                              <X size={11} />
                            </button>
                            <button onClick={saveTemplate} className="text-xs bg-purple-600 text-white px-2 py-1 rounded-lg font-semibold">
                              <Save size={11} className="inline mr-0.5" />Salvar
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => copyBody(t)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
                              {copiedId === t.id ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                            </button>
                            <button onClick={() => startEdit(t)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
                              <Edit3 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      {isEditing ? (
                        <textarea
                          value={draft.body ?? ''}
                          onChange={e => setDraft({ ...draft, body: e.target.value })}
                          rows={6}
                          className="w-full border border-purple-200 rounded-lg p-2 text-sm font-mono"
                        />
                      ) : (
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                          {t.body}
                        </div>
                      )}

                      {t.variables?.length > 0 && !isEditing && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-[10px] text-gray-400">Variáveis:</span>
                          {t.variables.map(v => (
                            <span key={v} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-mono">
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center text-xs text-gray-400">
              Nenhum template nesta fase ainda
            </div>
          )}
        </div>
      ))}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-3">
            <h2 className="font-bold text-gray-900">Novo template</h2>
            <input
              value={draft.name ?? ''}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Nome do template"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={draft.description ?? ''}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Descrição (opcional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={draft.body ?? ''}
              onChange={e => setDraft({ ...draft, body: e.target.value })}
              rows={8}
              placeholder="Olá {{nome}}! ..."
              className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono"
            />
            <p className="text-[10px] text-gray-400">
              Use <code>{`{{variavel}}`}</code> para placeholders. Detectados automaticamente.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setCreating(false); setDraft({}) }} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={saveTemplate} className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-semibold">
                Criar template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WAHA quick deploy hint */}
      {WHATSAPP_PROVIDER === 'wa_link' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Pronto pra ativar o WAHA?</strong> Cole isso no Railway/Render e me avisa quando subir:
              <pre className="mt-2 bg-blue-100 rounded p-2 text-xs overflow-auto"><code>{`docker run -d -p 3000:3000 --name waha devlikeapro/waha`}</code></pre>
              Depois é só me passar a URL pública e eu configuro tudo.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SetupBlock({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <div className="font-semibold text-gray-900 mb-1.5">{title}</div>
      <ol className="space-y-1 text-gray-600 ml-1">
        {steps.map((s, i) => (
          <li key={i} className="leading-relaxed">{s}</li>
        ))}
      </ol>
    </div>
  )
}
