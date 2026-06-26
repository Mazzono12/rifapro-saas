import React, { useEffect, useState, type InputHTMLAttributes } from "react";
import { ArrowLeft, BarChart3, Check, Download, Edit2, Plus, Save, Ticket, Trash2, X } from "lucide-react";
import type { Raffle, RafflePixConfig, RankingRewardType, TopSellerRewardConfig } from "../../types";
import { inferMediaType } from "../../utils/media";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { toast } from "sonner";
import { StandardizedModalityLifecyclePanel, defaultStandardizedLifecycle, normalizeRankingRewards as normalizeStandardRankingRewards } from "./StandardizedModalityLifecyclePanel";

/* ui-contrast contract: Rifas */
/* media-slots contract: Home, página da campanha e checkout usam mídias independentes. */

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

const defaultRafflePixConfig: RafflePixConfig = {
  inheritGlobal: false,
  enabled: true,
  gateway: "asaas",
  sandbox: false,
  apiKey: "",
  webhookUrl: "/api/webhooks/asaas",
  webhookSecret: "",
  webhookEvents: "PAYMENT_RECEIVED,PAYMENT_CONFIRMED,PAYMENT_OVERDUE,PAYMENT_DELETED,PAYMENT_REFUNDED",
  releaseMode: "PAYMENT_RECEIVED",
  orderExpirationMinutes: 15
};

function normalizeRafflePixDraft(value: Partial<RafflePixConfig> = {}): RafflePixConfig {
  return {
    ...defaultRafflePixConfig,
    ...value,
    inheritGlobal: false,
    gateway: "asaas",
    sandbox: false,
    webhookUrl: "/api/webhooks/asaas",
    enabled: value.enabled !== false
  };
}

