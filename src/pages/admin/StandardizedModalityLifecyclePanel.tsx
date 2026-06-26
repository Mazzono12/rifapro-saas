import type { StandardizedModalityLifecycle, StandardizedPrizeConfig, StandardizedWinnerRecord, StandardizedSponsorWinnerRecord, StandardizedClosureRecord, TopSellerRewardConfig } from "../../types";
import { MediaPicker } from "../../components/admin/MediaPicker";

type RankingKind = "buyer" | "seller";

type Props = {
  title?: string;
  section?: "all" | "prizes" | "rankings" | "winners" | "closure" | "history";
  value?: StandardizedModalityLifecycle;
  onChange: (value: StandardizedModalityLifecycle) => void;
  topBuyerEnabled?: boolean;
  topSellerEnabled?: boolean;
  topBuyerRewards?: TopSellerRewardConfig[];
  topSellerRewards?: TopSellerRewardConfig[];
  onRankingToggle: (kind: RankingKind, enabled: boolean) => void;
  onRankingRewardsChange: (kind: RankingKind, rewards: TopSellerRewardConfig[]) => void;
  historyRows?: StandardizedModalityLifecycle["history"];
};

const emptyPrize: StandardizedPrizeConfig = { enabled: false, name: "", description: "", imageUrl: "", estimatedValue: 0, status: "planejado" };
const emptyWinner: StandardizedWinnerRecord = { name: "", phone: "", city: "", state: "", prizeReceived: "", date: "", deliveryStatus: "pendente", notes: "", photos: [], receipts: [] };
const emptySponsorWinner: StandardizedSponsorWinnerRecord = { ...emptyWinner, affiliateName: "", referredCustomer: "" };
const emptyClosure: StandardizedClosureRecord = { closedAt: "", reason: "", notes: "", photos: [], receipts: [], status: "aberto" };

export function defaultStandardizedLifecycle(source?: Partial<StandardizedModalityLifecycle>): StandardizedModalityLifecycle {
  return {
    mainPrize: { ...emptyPrize, enabled: true, ...(source?.mainPrize || {}) },
    sponsorPrize: { ...emptyPrize, ...(source?.sponsorPrize || {}) },
    mainWinner: { ...emptyWinner, ...(source?.mainWinner || {}) },
    sponsorWinner: { ...emptySponsorWinner, ...(source?.sponsorWinner || {}) },
    closure: { ...emptyClosure, ...(source?.closure || {}) },
    history: Array.isArray(source?.history) ? source.history : []
  };
}

export function normalizeRankingRewards(rewards: TopSellerRewardConfig[] = [], count = 3) {
  const safeCount = Math.max(1, Math.min(50, Math.floor(Number(count) || 3)));
  return Array.from({ length: safeCount }, (_, index) => {
    const position = index + 1;
    const current = rewards.find(reward => Number(reward.position) === position);
    return {
      position,
      type: current?.type || "other" as const,
      label: current?.label || "",
      description: current?.description || "",
      enabled: current?.enabled !== false
    };
  });
}

