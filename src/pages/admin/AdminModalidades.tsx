import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import { Download, FileJson, Save, SearchCheck } from "lucide-react";
import { toast } from "sonner";
import { modalidadesService } from "../../services/api";
import type { NumberModeConfig, NumberModeId, TopSellerRewardConfig } from "../../types";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { StandardizedModalityLifecyclePanel, normalizeRankingRewards as normalizeStandardRankingRewards } from "./StandardizedModalityLifecyclePanel";

type TabId = "geral" | "configuracao" | "sorteio" | "midias" | "premios" | "rankings" | "ganhadores" | "encerramento" | "historico";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "geral", label: "Geral" },
  { id: "configuracao", label: "Configuração" },
  { id: "sorteio", label: "Sorteio" },
  { id: "midias", label: "Mídias" },
  { id: "premios", label: "Prêmios" },
  { id: "rankings", label: "Rankings" },
  { id: "ganhadores", label: "Ganhadores" },
  { id: "encerramento", label: "Encerramento" },
  { id: "historico", label: "Histórico" }
];

export function AdminModalidades({ modeFilter }: { modeFilter?: NumberModeId } = {}) {
  const [configs, setConfigs] = useState<NumberModeConfig[]>([]);
  const [state, setState] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabId>("geral");
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

  const updateLifecycle = (id: NumberModeId, patch: Partial<NumberModeConfig>) => updateConfig(id, patch);

  const updateRanking = (id: NumberModeId, kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => {
    updateConfig(id, kind === "buyer" ? { topBuyerRewards: rewards } : { topSellerRewards: rewards });
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

  const visibleConfigs = modeFilter ? configs.filter(config => config.id === modeFilter) : configs;
  const historyPurchases = useMemo(() => (state?.purchases || []).filter((purchase: any) => !modeFilter || purchase.mode === modeFilter), [state, modeFilter]);
  const historyWinners = useMemo(() => (state?.winners || []).filter((winner: any) => !modeFilter || winner.mode === modeFilter), [state, modeFilter]);

  if (!state) return null;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--admin-text)]">{modeFilter ? modeLabel(modeFilter) : "Modalidades numéricas"}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
            {modeFilter ? "Página especializada da modalidade. Contém apenas regras, sorteio, mídias, prêmios, rankings, ganhadores, encerramento e histórico." : "Visão administrativa agregada de Dezena, Centena e Milhar."}
          </p>
        </div>
        {!modeFilter && <div className="flex flex-wrap gap-2"><button onClick={exportCSV} className="admin-button-secondary"><Download className="h-4 w-4" /> Exportar CSV</button><button onClick={exportJSON} className="admin-button-secondary"><FileJson className="h-4 w-4" /> Exportar JSON</button></div>}
      </div>

      {!modeFilter && <section className="admin-page-panel">
        <h2 className="text-base font-semibold text-[var(--admin-text)]">Resultado geral da loteria</h2>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Use para apurar todos os modelos e a Fazendinha com um único resultado.</p>
        <div className="mt-4 grid items-end gap-4">
          <Field label="Número do resultado geral" value={official.officialResult} onChange={value => setOfficial({ ...official, officialResult: value.replace(/\D/g, "") })} placeholder="Ex.: 9125" inputMode="numeric" />
          <Field label="Origem do resultado" value={official.origemResultado} onChange={value => setOfficial({ ...official, origemResultado: value })} placeholder="Ex.: Loteria Federal" />
          <button onClick={publish} className="admin-button min-h-11 justify-center px-5"><SearchCheck className="h-5 w-5" /> Apurar resultado geral</button>
        </div>
      </section>}

      <div className="space-y-5">
        {visibleConfigs.map(config => (
          <section key={config.id} className="admin-page-panel">
            <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">Modelo de jogo</p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--admin-text)]">{config.name}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ToggleField label="Modelo ativo" checked={config.enabled} onChange={checked => updateConfig(config.id, { enabled: checked })} />
                <button onClick={() => save(config)} className="admin-button min-h-11"><Save className="h-4 w-4" /> Salvar modelo</button>
              </div>
            </div>

            <div className="admin-tabs mt-4" role="tablist" aria-label={`Abas de ${config.name}`}>
              {tabs.map(tab => (
                <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`admin-tab ${activeTab === tab.id ? "is-active" : ""}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {activeTab === "geral" && <GeneralTab config={config} onChange={patch => updateConfig(config.id, patch)} />}
              {activeTab === "configuracao" && <ConfigTab config={config} onChange={patch => updateConfig(config.id, patch)} />}
              {activeTab === "sorteio" && <DrawTab config={config} result={modeResults[config.id]} onResultChange={patch => updateModeResult(config.id, patch)} onPublish={() => publishMode(config.id)} />}
              {activeTab === "midias" && <MediaPicker label="Mídia do modelo" value={config.mediaUrl} mediaType={config.mediaType} onChange={(mediaUrl, mediaType) => updateConfig(config.id, { mediaUrl, mediaType: mediaType as any })} />}
              {activeTab === "premios" && <LifecycleSection config={config} section="prizes" historyWinners={historyWinners} onChange={standardizedLifecycle => updateLifecycle(config.id, { standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(config.id, kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={(kind, rewards) => updateRanking(config.id, kind, rewards)} />}
              {activeTab === "rankings" && <LifecycleSection config={config} section="rankings" historyWinners={historyWinners} onChange={standardizedLifecycle => updateLifecycle(config.id, { standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(config.id, kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={(kind, rewards) => updateRanking(config.id, kind, rewards)} />}
              {activeTab === "ganhadores" && <LifecycleSection config={config} section="winners" historyWinners={historyWinners} onChange={standardizedLifecycle => updateLifecycle(config.id, { standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(config.id, kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={(kind, rewards) => updateRanking(config.id, kind, rewards)} />}
              {activeTab === "encerramento" && <LifecycleSection config={config} section="closure" historyWinners={historyWinners} onChange={standardizedLifecycle => updateLifecycle(config.id, { standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(config.id, kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={(kind, rewards) => updateRanking(config.id, kind, rewards)} />}
              {activeTab === "historico" && <HistoryTab config={config} purchases={historyPurchases} winners={historyWinners} onChange={standardizedLifecycle => updateLifecycle(config.id, { standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(config.id, kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={(kind, rewards) => updateRanking(config.id, kind, rewards)} />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function GeneralTab({ config, onChange }: { config: NumberModeConfig; onChange: (patch: Partial<NumberModeConfig>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-muted)]">Dados principais da modalidade numérica.</p>
      <div className="grid gap-4">
        <Field label="Nome do modelo" value={config.name} onChange={value => onChange({ name: value })} placeholder="Nome exibido ao cliente" />
        <Field label="Descrição" value={config.description} onChange={value => onChange({ description: value })} placeholder="Descrição do modelo de jogo" multiline />
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-[var(--admin-muted)]">Status do modelo</span>
          <select value={config.status} onChange={event => onChange({ status: event.target.value as any })} className="admin-input min-h-11 w-full">
            <option value="active">Ativo</option>
            <option value="paused">Pausado</option>
            <option value="closed">Encerrado</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function ConfigTab({ config, onChange }: { config: NumberModeConfig; onChange: (patch: Partial<NumberModeConfig>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-muted)]">Configurações próprias da modalidade numérica.</p>
      <div className="grid gap-4">
        <Field label="Preço por cota" type="number" value={String(config.price)} onChange={value => onChange({ price: Number(value) })} placeholder="0,00" />
        <Field label="Prêmio principal" value={config.prize} onChange={value => onChange({ prize: value })} placeholder="Prêmio principal" />
        <Field label="Data do sorteio" value={config.drawDate} onChange={value => onChange({ drawDate: value })} placeholder="Data ou descrição" />
        <Field label="Reserva pendente (min)" type="number" value={String(config.reservationMinutes || "")} onChange={value => onChange({ reservationMinutes: value ? Math.max(1, Number(value)) : undefined })} placeholder="Padrão global: 5" />
      </div>
    </div>
  );
}

function DrawTab({ config, result, onResultChange, onPublish }: { config: NumberModeConfig; result: { resultNumber: string; origemResultado: string }; onResultChange: (patch: Partial<{ resultNumber: string; origemResultado: string }>) => void; onPublish: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3 text-sm text-[var(--admin-muted)]">Resultado atual: {config.resultNumber || "sem resultado"}</div>
      <div className="grid gap-4">
        <Field label="Número sorteado" value={result?.resultNumber || ""} onChange={value => onResultChange({ resultNumber: value.replace(/\D/g, "").slice(-config.digits) })} placeholder={`Ex.: ${"0".repeat(config.digits)}`} inputMode="numeric" />
        <Field label="Origem do resultado" value={result?.origemResultado || ""} onChange={origemResultado => onResultChange({ origemResultado })} placeholder="Ex.: Loteria Federal" />
      </div>
      <button onClick={onPublish} className="admin-button min-h-11 justify-center"><SearchCheck className="h-5 w-5" /> Apurar {config.name}</button>
    </div>
  );
}

function LifecycleSection({ config, section, historyWinners, onChange, onRankingToggle, onRankingRewardsChange }: { config: NumberModeConfig; section: "prizes" | "rankings" | "winners" | "closure"; historyWinners: any[]; onChange: (standardizedLifecycle: any) => void; onRankingToggle: (kind: "buyer" | "seller", enabled: boolean) => void; onRankingRewardsChange: (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => void }) {
  return (
    <StandardizedModalityLifecyclePanel
      title={`Padronização numérica - ${config.name}`}
      section={section}
      value={config.standardizedLifecycle}
      onChange={onChange}
      topBuyerEnabled={config.topBuyerRankingEnabled !== false}
      topSellerEnabled={config.topSellerRankingEnabled !== false}
      topBuyerRewards={normalizeStandardRankingRewards(config.topBuyerRewards)}
      topSellerRewards={normalizeStandardRankingRewards(config.topSellerRewards)}
      onRankingToggle={onRankingToggle}
      onRankingRewardsChange={onRankingRewardsChange}
      historyRows={[historyRow(config, historyWinners)]}
    />
  );
}

function HistoryTab({ config, purchases, winners, onChange, onRankingToggle, onRankingRewardsChange }: { config: NumberModeConfig; purchases: any[]; winners: any[]; onChange: (standardizedLifecycle: any) => void; onRankingToggle: (kind: "buyer" | "seller", enabled: boolean) => void; onRankingRewardsChange: (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => void }) {
  return (
    <div className="space-y-4">
      <StandardizedModalityLifecyclePanel
        title={`Histórico - ${config.name}`}
        section="history"
        value={config.standardizedLifecycle}
        onChange={onChange}
        topBuyerEnabled={config.topBuyerRankingEnabled !== false}
        topSellerEnabled={config.topSellerRankingEnabled !== false}
        topBuyerRewards={normalizeStandardRankingRewards(config.topBuyerRewards)}
        topSellerRewards={normalizeStandardRankingRewards(config.topSellerRewards)}
        onRankingToggle={onRankingToggle}
        onRankingRewardsChange={onRankingRewardsChange}
        historyRows={[historyRow(config, winners)]}
      />
      <Panel title="Compras da modalidade" items={purchases.filter((purchase: any) => purchase.mode === config.id).slice(0, 12).map((purchase: any) => `${modeLabel(purchase.mode as NumberModeId)} • ${purchase.customer?.name || "Cliente"} • ${purchase.numbers?.join(" ") || "sem número"}`)} />
      <Panel title="Ganhadores da modalidade" items={winners.filter((winner: any) => winner.mode === config.id).slice(0, 12).map((winner: any) => `${modeLabel(winner.mode as NumberModeId)} • ${winner.number} • ${winner.semGanhador ? "sem ganhador" : winner.customer?.name || "Cliente"} • ${winner.origemResultado || "origem não informada"}`)} />
    </div>
  );
}

function historyRow(config: NumberModeConfig, historyWinners: any[]) {
  return {
    campaign: config.name,
    mainPrize: config.standardizedLifecycle?.mainPrize?.name || config.prize || "Prêmio principal",
    sponsorPrize: config.standardizedLifecycle?.sponsorPrize?.enabled ? config.standardizedLifecycle.sponsorPrize.name : "Opcional",
    mainWinner: historyWinners.find((winner: any) => winner.mode === config.id && !winner.semGanhador)?.customer?.name || "Pendente",
    sponsorWinner: config.standardizedLifecycle?.sponsorWinner?.affiliateName || "Pendente",
    topBuyers: config.topBuyerRankingEnabled === false ? "Inativo" : "Valor comprado em R$",
    topAffiliates: config.topSellerRankingEnabled === false ? "Inativo" : "Valor vendido em R$ por indicação direta",
    date: config.drawDate || "Não informado",
    status: config.status
  };
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
        <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="admin-input min-h-24 w-full resize-y" />
      ) : (
        <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="admin-input min-h-11 w-full" />
      )}
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-medium text-[var(--admin-text)]">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h3 className="text-base font-semibold text-[var(--admin-text)]">{title}</h3>
      <div className="mt-3 divide-y divide-[var(--admin-border)]">
        {items.length === 0 ? <p className="py-3 text-sm text-[var(--admin-muted)]">Nenhum registro.</p> : items.map((item, index) => (
          <p key={index} className="py-3 text-sm text-[var(--admin-text)]">{item}</p>
        ))}
      </div>
    </div>
  );
}