function cleanMediaUrl(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRaffleMediaDraft(raffle: Partial<Raffle>) {
  const image = cleanMediaUrl(raffle.image || (raffle as any).imageUrl || (raffle as any).bannerUrl || (raffle as any).coverImageUrl || (raffle as any).thumbnailUrl);
  const mediaUrl = cleanMediaUrl(raffle.mediaUrl || (raffle as any).videoUrl || (raffle as any).campaignMedia?.url || (raffle as any).campaignMedia);
  const checkoutMediaUrl = cleanMediaUrl(raffle.checkoutMediaUrl);
  const next: Partial<Raffle> & Record<string, any> = { ...raffle };

  if (image) {
    next.image = image;
    next.imageUrl = image;
    next.bannerUrl = image;
    next.coverImageUrl = image;
    next.thumbnailUrl = cleanMediaUrl((raffle as any).thumbnailUrl) || image;
  } else {
    delete next.image;
    delete next.imageUrl;
    delete next.bannerUrl;
    delete next.coverImageUrl;
    delete next.thumbnailUrl;
  }

  if (mediaUrl) {
    next.mediaUrl = mediaUrl;
    next.mediaType = inferMediaType(mediaUrl);
  } else {
    delete next.mediaUrl;
    delete next.mediaType;
  }

  if (checkoutMediaUrl) {
    next.checkoutMediaUrl = checkoutMediaUrl;
    next.checkoutMediaType = inferMediaType(checkoutMediaUrl);
  } else {
    delete next.checkoutMediaUrl;
    delete next.checkoutMediaType;
  }

  next.pixConfig = normalizeRafflePixDraft((raffle as any).pixConfig);
  next.topBuyerRankingEnabled = raffle.topBuyerRankingEnabled !== false;
  next.topSellerRankingEnabled = raffle.topSellerRankingEnabled !== false;
  next.topBuyerRewards = normalizeRankingRewards(raffle.topBuyerRewards);
  next.topSellerRewards = normalizeRankingRewards(raffle.topSellerRewards);

  return next;
}

function normalizeRankingRewards(rewards: TopSellerRewardConfig[] = []) {
  const positions = new Set([1, 2, 3, ...rewards.map(reward => Number(reward.position)).filter(position => Number.isFinite(position) && position > 0 && position <= 50)]);
  return [...positions].sort((left, right) => left - right).map(position => {
    const current = rewards.find(reward => Number(reward.position) === position);
    const description = current?.description || current?.label || "";
    return {
      position,
      type: current?.type || "other" as RankingRewardType,
      label: current?.label || description,
      description,
      enabled: Boolean(current?.enabled && description)
    };
  });
}

export function AdminRifasModule() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("geral");
  const [currentRaffle, setCurrentRaffle] = useState<Partial<Raffle>>({});
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [raffleAdmin, setRaffleAdmin] = useState<any | null>(null);

  const loadRaffles = () => {
    fetch("/api/admin/raffles")
      .then(res => res.json())
      .then(setRaffles);
  };

  useEffect(() => {
    loadRaffles();
  }, []);

  const openRaffleAdmin = (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    setRaffleAdmin(null);
    setIsEditing(false);
    setActiveTab("historico");
    Promise.all([
      fetch("/api/admin/raffles/" + raffle.id + "/accounting").then(res => res.json()),
      fetch("/api/raffles/" + raffle.id + "/ranking?limit=50").then(res => res.ok ? res.json() : []),
      fetch("/api/raffles/" + raffle.id + "/top-sellers?limit=50").then(res => res.ok ? res.json() : [])
    ])
      .then(([accounting, buyerRanking, sellerRanking]) => setRaffleAdmin({
        ...accounting,
        buyerRanking: Array.isArray(buyerRanking) ? buyerRanking : [],
        sellerRanking: Array.isArray(sellerRanking) ? sellerRanking : []
      }))
      .catch(() => setRaffleAdmin(null));
  };

  const startCreate = () => {
    setSelectedRaffle(null);
    setRaffleAdmin(null);
    setCurrentRaffle({
      status: "active",
      minPurchaseTickets: 1,
      topBuyerRankingEnabled: true,
      topSellerRankingEnabled: true,
      topBuyerRewards: normalizeRankingRewards(),
      topSellerRewards: normalizeRankingRewards(),
      standardizedLifecycle: defaultStandardizedLifecycle(),
      pixConfig: normalizeRafflePixDraft(),
      heroContentPlacement: "below",
      heroPrimaryButton: "Participar agora",
      heroShowStats: true,
      showHomeText: true,
      showHomePrice: true
    });
    setActiveTab("geral");
    setIsEditing(true);
  };

  const startEdit = (raffle: Raffle) => {
    setSelectedRaffle(null);
    setRaffleAdmin(null);
    setCurrentRaffle(normalizeRaffleMediaDraft(raffle));
    setActiveTab("geral");
    setIsEditing(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const method = currentRaffle.id ? "PUT" : "POST";
    const url = currentRaffle.id ? `/api/admin/raffles/${currentRaffle.id}` : "/api/admin/raffles";
    const payload = normalizeRaffleMediaDraft(currentRaffle);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar rifa");

      toast.success("Rifa salva com sucesso");
      setIsEditing(false);
      setCurrentRaffle({});
      loadRaffles();
    } catch (error) {
      toast.error("Erro ao salvar rifa", {
        description: error instanceof Error ? error.message : "Verifique sua sessão e tente novamente."
      });
    }
  };

  const updateRanking = (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => {
    const field = kind === "buyer" ? "topBuyerRewards" : "topSellerRewards";
    setCurrentRaffle({ ...currentRaffle, [field]: rewards });
  };

  const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const escape = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csvContent = [headers.map(escape).join(","), ...rows.map(row => row.map(escape).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportSelectedBuyers = () => {
    if (!selectedRaffle || !raffleAdmin) return;
    downloadCsv(
      `participantes-${selectedRaffle.id}.csv`,
      ["Nome completo", "Telefone", "Cidade", "Data da compra", "Código do sorteio", "Quantidade de cotas"],
      raffleAdmin.buyers.map((buyer: any) => [buyer.name, buyer.phone, buyer.city || "", buyer.lastPurchaseAt || "", selectedRaffle.id, buyer.tickets])
    );
  };

  const exportSelectedPayments = () => {
    if (!selectedRaffle || !raffleAdmin) return;
    downloadCsv(
      `pagamentos-${selectedRaffle.id}.csv`,
      ["Nome completo", "Telefone", "Cidade", "Data da compra", "Código do sorteio", "Quantidade de cotas"],
      raffleAdmin.purchases.map((purchase: any) => [purchase.customer?.name || "", purchase.customer?.phone || purchase.contact, purchase.customer?.city || "", purchase.createdAt, purchase.raffleId, purchase.tickets])
    );
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">Modalidade</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">Rifa Tradicional</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">Gestão compacta de rifas com configuração, sorteio, mídias, prêmios, rankings, ganhadores, encerramento e histórico.</p>
        </div>
        <button onClick={startCreate} className="admin-button min-h-11 px-4"><Plus className="h-4 w-4" /> Nova rifa</button>
      </div>

      {selectedRaffle ? (
        <SelectedRafflePanel selectedRaffle={selectedRaffle} raffleAdmin={raffleAdmin} onBack={() => { setSelectedRaffle(null); setRaffleAdmin(null); }} onEdit={() => startEdit(selectedRaffle)} onExportBuyers={exportSelectedBuyers} onExportPayments={exportSelectedPayments} />
      ) : isEditing ? (
        <form onSubmit={handleSave} className="admin-page-panel">
          <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">{currentRaffle.id ? "Editar rifa" : "Criar rifa"}</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--admin-text)]">{currentRaffle.title || "Nova rifa"}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setIsEditing(false); setCurrentRaffle({}); }} className="admin-button-secondary min-h-11"><X className="h-4 w-4" /> Cancelar</button>
              <button type="submit" className="admin-button min-h-11"><Check className="h-4 w-4" /> Salvar</button>
            </div>
          </div>

          <Tabs activeTab={activeTab} onChange={setActiveTab} />

          <div className="mt-5">
            {activeTab === "geral" && <GeneralTab raffle={currentRaffle} onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} />}
            {activeTab === "configuracao" && <ConfigTab raffle={currentRaffle} onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} />}
            {activeTab === "sorteio" && <DrawTab raffle={currentRaffle} onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} />}
            {activeTab === "midias" && <MediaTab raffle={currentRaffle} onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} />}
            {activeTab === "premios" && <LifecycleTab raffle={currentRaffle} section="prizes" onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} onRankingRewardsChange={updateRanking} />}
            {activeTab === "rankings" && <LifecycleTab raffle={currentRaffle} section="rankings" onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} onRankingRewardsChange={updateRanking} />}
            {activeTab === "ganhadores" && <LifecycleTab raffle={currentRaffle} section="winners" onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} onRankingRewardsChange={updateRanking} />}
            {activeTab === "encerramento" && <LifecycleTab raffle={currentRaffle} section="closure" onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} onRankingRewardsChange={updateRanking} />}
            {activeTab === "historico" && <LifecycleTab raffle={currentRaffle} section="history" onChange={patch => setCurrentRaffle({ ...currentRaffle, ...patch })} onRankingRewardsChange={updateRanking} />}
          </div>
        </form>
      ) : (
        <RafflesList raffles={raffles} onOpen={openRaffleAdmin} onEdit={startEdit} onDelete={async raffle => { await fetch(`/api/admin/raffles/${raffle.id}`, { method: "DELETE" }); loadRaffles(); }} />
      )}
    </div>
  );
}

