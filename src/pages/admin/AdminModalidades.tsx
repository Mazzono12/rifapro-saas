import { useEffect, useState, type InputHTMLAttributes } from "react";
import { Download, FileJson, Save, SearchCheck } from "lucide-react";
import { toast } from "sonner";
import { modalidadesService } from "../../services/api";
import type { NumberModeConfig, NumberModeId } from "../../types";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { LootboxRulesEditor, RewardExperienceSelector } from "../../components/admin/LootboxRulesEditor";

export function AdminModalidades() {
  const [configs, setConfigs] = useState<NumberModeConfig[]>([]);
  const [state, setState] = useState<any>(null);
  const [official, setOfficial] = useState({ officialResult: "", origemResultado: "Loteria" });
  const [modeResults, setModeResults] = useState<Record<NumberModeId, { resultNumber: string; origemResultado: string }>>({
    dezena: { resultNumber: "", origemResultado: "Loteria" },
    centena: { resultNumber: "", origemResultado: "Loteria" },
    milhar: { resultNumber: "", origemResultado: "Loteria" }
  });

  const load = () => {
    modalidadesService.getAdminState().then(data => {
      setState(data);
      setConfigs(data.configs);
      setModeResults(current => ({
        dezena: { resultNumber: current.dezena.resultNumber || data.configs.find((config: NumberModeConfig) => config.id === "dezena")?.resultNumber || "", origemResultado: current.dezena.origemResultado || "Loteria" },
        centena: { resultNumber: current.centena.resultNumber || data.configs.find((config: NumberModeConfig) => config.id === "centena")?.resultNumber || "", origemResultado: current.centena.origemResultado || "Loteria" },
        milhar: { resultNumber: current.milhar.resultNumber || data.configs.find((config: NumberModeConfig) => config.id === "milhar")?.resultNumber || "", origemResultado: current.milhar.origemResultado || "Loteria" }
      }));
    }).catch(error => toast.error(error.message));
  };

  useEffect(() => {
    load();
  }, []);

  const updateConfig = (id: NumberModeId, patch: Partial<NumberModeConfig>) => {
    setConfigs(current => current.map(config => config.id === id ? { ...config, ...patch } : config));
  };

  const save = async (config: NumberModeConfig) => {
    try {
      await modalidadesService.updateNumberMode(config.id, config);
      toast.success(`Modelo ${config.name} salvo`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    }
  };

  const publish = async () => {
    try {
      await modalidadesService.publishOfficialResult(official.officialResult, official.origemResultado);
      toast.success("Resultado oficial apurado para Dezena, Centena, Milhar e Fazendinha");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao apurar");
    }
  };

  const publishMode = async (mode: NumberModeId) => {
    try {
      const payload = modeResults[mode];
      await modalidadesService.publishModeResult(mode, payload.resultNumber, payload.origemResultado);
      toast.success(`Resultado de ${modeLabel(mode)} apurado`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao apurar modelo de jogo");
    }
  };

  const updateModeResult = (mode: NumberModeId, patch: Partial<{ resultNumber: string; origemResultado: string }>) => {
    setModeResults(current => ({ ...current, [mode]: { ...current[mode], ...patch } }));
  };

  const exportJSON = () => {
    const a = document.createElement("a");
    a.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state || {}, null, 2))}`;
    a.download = "modelos-de-jogos.json";
    a.click();
  };

  const exportCSV = () => {
    const rows = [["modelo_de_jogo", "compras", "ganhadores"], ...configs.map(config => [
      config.name,
      String((state?.purchases || []).filter((p: any) => p.mode === config.id).length),
      String((state?.winners || []).filter((w: any) => w.mode === config.id).length)
    ])];
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map(row => row.join(",")).join("\n"))}`;
    a.download = "modelos-de-jogos.csv";
    a.click();
  };

  if (!state) return null;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl text-sm text-[var(--admin-muted)]">Configure Dezena, Centena e Milhar, incluindo mídia, valores, resultados, caixinha ou roleta premiada.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCSV} className="admin-button-secondary"><Download className="h-4 w-4" /> Exportar CSV</button>
          <button onClick={exportJSON} className="admin-button-secondary"><FileJson className="h-4 w-4" /> Exportar JSON</button>
        </div>
      </div>

      <section className="admin-card p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Resultado geral da loteria</h2>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Use para apurar todos os modelos e a Fazendinha com um único resultado. Para datas diferentes, apure o modelo individualmente.</p>
        <div className="mt-5 grid items-end gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]">
          <Field label="Número do resultado geral" value={official.officialResult} onChange={value => setOfficial({ ...official, officialResult: value.replace(/\D/g, "") })} placeholder="Ex.: 9125" inputMode="numeric" />
          <Field label="Origem do resultado" value={official.origemResultado} onChange={value => setOfficial({ ...official, origemResultado: value })} placeholder="Ex.: Loteria Federal" />
          <button onClick={publish} className="admin-button min-h-12 justify-center px-5"><SearchCheck className="h-5 w-5" /> Apurar resultado geral</button>
        </div>
      </section>

      <div className="space-y-5">
        {configs.map(config => (
          <section key={config.id} className="admin-card overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">Modelo de jogo</p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--admin-text)]">{config.name}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ToggleField label="Modelo ativo" checked={config.enabled} onChange={checked => updateConfig(config.id, { enabled: checked })} />
                <button onClick={() => save(config)} className="admin-button min-h-12"><Save className="h-4 w-4" /> Salvar modelo</button>
              </div>
            </div>

            <div className="grid gap-6 p-5 lg:p-6 xl:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-[var(--admin-text)]">Configuração do modelo</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Nome do modelo" value={config.name} onChange={value => updateConfig(config.id, { name: value })} placeholder="Nome exibido ao cliente" />
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Descrição" value={config.description} onChange={value => updateConfig(config.id, { description: value })} placeholder="Descrição do modelo de jogo" multiline />
                    </div>
                    <Field label="Preço por cota" type="number" value={String(config.price)} onChange={value => updateConfig(config.id, { price: Number(value) })} placeholder="0,00" />
                    <Field label="Prêmio" value={config.prize} onChange={value => updateConfig(config.id, { prize: value })} placeholder="Prêmio principal" />
                    <Field label="Data do sorteio" value={config.drawDate} onChange={value => updateConfig(config.id, { drawDate: value })} placeholder="Data ou descricao" />
                    <Field label="Reserva pendente (min)" type="number" value={String(config.reservationMinutes || "")} onChange={value => updateConfig(config.id, { reservationMinutes: value ? Math.max(1, Number(value)) : undefined })} placeholder="Padrao global: 5" />
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-[var(--admin-muted)]">Status do modelo</span>
                      <select value={config.status} onChange={e => updateConfig(config.id, { status: e.target.value as any })} className="admin-input min-h-12 w-full">
                        <option value="active">Ativo</option>
                        <option value="paused">Pausado</option>
                        <option value="closed">Encerrado</option>
                      </select>
                    </label>
                  </div>
                </div>
                <MediaPicker
                  label="Mídia do modelo"
                  value={config.mediaUrl}
                  mediaType={config.mediaType}
                  onChange={(mediaUrl, mediaType) => updateConfig(config.id, { mediaUrl, mediaType: mediaType as any })}
                />
              </div>

              <div className="space-y-5">
                <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--admin-text)]">Resultado individual</h3>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">Apure somente {config.name} quando a data do sorteio for diferente.</p>
                    </div>
                    <span className="shrink-0 rounded-md border border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
                      Atual: {config.resultNumber || "sem resultado"}
                    </span>
                  </div>
                  <div className="mt-4 grid items-end gap-4 sm:grid-cols-2">
                    <Field
                      label="Número sorteado"
                      value={modeResults[config.id]?.resultNumber || ""}
                      onChange={value => updateModeResult(config.id, { resultNumber: value.replace(/\D/g, "").slice(-config.digits) })}
                      placeholder={`Ex.: ${"0".repeat(config.digits)}`}
                      inputMode="numeric"
                    />
                    <Field
                      label="Origem do resultado"
                      value={modeResults[config.id]?.origemResultado || ""}
                      onChange={value => updateModeResult(config.id, { origemResultado: value })}
                      placeholder="Ex.: Loteria Federal"
                    />
                  </div>
                  <button onClick={() => publishMode(config.id)} className="admin-button mt-4 min-h-12 w-full justify-center">
                    <SearchCheck className="h-5 w-5" /> Apurar {config.name}
                  </button>
                </div>

                <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                  <RewardExperienceSelector
                    enabled={config.lootboxEnabled}
                    value={config.lootboxConfig}
                    onChange={(lootboxEnabled, lootboxConfig) => updateConfig(config.id, { lootboxEnabled, lootboxConfig })}
                  />
                  <div className="mt-4">
                    <LootboxRulesEditor
                      title={`Regras da premiação - ${config.name}`}
                      value={config.lootboxConfig}
                      onChange={lootboxConfig => updateConfig(config.id, { lootboxConfig })}
                      showExperienceSelector={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="admin-card overflow-hidden">
        <div className="border-b border-[var(--admin-border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Compras e ganhadores por modelo</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Panel title="Compras" items={(state.purchases || []).slice(0, 12).map((p: any) => `${modeLabel(p.mode as NumberModeId)} • ${p.customer?.name} • ${p.numbers?.join(" ")}`)} />
          <Panel title="Ganhadores" items={(state.winners || []).slice(0, 12).map((w: any) => `${modeLabel(w.mode as NumberModeId)} • ${w.number} • ${w.semGanhador ? "sem ganhador" : w.customer?.name} • ${w.origemResultado || "origem não informada"}`)} />
        </div>
      </section>
    </div>
  );
}

function modeLabel(mode: NumberModeId) {
  const labels: Record<NumberModeId, string> = {
    dezena: "Dezena",
    centena: "Centena",
    milhar: "Milhar"
  };
  return labels[mode];
}

function Field({ label, value, onChange, type = "text", placeholder, inputMode, multiline = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"]; multiline?: boolean }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold text-[var(--admin-muted)]">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="admin-input min-h-24 w-full resize-y" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} className="admin-input min-h-12 w-full" />
      )}
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-text)]">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h3 className="text-base font-semibold text-[var(--admin-text)]">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-sm text-[var(--admin-muted)]">Nenhum registro.</p> : items.map((item, index) => (
          <p key={index} className="rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-text)]">{item}</p>
        ))}
      </div>
    </div>
  );
}