export function StandardizedModalityLifecyclePanel({
  title = "Ciclo operacional padronizado",
  section = "all",
  value,
  onChange,
  topBuyerEnabled = true,
  topSellerEnabled = true,
  topBuyerRewards = [],
  topSellerRewards = [],
  onRankingToggle,
  onRankingRewardsChange,
  historyRows = []
}: Props) {
  const lifecycle = defaultStandardizedLifecycle(value);
  const update = (patch: Partial<StandardizedModalityLifecycle>) => onChange(defaultStandardizedLifecycle({ ...lifecycle, ...patch }));
  const updatePrize = (field: "mainPrize" | "sponsorPrize", patch: Partial<StandardizedPrizeConfig>) => update({ [field]: { ...lifecycle[field], ...patch } } as Partial<StandardizedModalityLifecycle>);
  const updateWinner = (field: "mainWinner" | "sponsorWinner", patch: Partial<StandardizedWinnerRecord | StandardizedSponsorWinnerRecord>) => update({ [field]: { ...lifecycle[field], ...patch } } as Partial<StandardizedModalityLifecycle>);
  const updateClosure = (patch: Partial<StandardizedClosureRecord>) => update({ closure: { ...lifecycle.closure, ...patch } });
  const showAll = section === "all";

  return (
    <section className="admin-card space-y-5 p-5 lg:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">Padronizacao 10C.1</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--admin-text)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">Campanha, premios, rankings por valor em reais, ganhadores, encerramento e historico no mesmo formato para todas as modalidades.</p>
      </div>

      {(showAll || section === "prizes") && (
        <div className="grid gap-5">
          <PrizeBlock title="Premio principal" prize={lifecycle.mainPrize} required onChange={patch => updatePrize("mainPrize", patch)} />
          <PrizeBlock title="Premio do patrocinador" prize={lifecycle.sponsorPrize} optional onChange={patch => updatePrize("sponsorPrize", patch)} />
        </div>
      )}

      {(showAll || section === "rankings") && (
        <div className="grid gap-5">
          <RankingBlock title="Ranking Top Compradores" description="Base obrigatoria: valor total pago em reais. Cotas/dezenas/bilhetes ficam apenas como contexto." enabled={topBuyerEnabled} rewards={topBuyerRewards} onToggle={enabled => onRankingToggle("buyer", enabled)} onChange={rewards => onRankingRewardsChange("buyer", rewards)} />
          <RankingBlock title="Ranking Top Vendedores" description="Base obrigatoria: valor vendido em reais por indicacao direta. Sem multinivel. Nao e sorteio separado." enabled={topSellerEnabled} rewards={topSellerRewards} onToggle={enabled => onRankingToggle("seller", enabled)} onChange={rewards => onRankingRewardsChange("seller", rewards)} />
        </div>
      )}

      {(showAll || section === "winners") && (
        <div className="grid gap-5">
          <WinnerBlock title="Ganhador principal" winner={lifecycle.mainWinner} onChange={patch => updateWinner("mainWinner", patch)} />
          <WinnerBlock title="Ganhador patrocinador" sponsor winner={lifecycle.sponsorWinner} disabled={!lifecycle.sponsorPrize.enabled} onChange={patch => updateWinner("sponsorWinner", patch)} />
        </div>
      )}

      {(showAll || section === "closure") && <ClosureBlock closure={lifecycle.closure} onChange={updateClosure} />}
      {(showAll || section === "history") && <HistoryBlock rows={historyRows.length ? historyRows : lifecycle.history} />}
    </section>
  );
}

function PrizeBlock({ title, prize, required = false, optional = false, onChange }: { title: string; prize: StandardizedPrizeConfig; required?: boolean; optional?: boolean; onChange: (patch: Partial<StandardizedPrizeConfig>) => void }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--admin-text)]">{title}</h3>
        {optional ? <label className="flex items-center gap-2 text-sm text-[var(--admin-muted)]"><input type="checkbox" checked={Boolean(prize.enabled)} onChange={event => onChange({ enabled: event.target.checked })} /> Ativar premio para o indicador</label> : <span className="text-xs text-[var(--admin-muted)]">{required ? "Obrigatorio" : "Opcional"}</span>}
      </div>
      <div className="mt-4 grid gap-3">
        <Field label="Nome do premio" value={prize.name} onChange={name => onChange({ name })} />
        <Field label="Valor estimado" type="number" value={String(prize.estimatedValue || "")} onChange={estimatedValue => onChange({ estimatedValue: Number(estimatedValue) || 0 })} />
        <Field label="Status" value={prize.status} onChange={status => onChange({ status })} />
        <Field label="Descricao" value={prize.description} onChange={description => onChange({ description })} />
        <div className="">
          <MediaPicker label="Imagem do premio" value={prize.imageUrl || ""} onChange={imageUrl => onChange({ imageUrl })} />
        </div>
      </div>
    </div>
  );
}