function Tabs({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <div className="admin-tabs mt-4" role="tablist" aria-label="Abas da Rifa Tradicional">
      {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => onChange(tab.id)} className={`admin-tab ${activeTab === tab.id ? "is-active" : ""}`}>{tab.label}</button>)}
    </div>
  );
}

function GeneralTab({ raffle, onChange }: { raffle: Partial<Raffle>; onChange: (patch: Partial<Raffle>) => void }) {
  return <div className="grid gap-3">
    <Field label="Nome da rifa" value={raffle.title || ""} onChange={title => onChange({ title })} required />
    <Field label="Descrição" value={raffle.description || ""} onChange={description => onChange({ description })} multiline />
    <label className="block space-y-2"><span className="text-xs font-semibold text-[var(--admin-muted)]">Status</span><select className="admin-input min-h-11 w-full" value={raffle.status || "active"} onChange={event => onChange({ status: event.target.value as any })}><option value="active">Ativo</option><option value="completed">Finalizado</option></select></label>
  </div>;
}

function ConfigTab({ raffle, onChange }: { raffle: Partial<Raffle>; onChange: (patch: Partial<Raffle>) => void }) {
  return <div className="grid gap-3">
    <Field label="Preço por cota" type="number" value={String(raffle.price ?? "")} onChange={value => onChange({ price: Number(value) })} />
    <Field label="Total de cotas" type="number" value={String(raffle.totalTickets ?? "")} onChange={value => onChange({ totalTickets: Number(value) })} />
    <Field label="Compra mínima" type="number" value={String(raffle.minPurchaseTickets ?? 1)} onChange={value => onChange({ minPurchaseTickets: Math.max(1, Number(value) || 1) })} />
    <Field label="Reserva da campanha (min)" type="number" value={String(raffle.reservationMinutes || "")} onChange={value => onChange({ reservationMinutes: value ? Math.max(1, Number(value)) : undefined })} placeholder="Usar padrão global" />
    <Field label="Meta visual de progresso" type="number" value={String(raffle.conversionProgressGoal ?? "")} onChange={value => onChange({ conversionProgressGoal: value === "" ? undefined : Math.max(0, Number(value) || 0) })} />
    <Field label="Texto da meta" value={raffle.conversionProgressLabel || ""} onChange={conversionProgressLabel => onChange({ conversionProgressLabel })} placeholder="meta alcançada" />
  </div>;
}

