import { useEffect, useState, type InputHTMLAttributes } from "react";
import { RotateCcw, Save, SearchCheck } from "lucide-react";
import { toast } from "sonner";
import { fazendinhaService } from "../../services/api";
import type { FazendinhaState, TopSellerRewardConfig } from "../../types";
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

export function AdminFazendinha() {
  const [state, setState] = useState<FazendinhaState | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("geral");
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
      toast.success("Configurações da Fazendinha salvas");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    }
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

  const updateConfig = (patch: Partial<FazendinhaState["config"]>) => {
    if (!state) return;
    setState({ ...state, config: { ...state.config, ...patch } });
  };

  const updateRanking = (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => {
    updateConfig(kind === "buyer" ? { topBuyerRewards: rewards } : { topSellerRewards: rewards });
  };

  if (!state) return null;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">Modalidade</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">Fazendinha</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">
            Gestão da modalidade com regras, grupos, sorteio, mídias, prêmios, rankings, ganhadores, encerramento e histórico.
          </p>
        </div>
        <button onClick={saveConfig} className="admin-button min-h-11 px-4">
          <Save className="h-4 w-4" /> Salvar
        </button>
      </div>

      <section className="admin-page-panel">
        <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">Modelo de jogo</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--admin-text)]">{state.config.name}</h2>
          </div>
          <ToggleField label="Modalidade ativa" checked={state.config.enabled} onChange={checked => updateConfig({ enabled: checked })} />
        </div>

        <div className="admin-tabs mt-4" role="tablist" aria-label="Abas da Fazendinha">
          {tabs.map(tab => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`admin-tab ${activeTab === tab.id ? "is-active" : ""}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {activeTab === "geral" && <GeneralTab state={state} onChange={updateConfig} />}
          {activeTab === "configuracao" && <ConfigTab state={state} onChange={updateConfig} />}
          {activeTab === "sorteio" && <DrawTab state={state} result={result} onResultChange={setResult} onPublish={publishResult} onReset={resetRound} />}
          {activeTab === "midias" && <MediaPicker label="Mídia da Fazendinha" value={state.config.mediaUrl || ""} mediaType={state.config.mediaType} onChange={(mediaUrl, mediaType) => updateConfig({ mediaUrl, mediaType: mediaType as any })} />}
          {activeTab === "premios" && <LifecycleSection state={state} section="prizes" onChange={standardizedLifecycle => updateConfig({ standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={updateRanking} />}
          {activeTab === "rankings" && <LifecycleSection state={state} section="rankings" onChange={standardizedLifecycle => updateConfig({ standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={updateRanking} />}
          {activeTab === "ganhadores" && <WinnersTab state={state} onChange={standardizedLifecycle => updateConfig({ standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={updateRanking} />}
          {activeTab === "encerramento" && <LifecycleSection state={state} section="closure" onChange={standardizedLifecycle => updateConfig({ standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={updateRanking} />}
          {activeTab === "historico" && <HistoryTab state={state} onChange={standardizedLifecycle => updateConfig({ standardizedLifecycle })} onRankingToggle={(kind, enabled) => updateConfig(kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })} onRankingRewardsChange={updateRanking} />}
        </div>
      </section>
    </div>
  );
}

function GeneralTab({ state, onChange }: { state: FazendinhaState; onChange: (patch: Partial<FazendinhaState["config"]>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-muted)]">Dados principais da modalidade.</p>
      <div className="grid gap-4">
        <Field label="Nome" value={state.config.name} onChange={name => onChange({ name })} />
        <Field label="Descrição" value={state.config.description} onChange={description => onChange({ description })} multiline />
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-[var(--admin-muted)]">Status da rodada</span>
          <select value={state.config.status} onChange={event => onChange({ status: event.target.value as any })} className="admin-input min-h-11 w-full">
            <option value="active">Ativa</option>
            <option value="paused">Pausada</option>
            <option value="closed">Encerrada</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function ConfigTab({ state, onChange }: { state: FazendinhaState; onChange: (patch: Partial<FazendinhaState["config"]>) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4">
        <Field label="Preço por bichinho" type="number" value={String(state.config.pricePerGroup)} onChange={pricePerGroup => onChange({ pricePerGroup: Number(pricePerGroup) })} />
        <Field label="Prêmio principal" value={state.config.mainPrize} onChange={mainPrize => onChange({ mainPrize })} />
        <Field label="Data/hora do sorteio" value={state.config.drawDate} onChange={drawDate => onChange({ drawDate })} />
        <Field label="Reserva pendente (min)" type="number" value={String(state.config.reservationMinutes || "")} onChange={value => onChange({ reservationMinutes: value ? Math.max(1, Number(value)) : undefined })} />
        <Field label="Sugestão de cotas adicionais" type="number" value={String(state.config.addonSuggestionTickets || 5)} onChange={addonSuggestionTickets => onChange({ addonSuggestionTickets: Number(addonSuggestionTickets) })} />
      </div>
      <Panel title="Configuração dos grupos" items={state.groups.map(group => `${group.nomeBicho} - números ${group.numeros.join(", ")} - ${group.status} - R$ ${group.preco.toFixed(2)}`)} />
    </div>
  );
}

function DrawTab({ state, result, onResultChange, onPublish, onReset }: { state: FazendinhaState; result: { numeroSorteado: string; origemResultado: string }; onResultChange: (value: { numeroSorteado: string; origemResultado: string }) => void; onPublish: () => void; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-3 text-sm text-[var(--admin-muted)]">Resultado atual: {state.config.resultNumber || "sem resultado"}</div>
      <div className="grid gap-4">
        <Field label="Número sorteado" value={result.numeroSorteado} onChange={numeroSorteado => onResultChange({ ...result, numeroSorteado })} placeholder="00 a 99" inputMode="numeric" />
        <Field label="Origem do resultado" value={result.origemResultado} onChange={origemResultado => onResultChange({ ...result, origemResultado })} placeholder="Ex.: Loteria Federal" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onPublish} className="admin-button min-h-11 justify-center"><SearchCheck className="h-5 w-5" /> Apurar resultado</button>
        <button onClick={onReset} className="admin-button-secondary min-h-11 justify-center"><RotateCcw className="h-4 w-4" /> Resetar rodada</button>
      </div>
    </div>
  );
}

function LifecycleSection({ state, section, onChange, onRankingToggle, onRankingRewardsChange }: { state: FazendinhaState; section: "prizes" | "rankings" | "winners" | "closure"; onChange: (standardizedLifecycle: any) => void; onRankingToggle: (kind: "buyer" | "seller", enabled: boolean) => void; onRankingRewardsChange: (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => void }) {
  return (
    <StandardizedModalityLifecyclePanel
      title={`Padronização Fazendinha - ${state.config.name}`}
      section={section}
      value={state.config.standardizedLifecycle}
      onChange={onChange}
      topBuyerEnabled={state.config.topBuyerRankingEnabled !== false}
      topSellerEnabled={state.config.topSellerRankingEnabled !== false}
      topBuyerRewards={normalizeStandardRankingRewards(state.config.topBuyerRewards)}
      topSellerRewards={normalizeStandardRankingRewards(state.config.topSellerRewards)}
      onRankingToggle={onRankingToggle}
      onRankingRewardsChange={onRankingRewardsChange}
      historyRows={[historyRow(state)]}
    />
  );
}

function WinnersTab({ state, onChange, onRankingToggle, onRankingRewardsChange }: { state: FazendinhaState; onChange: (standardizedLifecycle: any) => void; onRankingToggle: (kind: "buyer" | "seller", enabled: boolean) => void; onRankingRewardsChange: (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => void }) {
  return (
    <div className="space-y-4">
      <LifecycleSection state={state} section="winners" onChange={onChange} onRankingToggle={onRankingToggle} onRankingRewardsChange={onRankingRewardsChange} />
      <Panel title="Resultados lançados" items={state.winners.map(winner => `${winner.semGanhador ? "Sem ganhador" : winner.nomeBicho} - número ${winner.numeroSorteado} - ${winner.premio}`)} />
    </div>
  );
}

function HistoryTab({ state, onChange, onRankingToggle, onRankingRewardsChange }: { state: FazendinhaState; onChange: (standardizedLifecycle: any) => void; onRankingToggle: (kind: "buyer" | "seller", enabled: boolean) => void; onRankingRewardsChange: (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => void }) {
  return (
    <div className="space-y-4">
      <StandardizedModalityLifecyclePanel
        title={`Histórico Fazendinha - ${state.config.name}`}
        section="history"
        value={state.config.standardizedLifecycle}
        onChange={onChange}
        topBuyerEnabled={state.config.topBuyerRankingEnabled !== false}
        topSellerEnabled={state.config.topSellerRankingEnabled !== false}
        topBuyerRewards={normalizeStandardRankingRewards(state.config.topBuyerRewards)}
        topSellerRewards={normalizeStandardRankingRewards(state.config.topSellerRewards)}
        onRankingToggle={onRankingToggle}
        onRankingRewardsChange={onRankingRewardsChange}
        historyRows={[historyRow(state)]}
      />
      <Panel title="Compradores por bichinho" items={state.groups.map(group => {
        const purchase = state.purchases.find(item => item.id === group.compraId);
        return `${group.nomeBicho} - ${group.numeros.join(", ")} - ${group.status} - ${purchase?.customer?.name || "sem comprador"} - R$ ${group.preco.toFixed(2)}`;
      })} />
    </div>
  );
}

function historyRow(state: FazendinhaState) {
  return {
    campaign: state.config.name,
    mainPrize: state.config.standardizedLifecycle?.mainPrize?.name || state.config.mainPrize || "Prêmio principal",
    sponsorPrize: state.config.standardizedLifecycle?.sponsorPrize?.enabled ? state.config.standardizedLifecycle.sponsorPrize.name : "Opcional",
    mainWinner: state.winners.find(winner => !winner.semGanhador)?.nomeBicho || "Pendente",
    sponsorWinner: state.config.standardizedLifecycle?.sponsorWinner?.affiliateName || "Pendente",
    topBuyers: state.config.topBuyerRankingEnabled === false ? "Inativo" : "Valor comprado em R$",
    topAffiliates: state.config.topSellerRankingEnabled === false ? "Inativo" : "Valor vendido em R$ por indicação direta",
    date: state.config.drawDate || "Não informado",
    status: state.config.status
  };
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