function RankingBlock({ title, description, enabled, rewards, onToggle, onChange }: { title: string; description: string; enabled: boolean; rewards: TopSellerRewardConfig[]; onToggle: (enabled: boolean) => void; onChange: (rewards: TopSellerRewardConfig[]) => void }) {
  const normalized = normalizeRankingRewards(rewards, Math.max(3, rewards.length || 3));
  const updateReward = (position: number, patch: Partial<TopSellerRewardConfig>) => onChange(normalized.map(reward => reward.position === position ? { ...reward, ...patch } : reward));
  const setCount = (count: number) => onChange(normalizeRankingRewards(normalized, count));
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--admin-text)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--admin-muted)]"><input type="checkbox" checked={enabled} onChange={event => onToggle(event.target.checked)} /> Ativar ranking</label>
      </div>
      <div className="mt-4 max-w-xs">
        <Field label="Quantidade de posicoes" type="number" value={String(normalized.length)} onChange={value => setCount(Number(value) || 3)} />
      </div>
      <div className="mt-4 space-y-3">
        {normalized.map(reward => (
          <div key={reward.position} className="grid gap-3 rounded-md border border-[var(--admin-border)] p-3">
            <span className="text-sm font-semibold text-[var(--admin-text)]">{reward.position}o lugar</span>
            <Field label="Premio por posicao" value={reward.label} onChange={label => updateReward(reward.position, { label, enabled: true })} />
            <Field label="Descricao" value={reward.description || ""} onChange={description => updateReward(reward.position, { description, enabled: true })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WinnerBlock({ title, winner, sponsor = false, disabled = false, onChange }: { title: string; winner: StandardizedWinnerRecord | StandardizedSponsorWinnerRecord; sponsor?: boolean; disabled?: boolean; onChange: (patch: Partial<StandardizedWinnerRecord | StandardizedSponsorWinnerRecord>) => void }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 opacity-100">
      <h3 className="text-base font-semibold text-[var(--admin-text)]">{title}</h3>
      {disabled ? <p className="mt-2 text-sm text-[var(--admin-muted)]">Ative o premio do patrocinador para registrar este ganhador.</p> : null}
      <div className="mt-4 grid gap-3">
        {sponsor ? <Field label="Nome do afiliado" value={(winner as StandardizedSponsorWinnerRecord).affiliateName || ""} onChange={affiliateName => onChange({ affiliateName })} /> : <Field label="Nome" value={winner.name} onChange={name => onChange({ name })} />}
        <Field label="Telefone" value={winner.phone} onChange={phone => onChange({ phone })} />
        <Field label="Cidade" value={winner.city} onChange={city => onChange({ city })} />
        <Field label="Estado" value={winner.state} onChange={state => onChange({ state })} />
        {sponsor ? <Field label="Cliente indicado" value={(winner as StandardizedSponsorWinnerRecord).referredCustomer || ""} onChange={referredCustomer => onChange({ referredCustomer })} /> : null}
        <Field label="Premio recebido" value={winner.prizeReceived} onChange={prizeReceived => onChange({ prizeReceived })} />
        <Field label="Data" type="date" value={winner.date} onChange={date => onChange({ date })} />
        <Field label="Status da entrega" value={winner.deliveryStatus} onChange={deliveryStatus => onChange({ deliveryStatus })} />
        <Field label="Fotos" value={(winner.photos || []).join(", ")} onChange={photos => onChange({ photos: splitList(photos) })} />
        <Field label="Comprovantes" value={(winner.receipts || []).join(", ")} onChange={receipts => onChange({ receipts: splitList(receipts) })} />
        <div className=""><Field label="Observacoes" value={winner.notes} onChange={notes => onChange({ notes })} /></div>
      </div>
    </div>
  );
}

function ClosureBlock({ closure, onChange }: { closure: StandardizedClosureRecord; onChange: (patch: Partial<StandardizedClosureRecord>) => void }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h3 className="text-base font-semibold text-[var(--admin-text)]">Encerramento</h3>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Field label="Data de encerramento" type="datetime-local" value={closure.closedAt} onChange={closedAt => onChange({ closedAt })} />
        <Field label="Motivo" value={closure.reason} onChange={reason => onChange({ reason })} />
        <Field label="Status" value={closure.status} onChange={status => onChange({ status })} />
        <Field label="Fotos" value={(closure.photos || []).join(", ")} onChange={photos => onChange({ photos: splitList(photos) })} />
        <Field label="Comprovantes" value={(closure.receipts || []).join(", ")} onChange={receipts => onChange({ receipts: splitList(receipts) })} />
        <Field label="Observacoes" value={closure.notes} onChange={notes => onChange({ notes })} />
      </div>
    </div>
  );
}

function HistoryBlock({ rows }: { rows: StandardizedModalityLifecycle["history"] }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h3 className="text-base font-semibold text-[var(--admin-text)]">Historico padronizado</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-[var(--admin-muted)]"><tr><th className="py-2 pr-3">Campanha</th><th className="py-2 pr-3">Premio principal</th><th className="py-2 pr-3">Premio patrocinador</th><th className="py-2 pr-3">Ganhador principal</th><th className="py-2 pr-3">Ganhador patrocinador</th><th className="py-2 pr-3">Top compradores</th><th className="py-2 pr-3">Top vendedores</th><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Status</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={9} className="py-4 text-[var(--admin-muted)]">Historico sera formado pelos registros administrativos desta campanha.</td></tr> : rows.map((row, index) => <tr key={index} className="border-t border-[var(--admin-border)]"><td className="py-2 pr-3">{row.campaign}</td><td className="py-2 pr-3">{row.mainPrize}</td><td className="py-2 pr-3">{row.sponsorPrize}</td><td className="py-2 pr-3">{row.mainWinner}</td><td className="py-2 pr-3">{row.sponsorWinner}</td><td className="py-2 pr-3">{row.topBuyers}</td><td className="py-2 pr-3">{row.topAffiliates}</td><td className="py-2 pr-3">{row.date}</td><td className="py-2 pr-3">{row.status}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block space-y-2"><span className="text-xs font-semibold text-[var(--admin-muted)]">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} className="admin-input min-h-11 w-full" /></label>;
}

function splitList(value: string) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}