function DrawTab({ raffle, onChange }: { raffle: Partial<Raffle>; onChange: (patch: Partial<Raffle>) => void }) {
  return <div className="grid gap-3">
    <Field label="Data do sorteio" value={raffle.drawDate || ""} onChange={drawDate => onChange({ drawDate })} placeholder="YYYY-MM-DD" />
    <label className="flex min-h-11 items-center gap-3 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]"><input type="checkbox" checked={Boolean(raffle.countdownEnabled)} onChange={event => onChange({ countdownEnabled: event.target.checked })} /> Ativar contador regressivo de vendas</label>
    <Field label="Fim das vendas" type="datetime-local" value={toDateTimeLocal(raffle.salesEndAt || raffle.countdownEndAt || "")} onChange={value => { const next = value ? new Date(value).toISOString() : ""; onChange({ salesEndAt: next, countdownEndAt: next }); }} />
    <Field label="Texto do contador" value={raffle.countdownLabel || ""} onChange={countdownLabel => onChange({ countdownLabel })} placeholder="Ex.: Encerra hoje às 20h" />
  </div>;
}

function MediaTab({ raffle, onChange }: { raffle: Partial<Raffle>; onChange: (patch: Partial<Raffle>) => void }) {
  return <div className="space-y-4">
    <MediaPicker label="Imagem da página da campanha" mediaUsage="card" value={raffle.image || ""} required onChange={image => onChange({ image })} />
    <MediaPicker label="Mídia principal da campanha" mediaUsage="hero" value={raffle.mediaUrl || ""} mediaType={raffle.mediaType} onChange={(mediaUrl, mediaType) => onChange({ mediaUrl, mediaType })} />
  </div>;
}

