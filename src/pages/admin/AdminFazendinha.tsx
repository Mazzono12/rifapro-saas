import { useEffect, useState } from "react";
import { RotateCcw, Save, SearchCheck, Sprout, Trophy } from "lucide-react";
import { toast } from "sonner";
import { fazendinhaService } from "../../services/api";
import type { FazendinhaState } from "../../types";
import { cn } from "../../lib/utils";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { LootboxRulesEditor, normalizeLootboxConfig, RewardExperienceSelector } from "../../components/admin/LootboxRulesEditor";
import { ResponsiveMediaFrame } from "../../components/ResponsiveMediaFrame";
import type { FazendinhaHomeMediaSettings } from "../../types";

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
      if (state.homeMedia) await fazendinhaService.updateHomeMedia(state.homeMedia);
      toast.success("Configurações da Fazendinha salvas");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    }
  };

  const patchHomeMedia = (patch: Partial<FazendinhaHomeMediaSettings>) => {
    if (!state) return;
    setState({
      ...state,
      homeMedia: {
        enabled: false,
        mediaUrl: "",
        mediaType: "image",
        title: "A Fazendinha",
        description: "",
        fitMode: "auto",
        alt: "Mídia da Fazendinha",
        position: "above-fazendinha",
        ...(state.homeMedia || {}),
        ...patch
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
          <h2 className="mb-5 font-display text-xl font-bold">Banner acima da seleção de bichos</h2>
          <div className="grid gap-4">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <input type="checkbox" checked={Boolean(state.homeMedia?.enabled)} onChange={e => patchHomeMedia({ enabled: e.target.checked })} />
              <span className="text-sm text-white">Exibir banner acima dos bichos para escolher/desfazer</span>
            </label>
            <Field label="Título da mídia" value={state.homeMedia?.title || ""} onChange={value => patchHomeMedia({ title: value })} />
            <label className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-500">Descrição abaixo da mídia</span>
              <textarea value={state.homeMedia?.description || ""} onChange={e => patchHomeMedia({ description: e.target.value })} className="min-h-24 w-full p-3" />
            </label>
            <MediaPicker
              label="Imagem, GIF ou vídeo da Home"
              value={state.homeMedia?.mediaUrl || ""}
              mediaType={state.homeMedia?.mediaType || "image"}
              onChange={(mediaUrl, mediaType) => patchHomeMedia({ mediaUrl, mediaType: mediaType as any })}
            />
            <Field label="Poster/thumbnail do vídeo" value={state.homeMedia?.posterUrl || ""} onChange={value => patchHomeMedia({ posterUrl: value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-mono uppercase text-slate-500">Tipo da mídia</span>
                <select value={state.homeMedia?.mediaType || "image"} onChange={e => patchHomeMedia({ mediaType: e.target.value as any })} className="w-full p-3">
                  <option value="image">Imagem / GIF</option>
                  <option value="gif">GIF animado</option>
                  <option value="video">MP4</option>
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="bunny">MediaDelivery / Bunny.net</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-mono uppercase text-slate-500">Modo de exibição</span>
                <select value={state.homeMedia?.fitMode || "auto"} onChange={e => patchHomeMedia({ fitMode: e.target.value as any })} className="w-full p-3">
                  <option value="auto">Automático</option>
                  <option value="contain">Mostrar inteiro</option>
                  <option value="cover">Preencher/cortar</option>
                </select>
              </label>
            </div>
            <Field label="Texto alternativo/acessibilidade" value={state.homeMedia?.alt || ""} onChange={value => patchHomeMedia({ alt: value })} />
            <p className="text-xs text-slate-500">Posição: acima da seleção de bichos na Home pública.</p>
            {state.homeMedia?.mediaUrl && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                <ResponsiveMediaFrame
                  src={state.homeMedia.mediaUrl}
                  type={state.homeMedia.mediaType}
                  poster={state.homeMedia.posterUrl}
                  preferredFit={state.homeMedia.fitMode || "auto"}
                  aspectMode="auto"
                  alt={state.homeMedia.alt || state.homeMedia.title || "Mídia da Fazendinha"}
                  className="max-h-[420px] rounded-none"
                />
                {(state.homeMedia.title || state.homeMedia.description) && (
                  <div className="bg-slate-950 p-4">
                    {state.homeMedia.title && <p className="font-bold text-white">{state.homeMedia.title}</p>}
                    {state.homeMedia.description && <p className="mt-1 text-sm text-slate-400">{state.homeMedia.description}</p>}
                  </div>
                )}
              </div>
            )}
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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-mono uppercase text-slate-500">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-3" />
    </label>
  );
}
