import { useEffect, useState } from "react";
import { RotateCcw, Save, SearchCheck, Sprout, Trophy } from "lucide-react";
import { toast } from "sonner";
import { fazendinhaService } from "../../services/api";
import type { FazendinhaState } from "../../types";
import { cn } from "../../lib/utils";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { LootboxRulesEditor, normalizeLootboxConfig, RewardExperienceSelector } from "../../components/admin/LootboxRulesEditor";
import { ResponsiveMediaFrame } from "../../components/ResponsiveMediaFrame";
import type { FazendinhaMediaSettings, FazendinhaMediaSlotSettings, FazendinhaPremiumExperienceSettings } from "../../types";

export function AdminFazendinha() {
  const [state, setState] = useState<FazendinhaState | null>(null);
  const [result, setResult] = useState({ numeroSorteado: "", origemResultado: "Loteria" });

  const load = () => {
    fazendinhaService.getAdminState().then(setState).catch(error => toast.error(error.message));
  };

  useEffect(() => {
    load();
  }, []);

  const saveConfig = async () => {
    if (!state) return;
    try {
      await fazendinhaService.updateConfig(state.config);
      if (state.mediaSettings) await fazendinhaService.updateMediaSettings(state.mediaSettings);
      toast.success("Configurações da Fazendinha salvas");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    }
  };

  const defaultMediaSettings: FazendinhaMediaSettings = {
    homeBanner: {
      enabled: false,
      mediaUrl: "",
      mediaType: "image",
      title: "A Fazendinha",
      description: "",
      fitMode: "auto",
      alt: "Mídia da Fazendinha",
      altText: "Mídia da Fazendinha",
      linkUrl: "",
      linkTarget: "_self",
      position: "home-banner"
    },
    checkoutMedia: {
      enabled: false,
      mediaUrl: "",
      mediaType: "image",
      title: "Resumo da Fazendinha",
      description: "",
      fitMode: "auto",
      alt: "Mídia do checkout da Fazendinha",
      altText: "Mídia do checkout da Fazendinha",
      linkUrl: "",
      linkTarget: "_self",
      position: "checkout"
    },
    premiumExperience: {
      premiumInfoEnabled: true,
      premiumTitle: "Escolha seus bichinhos da sorte",
      premiumDescription: "Participe da modalidade especial com grupos rápidos, PIX automático e experiência premium.",
      premiumHighlight: "Concorra com chances extras, prêmios instantâneos e caixinha premiada.",
      caixinhaHighlightEnabled: true,
      caixinhaTitle: "Caixinha Premiada",
      caixinhaDescription: "Compras confirmadas podem liberar uma caixinha com prêmio surpresa.",
      caixinhaPrizeValue: "Prêmio instantâneo",
      caixinhaIcon: "🎁",
      extractionEnabled: true,
      extractionTime: "",
      extractionText: "Próxima extração",
      prizeLabel: "Prêmio",
      prizeValue: "",
      ticketPriceLabel: "Cada bichinho por apenas",
      ticketPriceValue: "",
      ctaLabel: "Participar da Fazendinha",
      ctaSubtitle: "Escolha seus bichinhos e revise a compra antes do PIX."
    }
  };

  const patchMediaSettings = (slot: keyof FazendinhaMediaSettings, patch: Partial<FazendinhaMediaSlotSettings>) => {
    if (!state) return;
    const currentSettings = state.mediaSettings || {
      ...defaultMediaSettings,
      homeBanner: { ...defaultMediaSettings.homeBanner, ...(state.homeMedia || {}) }
    };
    setState({
      ...state,
      mediaSettings: {
        ...currentSettings,
        [slot]: {
          ...defaultMediaSettings[slot],
          ...(currentSettings[slot] || {}),
          ...patch
        }
      },
      homeMedia: slot === "homeBanner" ? { ...(state.homeMedia || defaultMediaSettings.homeBanner), ...patch, position: "above-fazendinha" as const } : state.homeMedia
    });
  };

  const patchPremiumExperience = (patch: Partial<FazendinhaPremiumExperienceSettings>) => {
    if (!state) return;
    const currentSettings = state.mediaSettings || {
      ...defaultMediaSettings,
      homeBanner: { ...defaultMediaSettings.homeBanner, ...(state.homeMedia || {}) }
    };
    setState({
      ...state,
      mediaSettings: {
        ...currentSettings,
        premiumExperience: {
          ...defaultMediaSettings.premiumExperience,
          ...(currentSettings.premiumExperience || {}),
          ...patch
        }
      }
    });
  };

  const publishResult = async () => {
    try {
      const data = await fazendinhaService.publishResult(result.numeroSorteado, result.origemResultado);
      toast.success(data.winner?.semGanhador ? "Resultado registrado sem ganhador" : "Ganhador marcado automaticamente");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao apurar");
    }
  };

  const resetRound = async () => {
    try {
      await fazendinhaService.resetRound();
      toast.success("Rodada resetada");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao resetar");
    }
  };

  if (!state) return null;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
            <Sprout className="h-8 w-8 text-emerald-300" /> Configurações da Fazendinha
          </h1>
          <p className="mt-2 text-sm text-slate-400">Controle rodada, preço, resultado e compradores por grupo.</p>
        </div>
        <button onClick={saveConfig} className="neon-button inline-flex items-center gap-2 rounded-xl px-5 py-3">
          <Save className="h-4 w-4" /> Salvar
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="glass-card p-6">
          <h2 className="mb-5 font-display text-xl font-bold">Dados da modalidade</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <input type="checkbox" checked={state.config.enabled} onChange={e => setState({ ...state, config: { ...state.config, enabled: e.target.checked } })} />
              <span className="text-sm text-white">Habilitar modalidade</span>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-500">Status da rodada</span>
              <select value={state.config.status} onChange={e => setState({ ...state, config: { ...state.config, status: e.target.value as any } })} className="w-full p-3">
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="closed">Encerrada</option>
              </select>
            </label>
            <Field label="Nome" value={state.config.name} onChange={value => setState({ ...state, config: { ...state.config, name: value } })} />
            <Field label="Preço por bichinho" type="number" value={String(state.config.pricePerGroup)} onChange={value => setState({ ...state, config: { ...state.config, pricePerGroup: Number(value) } })} />
            <Field label="Prêmio principal" value={state.config.mainPrize} onChange={value => setState({ ...state, config: { ...state.config, mainPrize: value } })} />
            <Field label="Data/hora do sorteio" value={state.config.drawDate} onChange={value => setState({ ...state, config: { ...state.config, drawDate: value } })} />
            <div className="md:col-span-2">
              <MediaPicker
                label="Imagem ou vídeo de apresentação"
                value={state.config.mediaUrl || ""}
                mediaType={state.config.mediaType}
                onChange={(mediaUrl, mediaType) => setState({ ...state, config: { ...state.config, mediaUrl, mediaType: mediaType as any } })}
              />
            </div>
            <label className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-500">Tipo da mídia</span>
              <select value={state.config.mediaType || "image"} onChange={e => setState({ ...state, config: { ...state.config, mediaType: e.target.value as any } })} className="w-full p-3">
                <option value="image">Imagem / GIF</option>
                <option value="video">MP4</option>
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="bunny">MediaDelivery / Bunny.net</option>
              </select>
            </label>
            <Field label="Sugestão de cotas adicionais" type="number" value={String(state.config.addonSuggestionTickets || 5)} onChange={value => setState({ ...state, config: { ...state.config, addonSuggestionTickets: Number(value) } })} />
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-mono uppercase text-slate-500">Descrição</span>
              <textarea value={state.config.description} onChange={e => setState({ ...state, config: { ...state.config, description: e.target.value } })} className="min-h-28 w-full p-3" />
            </label>
            <div className="md:col-span-2">
              <RewardExperienceSelector
                enabled={state.config.lootboxEnabled}
                value={state.config.lootboxConfig}
                onChange={(lootboxEnabled, lootboxConfig) => setState({ ...state, config: { ...state.config, lootboxEnabled, lootboxConfig } })}
              />
            </div>
            <div className="md:col-span-2">
              <LootboxRulesEditor
                title="Regras individuais da Fazendinha"
                value={normalizeLootboxConfig(state.config.lootboxConfig)}
                onChange={lootboxConfig => setState({ ...state, config: { ...state.config, lootboxConfig } })}
                showExperienceSelector={false}
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-2 font-display text-xl font-bold">Mídias</h2>
          <p className="mb-5 text-sm text-slate-400">Configure separadamente o banner promocional da Home e a mídia exibida no fluxo de pagamento.</p>
          <div className="grid gap-6">
            <MediaSettingsEditor
              title="Banner da modalidade Fazendinha na Home"
              helper="Aparece na Home pública antes da grade dos bichos."
              toggleLabel="Ativar banner na Home"
              mediaLabel="Imagem, GIF ou vídeo do banner da Home"
              value={(state.mediaSettings?.homeBanner || state.homeMedia || defaultMediaSettings.homeBanner) as FazendinhaMediaSlotSettings}
              onChange={patch => patchMediaSettings("homeBanner", patch)}
            />
            <PremiumExperienceEditor
              value={state.mediaSettings?.premiumExperience || defaultMediaSettings.premiumExperience}
              onChange={patchPremiumExperience}
            />
            <MediaSettingsEditor
              title="Mídia do checkout da Fazendinha"
              helper="Aparece no topo do checkout/recibo da Fazendinha, antes de Cliente identificado."
              toggleLabel="Ativar mídia no checkout"
              mediaLabel="Imagem, GIF ou vídeo do checkout"
              value={(state.mediaSettings?.checkoutMedia || defaultMediaSettings.checkoutMedia) as FazendinhaMediaSlotSettings}
              onChange={patch => patchMediaSettings("checkoutMedia", patch)}
            />
          </div>
        </div>

        <div className="glass-card p-6 space-y-5">
          <h2 className="font-display text-xl font-bold">Apuração da loteria</h2>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
            <input value={result.numeroSorteado} onChange={e => setResult({ ...result, numeroSorteado: e.target.value })} placeholder="00 a 99" className="p-3" />
            <input value={result.origemResultado} onChange={e => setResult({ ...result, origemResultado: e.target.value })} placeholder="Origem" className="p-3" />
            <button onClick={publishResult} className="rounded-xl border border-emerald-400/30 px-4 text-emerald-200"><SearchCheck className="h-5 w-5" /></button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-mono uppercase text-slate-500">Resultado atual</p>
            <p className="mt-1 font-display text-3xl font-bold text-white">{state.config.resultNumber || "--"}</p>
          </div>
          <button onClick={resetRound} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 py-3 text-red-200">
            <RotateCcw className="h-4 w-4" /> Resetar rodada
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden border border-white/5">
        <div className="border-b border-white/5 p-5">
          <h2 className="font-display text-xl font-bold">Compradores por bichinho</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs font-mono uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Bichinho</th>
                <th className="px-5 py-4">Números</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Comprador</th>
                <th className="px-5 py-4 text-right">Preço</th>
              </tr>
            </thead>
            <tbody>
              {state.groups.map(group => {
                const purchase = state.purchases.find(item => item.id === group.compraId);
                return (
                  <tr key={group.id} className="border-t border-white/5">
                    <td className="px-5 py-4 font-bold text-white">{group.nomeBicho}</td>
                    <td className="px-5 py-4 font-mono text-slate-300">{group.numeros.join(", ")}</td>
                    <td className="px-5 py-4">
                      <span className={cn("rounded-full border px-3 py-1 text-[10px] font-mono uppercase", group.status === "available" ? "border-emerald-400/30 text-emerald-200" : group.status === "reserved" ? "border-amber-400/30 text-amber-200" : "border-slate-400/30 text-slate-300")}>
                        {group.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{purchase?.customer?.name || "-"}</td>
                    <td className="px-5 py-4 text-right font-mono text-white">R$ {group.preco.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><Trophy className="h-5 w-5 text-amber-300" /> Ganhadores</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {state.winners.length === 0 ? <p className="text-slate-500">Nenhum resultado lançado.</p> : state.winners.map(winner => (
            <div key={winner.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <p className="font-bold text-white">{winner.semGanhador ? "Sem ganhador" : winner.nomeBicho}</p>
              <p className="text-sm font-mono text-slate-400">Numero {winner.numeroSorteado} • {winner.premio}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaSettingsEditor({
  title,
  helper,
  toggleLabel,
  mediaLabel,
  value,
  onChange
}: {
  title: string;
  helper: string;
  toggleLabel: string;
  mediaLabel: string;
  value: FazendinhaMediaSlotSettings;
  onChange: (patch: Partial<FazendinhaMediaSlotSettings>) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </div>
      <div className="grid gap-4">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <input type="checkbox" checked={Boolean(value.enabled)} onChange={event => onChange({ enabled: event.target.checked })} />
          <span className="text-sm text-white">{toggleLabel}</span>
        </label>
        <Field label="Título" value={value.title || ""} onChange={next => onChange({ title: next })} />
        <label className="space-y-2">
          <span className="text-xs font-mono uppercase text-slate-500">Descrição abaixo da mídia</span>
          <textarea value={value.description || ""} onChange={event => onChange({ description: event.target.value })} className="min-h-24 w-full p-3" />
        </label>
        <MediaPicker
          label={mediaLabel}
          value={value.mediaUrl || ""}
          mediaType={value.mediaType || "image"}
          onChange={(mediaUrl, mediaType) => onChange({ mediaUrl, mediaType: mediaType as any })}
        />
        <Field label="Poster/thumbnail do vídeo" value={value.posterUrl || ""} onChange={next => onChange({ posterUrl: next })} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-mono uppercase text-slate-500">Tipo da mídia</span>
            <select value={value.mediaType || "image"} onChange={event => onChange({ mediaType: event.target.value as any })} className="w-full p-3">
              <option value="image">Imagem</option>
              <option value="gif">GIF animado</option>
              <option value="video">MP4</option>
              <option value="youtube">YouTube</option>
              <option value="vimeo">Vimeo</option>
              <option value="bunny">MediaDelivery / Bunny.net</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-mono uppercase text-slate-500">Modo de exibição</span>
            <select value={value.fitMode || "auto"} onChange={event => onChange({ fitMode: event.target.value as any })} className="w-full p-3">
              <option value="auto">Automático</option>
              <option value="contain">Mostrar inteiro</option>
              <option value="cover">Preencher/cortar</option>
            </select>
          </label>
        </div>
        <Field label="Texto alternativo/acessibilidade" value={value.altText || value.alt || ""} onChange={next => onChange({ alt: next, altText: next })} />
        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <Field label="Link clicável opcional" value={value.linkUrl || ""} onChange={next => onChange({ linkUrl: next })} />
          <label className="space-y-2">
            <span className="text-xs font-mono uppercase text-slate-500">Abrir link</span>
            <select value={value.linkTarget || "_self"} onChange={event => onChange({ linkTarget: event.target.value as any })} className="w-full p-3">
              <option value="_self">Mesma aba</option>
              <option value="_blank">Nova aba</option>
            </select>
          </label>
        </div>
        {value.mediaUrl && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <ResponsiveMediaFrame
              src={value.mediaUrl}
              type={value.mediaType}
              poster={value.posterUrl}
              preferredFit={value.fitMode || "auto"}
              aspectMode="auto"
              alt={value.altText || value.alt || value.title || title}
              className="max-h-[420px] rounded-none"
            />
            {(value.title || value.description) && (
              <div className="bg-slate-950 p-4">
                {value.title && <p className="font-bold text-white">{value.title}</p>}
                {value.description && <p className="mt-1 text-sm text-slate-400">{value.description}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PremiumExperienceEditor({ value, onChange }: { value: FazendinhaPremiumExperienceSettings; onChange: (patch: Partial<FazendinhaPremiumExperienceSettings>) => void }) {
  return (
    <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold text-white">Informações premium da Home</h3>
        <p className="mt-1 text-xs text-slate-500">Controla textos, caixinha, extração, prêmio, valor da cota e CTA final.</p>
      </div>
      <div className="grid gap-4">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <input type="checkbox" checked={value.premiumInfoEnabled} onChange={event => onChange({ premiumInfoEnabled: event.target.checked })} />
          <span className="text-sm text-white">Ativar bloco premium</span>
        </label>
        <Field label="Título da seção" value={value.premiumTitle || ""} onChange={next => onChange({ premiumTitle: next })} />
        <Field label="Descrição curta" value={value.premiumDescription || ""} onChange={next => onChange({ premiumDescription: next })} />
        <Field label="Texto de destaque" value={value.premiumHighlight || ""} onChange={next => onChange({ premiumHighlight: next })} />
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <input type="checkbox" checked={value.caixinhaHighlightEnabled} onChange={event => onChange({ caixinhaHighlightEnabled: event.target.checked })} />
          <span className="text-sm text-white">Ativar destaque da caixinha</span>
        </label>
        <div className="grid gap-4 md:grid-cols-[96px_1fr]">
          <Field label="Ícone/emoji" value={value.caixinhaIcon || ""} onChange={next => onChange({ caixinhaIcon: next })} />
          <Field label="Título da caixinha" value={value.caixinhaTitle || ""} onChange={next => onChange({ caixinhaTitle: next })} />
        </div>
        <Field label="Descrição da caixinha" value={value.caixinhaDescription || ""} onChange={next => onChange({ caixinhaDescription: next })} />
        <Field label="Valor/prêmio da caixinha" value={value.caixinhaPrizeValue || ""} onChange={next => onChange({ caixinhaPrizeValue: next })} />
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <input type="checkbox" checked={value.extractionEnabled} onChange={event => onChange({ extractionEnabled: event.target.checked })} />
          <span className="text-sm text-white">Exibir horário da extração</span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Texto da extração" value={value.extractionText || ""} onChange={next => onChange({ extractionText: next })} />
          <Field label="Horário da extração" value={value.extractionTime || ""} onChange={next => onChange({ extractionTime: next })} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Texto do prêmio" value={value.prizeLabel || ""} onChange={next => onChange({ prizeLabel: next })} />
          <Field label="Valor do prêmio principal" value={value.prizeValue || ""} onChange={next => onChange({ prizeValue: next })} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Texto auxiliar do valor" value={value.ticketPriceLabel || ""} onChange={next => onChange({ ticketPriceLabel: next })} />
          <Field label="Valor da cota por bichinho" value={value.ticketPriceValue || ""} onChange={next => onChange({ ticketPriceValue: next })} />
        </div>
        <Field label="Texto do botão participar" value={value.ctaLabel || ""} onChange={next => onChange({ ctaLabel: next })} />
        <Field label="Subtítulo do CTA" value={value.ctaSubtitle || ""} onChange={next => onChange({ ctaSubtitle: next })} />
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-mono uppercase text-slate-500">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-3" />
    </label>
  );
}