function LifecycleTab({ raffle, section, onChange, onRankingRewardsChange }: { raffle: Partial<Raffle>; section: "prizes" | "rankings" | "winners" | "closure" | "history"; onChange: (patch: Partial<Raffle>) => void; onRankingRewardsChange: (kind: "buyer" | "seller", rewards: TopSellerRewardConfig[]) => void }) {
  return <StandardizedModalityLifecyclePanel
    title="Padronização Rifa Tradicional"
    section={section}
    value={raffle.standardizedLifecycle}
    onChange={standardizedLifecycle => onChange({ standardizedLifecycle })}
    topBuyerEnabled={raffle.topBuyerRankingEnabled !== false}
    topSellerEnabled={raffle.topSellerRankingEnabled !== false}
    topBuyerRewards={normalizeStandardRankingRewards(raffle.topBuyerRewards)}
    topSellerRewards={normalizeStandardRankingRewards(raffle.topSellerRewards)}
    onRankingToggle={(kind, enabled) => onChange(kind === "buyer" ? { topBuyerRankingEnabled: enabled } : { topSellerRankingEnabled: enabled })}
    onRankingRewardsChange={onRankingRewardsChange}
    historyRows={[historyRow(raffle)]}
  />;
}

function RafflesList({ raffles, onOpen, onEdit, onDelete }: { raffles: Raffle[]; onOpen: (raffle: Raffle) => void; onEdit: (raffle: Raffle) => void; onDelete: (raffle: Raffle) => void }) {
  if (!raffles.length) return <div className="admin-page-panel text-center"><Ticket className="mx-auto h-8 w-8 text-[var(--admin-primary)]" /><h2 className="mt-3 text-lg font-semibold text-[var(--admin-text)]">Nenhuma rifa cadastrada.</h2><p className="mt-2 text-sm text-[var(--admin-muted)]">Use o botão Nova rifa para criar a primeira campanha.</p></div>;
  return <div className="admin-page-panel"><div className="divide-y divide-[var(--admin-border)]">{raffles.map(raffle => <article key={raffle.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><h3 className="truncate text-base font-semibold text-[var(--admin-text)]">{raffle.title}</h3><p className="mt-1 line-clamp-2 text-sm text-[var(--admin-muted)]">{raffle.description}</p><p className="mt-2 text-xs text-[var(--admin-muted)]">Preço R$ {Number(raffle.price || 0).toFixed(2)} · Progresso {((raffle.progressOverride ?? (raffle.soldTickets / raffle.totalTickets) * 100) || 0).toFixed(1)}% · Cotas {raffle.soldTickets}/{raffle.totalTickets}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onOpen(raffle)} className="admin-icon-button" title="Administração individual"><BarChart3 className="h-4 w-4" /></button><button type="button" onClick={() => onEdit(raffle)} className="admin-icon-button" title="Editar"><Edit2 className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(raffle)} className="admin-icon-button" title="Excluir"><Trash2 className="h-4 w-4" /></button></div></article>)}</div></div>;
}

function SelectedRafflePanel({ selectedRaffle, raffleAdmin, onBack, onEdit, onExportBuyers, onExportPayments }: { selectedRaffle: Raffle; raffleAdmin: any | null; onBack: () => void; onEdit: () => void; onExportBuyers: () => void; onExportPayments: () => void }) {
  return <section className="admin-page-panel space-y-4"><div className="flex flex-col gap-3 border-b border-[var(--admin-border)] pb-4 lg:flex-row lg:items-center lg:justify-between"><div><button onClick={onBack} className="admin-button-secondary mb-3 min-h-9 px-3 text-xs"><ArrowLeft className="h-4 w-4" /> Voltar</button><h2 className="text-xl font-semibold text-[var(--admin-text)]">{selectedRaffle.title}</h2><p className="mt-1 text-sm text-[var(--admin-muted)]">Acompanhamento individual da rifa tradicional selecionada.</p></div><button onClick={onEdit} className="admin-button min-h-11 px-4"><Edit2 className="h-4 w-4" /> Editar rifa</button></div>{!raffleAdmin ? <p className="text-sm text-[var(--admin-muted)]">Carregando contabilidade...</p> : <div className="space-y-4"><div className="grid gap-3"><MiniStat label="Receita paga" value={`R$ ${raffleAdmin.accounting.grossRevenue.toFixed(2)}`} /><MiniStat label="Cotas pagas" value={raffleAdmin.accounting.soldTickets} /><MiniStat label="Compradores únicos" value={raffleAdmin.accounting.uniqueBuyers} /><MiniStat label="Vendas pendentes" value={raffleAdmin.accounting.pendingPurchases} /></div><div className="flex flex-wrap gap-2"><button onClick={onExportBuyers} className="admin-button-secondary min-h-10 px-3 text-xs"><Download className="h-4 w-4" /> Clientes</button><button onClick={onExportPayments} className="admin-button-secondary min-h-10 px-3 text-xs"><Download className="h-4 w-4" /> Pagamentos</button></div><AdminTable title="Ranking Top Compradores por valor pago" empty="Nenhum comprador pago no ranking." rows={(raffleAdmin.buyerRanking || []).map((buyer: any) => [String(buyer.position) + "º", buyer.name, buyer.phone || buyer.email || "-", "R$ " + Number(buyer.amount || 0).toFixed(2), String(buyer.orderCount || 0) + " pedidos"])} /><AdminTable title="Ranking Top Vendedores por valor vendido" empty="Nenhum vendedor com venda direta paga." rows={(raffleAdmin.sellerRanking || []).map((seller: any) => [String(seller.position) + "º", seller.affiliateName || seller.affiliate || seller.refCode, seller.refCode, "R$ " + Number(seller.totalSold || 0).toFixed(2), String(seller.sales || 0) + " pedidos"])} /><AdminTable title="Compradores deste sorteio" empty="Nenhum comprador pago ainda." rows={raffleAdmin.buyers.map((buyer: any) => [buyer.name, buyer.phone, `${buyer.tickets} cotas`, `R$ ${buyer.amount.toFixed(2)}`])} /><AdminTable title="Vendas deste sorteio" empty="Nenhuma venda registrada." rows={raffleAdmin.purchases.slice(0, 12).map((purchase: any) => [purchase.purchaseId, purchase.customer?.name || "-", purchase.status, `${purchase.tickets} cotas`, `R$ ${purchase.amount.toFixed(2)}`])} /></div>}</section>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3"><p className="text-xs text-[var(--admin-muted)]">{label}</p><p className="mt-1 text-base font-semibold text-[var(--admin-text)]">{value}</p></div>;
}

function AdminTable({ title, rows, empty }: { title: string; rows: Array<Array<string>>; empty: string }) {
  return <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"><h3 className="text-base font-semibold text-[var(--admin-text)]">{title}</h3>{rows.length === 0 ? <p className="mt-3 text-sm text-[var(--admin-muted)]">{empty}</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-[var(--admin-border)] first:border-t-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="py-2 pr-4 text-[var(--admin-text)] whitespace-nowrap">{cell}</td>)}</tr>)}</tbody></table></div>}</div>;
}

function Field({ label, value, onChange, type = "text", placeholder, inputMode, required = false, multiline = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"]; required?: boolean; multiline?: boolean }) {
  return <label className="block space-y-2"><span className="text-xs font-semibold text-[var(--admin-muted)]">{label}</span>{multiline ? <textarea required={required} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="admin-input min-h-24 w-full resize-y" /> : <input required={required} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="admin-input min-h-11 w-full" />}</label>;
}

function historyRow(raffle: Partial<Raffle>) {
  return {
    campaign: raffle.title || "Rifa Tradicional",
    mainPrize: raffle.standardizedLifecycle?.mainPrize?.name || raffle.title || "Prêmio principal",
    sponsorPrize: raffle.standardizedLifecycle?.sponsorPrize?.enabled ? raffle.standardizedLifecycle.sponsorPrize.name : "Opcional",
    mainWinner: raffle.standardizedLifecycle?.mainWinner?.name || "Pendente",
    sponsorWinner: raffle.standardizedLifecycle?.sponsorWinner?.affiliateName || "Pendente",
    topBuyers: raffle.topBuyerRankingEnabled === false ? "Inativo" : "Valor comprado em R$",
    topAffiliates: raffle.topSellerRankingEnabled === false ? "Inativo" : "Valor vendido em R$ por indicação direta",
    date: raffle.drawDate || "Não informado",
    status: raffle.status || "draft"
  };
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
