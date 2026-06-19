import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Ticket, X, Check, BarChart3, DollarSign, Users, Package, Star, ArrowLeft, CreditCard, Download } from "lucide-react";
import type { Raffle, RafflePixConfig } from "../../types";
import { inferMediaType } from "../../utils/media";
import { cn } from "../../lib/utils";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { LootboxRulesEditor, normalizeLootboxConfig, RewardExperienceSelector } from "../../components/admin/LootboxRulesEditor";
import { defaultVideoConfig, mergeVideoConfig, VideoSettingsEditor } from "../../components/admin/VideoSettingsEditor";
import { ResponsiveMediaFrame } from "../../components/ResponsiveMediaFrame";
import { toast } from "sonner";
import type { ResponsiveMediaAspectMode, ResponsiveMediaFit } from "../../utils/mediaAspect";

/* ui-contrast contract: Rifas */
/* media-slots contract: Home, página da campanha e checkout usam mídias independentes. */

const homeMediaAspectOptions: Array<{ value: ResponsiveMediaAspectMode; label: string }> = [
  { value: "wide", label: "Horizontal / Banner 16:9" },
  { value: "story", label: "Vertical / Story 9:16" },
  { value: "square", label: "Quadrado / Feed 1:1" },
  { value: "portrait", label: "Retrato 4:5" },
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

  return next;
}

function getDefaultHomeMediaAspect(raffle: Partial<Raffle>): ResponsiveMediaAspectMode {
  if (raffle.mediaAspect) return raffle.mediaAspect as ResponsiveMediaAspectMode;
  return ["video", "youtube", "vimeo", "bunny"].includes(String(raffle.mediaType || "").toLowerCase()) ? "wide" : "portrait";
}

function normalizeTopSellerRewards(rewards: Partial<Raffle>["topSellerRewards"] = []) {
  return [1, 2, 3].map(position => {
    const current = rewards.find(reward => Number(reward.position) === position);
    return {
      position,
      label: current?.label || "",
      enabled: Boolean(current?.enabled && current?.label)
    };
  });
}

export function AdminRaffles() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [isEditing, setIsEditing] = useState(false);
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
    fetch(`/api/admin/raffles/${raffle.id}/accounting`)
      .then(res => res.json())
      .then(setRaffleAdmin)
      .catch(() => setRaffleAdmin(null));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = currentRaffle.id ? "PUT" : "POST";
    const url = currentRaffle.id ? `/api/admin/raffles/${currentRaffle.id}` : "/api/admin/raffles";
    
    const payload = normalizeRaffleMediaDraft(currentRaffle);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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

  const updateVideoConfig = (patch: Record<string, any>) => {
    setCurrentRaffle({
      ...currentRaffle,
      videoConfig: {
        ...mergeVideoConfig(currentRaffle.videoConfig as any),
        ...patch
      }
    });
  };

  const updateVideoLabel = (field: string, value: string) => {
    const config = mergeVideoConfig(currentRaffle.videoConfig as any);
    updateVideoConfig({
      labels: {
        ...config.labels,
        [field]: value
      }
    });
  };

  const updateTopSellerReward = (position: number, patch: { label?: string; enabled?: boolean }) => {
    const rewards = normalizeTopSellerRewards(currentRaffle.topSellerRewards).map(reward =>
      reward.position === position ? { ...reward, ...patch } : reward
    );
    setCurrentRaffle({ ...currentRaffle, topSellerRewards: rewards });
  };

  const updateRafflePixConfig = (patch: Partial<RafflePixConfig>) => {
    setCurrentRaffle({
      ...currentRaffle,
      pixConfig: normalizeRafflePixDraft({
        ...(currentRaffle.pixConfig || {}),
        ...patch
      })
    });
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
      ["Nome completo", "Telefone", "Cidade", "Data da compra", "Codigo do sorteio", "Quantidade de cotas"],
      raffleAdmin.buyers.map((buyer: any) => [
        buyer.name,
        buyer.phone,
        buyer.city || "",
        buyer.lastPurchaseAt || "",
        selectedRaffle.id,
        buyer.tickets
      ])
    );
  };

  const exportSelectedPayments = () => {
    if (!selectedRaffle || !raffleAdmin) return;
    downloadCsv(
      `pagamentos-${selectedRaffle.id}.csv`,
      ["Nome completo", "Telefone", "Cidade", "Data da compra", "Codigo do sorteio", "Quantidade de cotas"],
      raffleAdmin.purchases.map((purchase: any) => [
        purchase.customer?.name || "",
        purchase.customer?.phone || purchase.contact,
        purchase.customer?.city || "",
        purchase.createdAt,
        purchase.raffleId,
        purchase.tickets
      ])
    );
  };

  return (
    <div className="space-y-5 fade-in">
       <div className="admin-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
         <div>
            <h1 className="text-2xl font-semibold text-white">Campanhas</h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Crie, publique e acompanhe suas campanhas.</p>
         </div>
         <button 
           onClick={() => { setCurrentRaffle({ status: 'active', minPurchaseTickets: 1, lootboxEnabled: true, lootboxConfig: normalizeLootboxConfig(), videoConfig: defaultVideoConfig, topSellerRewards: normalizeTopSellerRewards(), pixConfig: normalizeRafflePixDraft(), heroContentPlacement: "below", heroEyebrow: "Experiência premium", homeTitle: "Sorteios com experiência cinematográfica.", homeSubtitle: "Vídeo em tela cheia, ranking ao vivo, Super Cotas, PIX e caixinha surpresa.", homeHighlightText: "", editionLabel: "1ª EDIÇÃO", homeEditionLabel: "1ª EDIÇÃO", heroTitle: "Sorteios com experiência cinematográfica.", heroSubtitle: "Vídeo em tela cheia, ranking ao vivo, Super Cotas, PIX e caixinha surpresa.", heroPrimaryButton: "Participar agora", heroShowStats: true, showHomeText: true, showHomePrice: true }); setIsEditing(true); }}
           className="admin-button inline-flex min-h-11 items-center justify-center gap-2 px-5"
         >
           <Plus className="w-4 h-4" /> Nova campanha
         </button>
       </div>

       {selectedRaffle ? (
         <div className="space-y-6">
           <div className="glass-card p-5 border border-neon-cyan/20 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
               <button onClick={() => { setSelectedRaffle(null); setRaffleAdmin(null); }} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                 <ArrowLeft className="w-4 h-4" /> Voltar para campanhas
               </button>
               <h2 className="text-3xl font-display font-bold text-white">{selectedRaffle.title}</h2>
               <p className="text-slate-400 text-sm mt-1">Acompanhamento individual da campanha selecionada.</p>
             </div>
             <button onClick={() => { setCurrentRaffle(selectedRaffle); setIsEditing(true); setSelectedRaffle(null); }} className="neon-button px-5 py-3 rounded-xl flex items-center gap-2">
               <Edit2 className="w-4 h-4" /> Editar campanha
             </button>
           </div>

           {!raffleAdmin ? (
             <div className="glass-card p-10 text-center text-slate-500">Carregando contabilidade...</div>
           ) : (
             <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <AdminMetric icon={DollarSign} label="Receita paga" value={`R$ ${raffleAdmin.accounting.grossRevenue.toFixed(2)}`} />
                  <AdminMetric icon={Ticket} label="Cotas pagas" value={String(raffleAdmin.accounting.soldTickets)} />
                  <AdminMetric icon={Users} label="Compradores únicos" value={String(raffleAdmin.accounting.uniqueBuyers)} />
                  <AdminMetric icon={Package} label="Caixinhas geradas" value={String(raffleAdmin.accounting.lootboxesGenerated)} />
                </div>

                <div className="glass-card p-6 border border-cyan-300/10 rounded-3xl">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-cyan-300" /> PIX deste sorteio
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={exportSelectedBuyers} className="rounded-xl border border-emerald-300/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-300/10">
                        <Download className="mr-1 inline h-4 w-4" /> Clientes
                      </button>
                      <button onClick={exportSelectedPayments} className="rounded-xl border border-cyan-300/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-300/10">
                        <Download className="mr-1 inline h-4 w-4" /> Pagamentos
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <MiniStat label="Status PIX" value={raffleAdmin.pix.enabled ? "Habilitado" : "Desabilitado"} />
                    <MiniStat label="Conexão" value={raffleAdmin.pix.gateway ? "Protegida" : "Pendente"} />
                    <MiniStat label="Status da conexão" value={raffleAdmin.pix.sandbox ? "Modo Sandbox/Teste Ativo" : "Produção"} />
                    <MiniStat label="Canal seguro" value={raffleAdmin.pix.webhookUrl ? "Configurado" : "Não configurado"} />
                  </div>
                </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="glass-card p-6 lg:col-span-2">
                   <h3 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                     <BarChart3 className="w-5 h-5 text-neon-cyan" /> Fluxo financeiro do sorteio
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                     <MiniStat label="Vendas pagas" value={raffleAdmin.accounting.paidPurchases} />
                     <MiniStat label="Vendas pendentes" value={raffleAdmin.accounting.pendingPurchases} />
                     <MiniStat label="Receita pendente" value={`R$ ${raffleAdmin.accounting.pendingRevenue.toFixed(2)}`} />
                     <MiniStat label="Ticket médio" value={`R$ ${raffleAdmin.accounting.averageTicket.toFixed(2)}`} />
                     <MiniStat label="Prêmios previstos" value={`R$ ${raffleAdmin.accounting.instantPrizeLiability.toFixed(2)}`} />
                     <MiniStat label="Prêmios pagos" value={`R$ ${raffleAdmin.accounting.instantPrizePaid.toFixed(2)}`} />
                   </div>
                 </div>

                 <div className="glass-card p-6">
                   <h3 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                     <Star className="w-5 h-5 text-amber-300" /> Super Cotas
                   </h3>
                   <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                     {raffleAdmin.instantPrizes.length === 0 ? (
                       <p className="text-sm text-slate-500">Nenhuma Super Cota nesta rifa.</p>
                     ) : raffleAdmin.instantPrizes.map((prize: any) => (
                       <div key={prize.id} className={cn("rounded-xl border px-3 py-2 text-sm", prize.status === "claimed" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200")}>
                         #{String(prize.numeroPremiado).padStart(6, "0")} • R$ {prize.valorPremio.toFixed(2)} • {prize.status}
                       </div>
                     ))}
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 <AdminTable
                   title="Compradores deste sorteio"
                   empty="Nenhum comprador pago ainda."
                   rows={raffleAdmin.buyers.map((buyer: any) => [buyer.name, buyer.phone, `${buyer.tickets} cotas`, `R$ ${buyer.amount.toFixed(2)}`, buyer.lastPurchaseAt ? new Date(buyer.lastPurchaseAt).toLocaleString("pt-BR") : "-"])}
                 />
                 <AdminTable
                   title="Vendas deste sorteio"
                   empty="Nenhuma venda registrada."
                   rows={raffleAdmin.purchases.slice(0, 12).map((purchase: any) => [purchase.purchaseId, purchase.customer?.name || "-", purchase.customer?.phone || purchase.contact, purchase.status, `${purchase.tickets} cotas`, `R$ ${purchase.amount.toFixed(2)}`])}
                 />
               </div>
             </>
           )}
         </div>
       ) : isEditing ? (
         <div className="glass-card p-6 rounded-2xl border border-neon-cyan/30">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
               <h2 className="text-xl font-bold">{currentRaffle.id ? "Editar campanha" : "Criar nova campanha"}</h2>
               <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Nome da rifa / edital</label>
                    <input required type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none" 
                           value={currentRaffle.title || ''} onChange={e => setCurrentRaffle({...currentRaffle, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Descrição</label>
                    <input required type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none" 
                           value={currentRaffle.description || ''} onChange={e => setCurrentRaffle({...currentRaffle, description: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Preço (R$)</label>
                    <input required type="number" step="0.01" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none" 
                           value={currentRaffle.price || ''} onChange={e => setCurrentRaffle({...currentRaffle, price: parseFloat(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Total de Bilhetes</label>
                    <input required type="number" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none" 
                           value={currentRaffle.totalTickets || ''} onChange={e => setCurrentRaffle({...currentRaffle, totalTickets: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Quantidade mínima de cotas por compra</label>
                    <input type="number" min="1" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                           value={currentRaffle.minPurchaseTickets || ''} onChange={e => setCurrentRaffle({...currentRaffle, minPurchaseTickets: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined})} />
                    <p className="mt-1 text-[11px] text-slate-500">Opcional. Se vazio, o checkout usa o padrão atual.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Cotas vendidas / reservadas</label>
                    <input type="number" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                           value={currentRaffle.soldTickets ?? ''} onChange={e => setCurrentRaffle({...currentRaffle, soldTickets: parseInt(e.target.value) || 0})} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Progresso manual (%)</label>
                    <input type="number" min="0" max="100" step="0.1" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                           value={currentRaffle.progressOverride ?? ''} onChange={e => setCurrentRaffle({...currentRaffle, progressOverride: e.target.value === "" ? undefined : Number(e.target.value)})} />
                  </div>
                  <section className="md:col-span-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">PIX individual do sorteio</h3>
                        <p className="mt-1 text-sm text-slate-400">Esta chave Asaas vale somente para esta campanha e tem prioridade no checkout.</p>
                      </div>
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={normalizeRafflePixDraft(currentRaffle.pixConfig).enabled}
                          onChange={e => updateRafflePixConfig({ enabled: e.target.checked })}
                        />
                        PIX ativo neste sorteio
                      </label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-300">
                        Chave privada Asaas deste sorteio
                        <input
                          type="password"
                          className="mt-1 w-full rounded-xl border border-white/10 bg-cyber-900 p-3 text-white outline-none focus:border-neon-cyan/50"
                          value={normalizeRafflePixDraft(currentRaffle.pixConfig).apiKey || ""}
                          onChange={e => updateRafflePixConfig({ apiKey: e.target.value, pixKey: e.target.value })}
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-300">
                        Chave de segurança do webhook
                        <input
                          type="password"
                          className="mt-1 w-full rounded-xl border border-white/10 bg-cyber-900 p-3 text-white outline-none focus:border-neon-cyan/50"
                          value={normalizeRafflePixDraft(currentRaffle.pixConfig).webhookSecret || ""}
                          onChange={e => updateRafflePixConfig({ webhookSecret: e.target.value })}
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-300">
                        Liberar cotas em
                        <select
                          className="mt-1 w-full rounded-xl border border-white/10 bg-cyber-900 p-3 text-white outline-none focus:border-neon-cyan/50"
                          value={normalizeRafflePixDraft(currentRaffle.pixConfig).releaseMode || "PAYMENT_RECEIVED"}
                          onChange={e => updateRafflePixConfig({ releaseMode: e.target.value })}
                        >
                          <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                          <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
                        </select>
                      </label>
                      <label className="block text-sm font-semibold text-slate-300">
                        Expiração do pedido (min)
                        <input
                          type="number"
                          min="1"
                          className="mt-1 w-full rounded-xl border border-white/10 bg-cyber-900 p-3 text-white outline-none focus:border-neon-cyan/50"
                          value={normalizeRafflePixDraft(currentRaffle.pixConfig).orderExpirationMinutes || 15}
                          onChange={e => updateRafflePixConfig({ orderExpirationMinutes: Math.max(1, Number(e.target.value) || 15) })}
                        />
                      </label>
                    </div>
                    <div className="mt-3 rounded-xl border border-emerald-400/15 bg-black/20 px-3 py-2 text-xs text-emerald-100">
                      Gateway fixo: Asaas produção. Webhook: /api/webhooks/asaas.
                    </div>
                  </section>
                  <section className="md:col-span-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                    <h3 className="text-base font-bold text-white">Conversão social premium</h3>
                    <p className="mt-1 text-sm text-slate-400">Prova social real, feed de compras pagas e meta comercial para rifas com muitos números.</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                        <input type="checkbox" checked={currentRaffle.showLivePurchaseFeed !== false} onChange={e => setCurrentRaffle({ ...currentRaffle, showLivePurchaseFeed: e.target.checked })} />
                        Exibir Feed de Compras
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                        <input type="checkbox" checked={currentRaffle.showSocialProofToast !== false} onChange={e => setCurrentRaffle({ ...currentRaffle, showSocialProofToast: e.target.checked })} />
                        Exibir Prova Social
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                        <input type="checkbox" checked={currentRaffle.conversionProgressEnabled !== false} onChange={e => setCurrentRaffle({ ...currentRaffle, conversionProgressEnabled: e.target.checked })} />
                        Exibir Barra de Progresso
                      </label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-300">
                        Meta visual de progresso
                        <input type="number" min={0} step={1} placeholder="100000" className="w-full mt-1 p-3 rounded-xl bg-cyber-900 border border-white/10 text-white"
                          value={currentRaffle.conversionProgressGoal ?? ""} onChange={e => setCurrentRaffle({ ...currentRaffle, conversionProgressGoal: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-300">
                        Texto da meta
                        <input placeholder="meta alcançada" className="w-full mt-1 p-3 rounded-xl bg-cyber-900 border border-white/10 text-white"
                          value={currentRaffle.conversionProgressLabel || ""} onChange={e => setCurrentRaffle({ ...currentRaffle, conversionProgressLabel: e.target.value })} />
                      </label>
                    </div>
                    <p className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs text-slate-400">Use uma meta comercial para mostrar progresso em rifas com muitos números. Exemplo: uma rifa com 10 milhões de números pode utilizar uma meta visual de 100 mil cotas.</p>
                  </section>
                  <div className="md:col-span-2">
                    <MediaPicker
                      label="Imagem da página da campanha"
                      mediaUsage="card"
                      value={currentRaffle.image || ""}
                      required
                      onChange={(mediaUrl) => setCurrentRaffle({ ...currentRaffle, image: mediaUrl })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-3 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/5 p-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-neon-cyan">Mídia da Home</p>
                      <p className="mt-1 text-xs text-slate-400">Controla somente a mídia exibida na Home pública da campanha.</p>
                    </div>
                    <MediaPicker
                      label="Mídia principal da Home"
                      mediaUsage="hero"
                      value={currentRaffle.mediaUrl || ""}
                      mediaType={currentRaffle.mediaType}
                      onChange={(mediaUrl, mediaType) => setCurrentRaffle({ ...currentRaffle, mediaUrl, mediaType })}
                      aspectValue={getDefaultHomeMediaAspect(currentRaffle)}
                      onAspectChange={(mediaAspect) => setCurrentRaffle({ ...currentRaffle, mediaAspect: mediaAspect as Raffle["mediaAspect"] })}
                      fitValue={(currentRaffle.mediaFit || "cover") as ResponsiveMediaFit}
                      onFitChange={(mediaFit) => setCurrentRaffle({ ...currentRaffle, mediaFit: mediaFit as Raffle["mediaFit"] })}
                      aspectOptions={homeMediaAspectOptions}
                    />
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="mb-3 text-xs font-mono uppercase tracking-widest text-slate-400">Tipo da mídia principal</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { value: "image", label: "Imagem", help: "Escolha abaixo o formato visual da foto ou banner." },
                          { value: "video", label: "Vídeo", help: "Escolha abaixo o formato visual do player." }
                        ].map(option => {
                          const currentType = String(currentRaffle.mediaType || "image").toLowerCase();
                          const selected = option.value === "video"
                            ? ["video", "youtube", "vimeo", "bunny"].includes(currentType)
                            : !["video", "youtube", "vimeo", "bunny"].includes(currentType);
                          return (
                            <label key={option.value} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition", selected ? "border-neon-cyan/60 bg-neon-cyan/10 text-white" : "border-white/10 bg-black/10 text-slate-300 hover:border-white/20")}>
                              <input
                                type="radio"
                                name="home-media-type"
                                className="mt-1"
                                checked={selected}
                                onChange={() => {
                                  const inferredType = currentRaffle.mediaUrl ? inferMediaType(currentRaffle.mediaUrl) : "video";
                                  const nextMediaType = option.value === "video" && inferredType !== "image" ? inferredType : option.value;
                                  setCurrentRaffle({ ...currentRaffle, mediaType: nextMediaType as Raffle["mediaType"] });
                                }}
                              />
                              <span>
                                <span className="block text-sm font-bold">{option.label}</span>
                                <span className="mt-1 block text-xs text-slate-400">{option.help}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <label className="mt-4 block text-xs font-mono text-slate-400 mb-1">Formato da mídia da Home</label>
                      <select
                        className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                        value={getDefaultHomeMediaAspect(currentRaffle)}
                        onChange={e => setCurrentRaffle({ ...currentRaffle, mediaAspect: e.target.value as Raffle["mediaAspect"] })}
                      >
                        {homeMediaAspectOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <label className="mt-4 block text-xs font-mono text-slate-400 mb-1">Enquadramento da mídia da Home</label>
                      <select
                        className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                        value={currentRaffle.mediaFit || "cover"}
                        onChange={e => setCurrentRaffle({ ...currentRaffle, mediaFit: e.target.value as Raffle["mediaFit"] })}
                      >
                        <option value="cover">Preencher o card</option>
                        <option value="contain">Mostrar mídia inteira</option>
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-slate-300">Mídia do Checkout</p>
                      <p className="mt-1 text-xs text-slate-500">Controla somente a mídia exibida durante a revisão e pagamento.</p>
                    </div>
                    <MediaPicker
                      label="Mídia principal do Checkout"
                      mediaUsage="card"
                      value={currentRaffle.checkoutMediaUrl || ""}
                      mediaType={currentRaffle.checkoutMediaType}
                      onChange={(checkoutMediaUrl, checkoutMediaType) => setCurrentRaffle({ ...currentRaffle, checkoutMediaUrl, checkoutMediaType })}
                    />
                    <p className="mt-2 text-[11px] text-slate-500">
                      Se este campo ficar vazio, nenhuma mídia aparece no checkout.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Proporção do checkout</label>
                    <select
                      className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                      value={currentRaffle.checkoutMediaAspect || "wide"}
                      onChange={e => setCurrentRaffle({ ...currentRaffle, checkoutMediaAspect: e.target.value as any })}
                    >
                      <option value="auto">Automático / altura real</option>
                      <option value="wide">Horizontal 16:9</option>
                      <option value="cinematic">Cinema 21:9</option>
                      <option value="square">Quadrado 1:1</option>
                      <option value="portrait">Vertical 4:5</option>
                      <option value="story">Stories 9:16</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Encaixe do checkout</label>
                    <select
                      className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                      value={currentRaffle.checkoutMediaFit || currentRaffle.mediaFit || "contain"}
                      onChange={e => setCurrentRaffle({ ...currentRaffle, checkoutMediaFit: e.target.value as any })}
                    >
                      <option value="contain">Mostrar inteiro sem cortar</option>
                      <option value="cover">Preencher cortando bordas</option>
                      <option value="fill">Esticar para ocupar tudo</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 rounded-3xl border border-sky-300/15 bg-sky-300/[0.03] p-5">
                    <h3 className="font-display text-lg font-bold text-white">Player isolado desta rifa</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Essas regras valem somente para a midia deste sorteio na landing page e no checkout, evitando conflito com outros players.
                    </p>
                    <VideoSettingsEditor
                      config={mergeVideoConfig(currentRaffle.videoConfig as any)}
                      onChange={updateVideoConfig}
                      onLabelChange={updateVideoLabel}
                    />
                  </div>
                  <div className="md:col-span-2 rounded-3xl border border-fuchsia-300/15 bg-fuchsia-300/[0.03] p-5">
                    <h3 className="font-display text-lg font-bold text-white">Textos editáveis da Home</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Configure os textos exibidos abaixo da mídia principal. Se algum campo ficar vazio, a Home usa nome da rifa, prêmio e data do sorteio como fallback.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label>
                        <span className="block text-xs font-mono text-slate-400 mb-1">Posição dos textos e botões</span>
                        <select
                          className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                          value={currentRaffle.heroContentPlacement || "below"}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, heroContentPlacement: e.target.value as any })}
                        >
                          <option value="overlay">Sobre o vídeo/banner</option>
                          <option value="below">Abaixo do vídeo/banner</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <input
                          type="checkbox"
                          checked={currentRaffle.heroShowStats !== false}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, heroShowStats: e.target.checked })}
                        />
                        <span className="text-sm text-white">Mostrar preço e progresso ao lado do botão</span>
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
                        <input
                          type="checkbox"
                          checked={currentRaffle.showHomePrice !== false}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, showHomePrice: e.target.checked })}
                        />
                        <span>
                          <span className="block text-sm font-bold text-white">Mostrar bloco "POR APENAS"</span>
                          <span className="mt-1 block text-xs text-slate-400">Liga ou desliga o card do valor da cota na Home e na tela pública da rifa.</span>
                        </span>
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-4">
                        <input
                          type="checkbox"
                          checked={currentRaffle.showHomeText !== false}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, showHomeText: e.target.checked })}
                        />
                        <span>
                          <span className="block text-sm font-bold text-white">Mostrar texto abaixo do banner</span>
                          <span className="mt-1 block text-xs text-slate-400">Liga ou desliga título, subtítulo e destaque abaixo da mídia principal da Home.</span>
                        </span>
                      </label>
                      <TextField label="Etiqueta pequena" value={currentRaffle.heroEyebrow || ""} onChange={value => setCurrentRaffle({ ...currentRaffle, heroEyebrow: value })} placeholder="Experiência premium" />
                      <TextField label="Texto do botão principal" value={currentRaffle.heroPrimaryButton || ""} onChange={value => setCurrentRaffle({ ...currentRaffle, heroPrimaryButton: value })} placeholder="Participar agora" />
                      <label>
                        <span className="block text-xs font-mono text-slate-400 mb-1">Selo da edição</span>
                        <input
                          className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                          value={currentRaffle.editionLabel ?? currentRaffle.homeEditionLabel ?? ""}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, editionLabel: e.target.value, homeEditionLabel: e.target.value })}
                          placeholder="1ª EDIÇÃO"
                        />
                      </label>
                      <label className="md:col-span-2">
                        <span className="block text-xs font-mono text-slate-400 mb-1">Título da Home</span>
                        <input
                          className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                          value={currentRaffle.homeTitle ?? currentRaffle.heroTitle ?? ""}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, homeTitle: e.target.value, heroTitle: currentRaffle.heroTitle || e.target.value })}
                          placeholder="Rifa do iPhone 17 Pro Max"
                        />
                      </label>
                      <label className="md:col-span-2">
                        <span className="block text-xs font-mono text-slate-400 mb-1">Subtítulo da Home</span>
                        <textarea
                          className="min-h-24 w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                          value={currentRaffle.homeSubtitle ?? currentRaffle.heroSubtitle ?? ""}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, homeSubtitle: e.target.value, heroSubtitle: currentRaffle.heroSubtitle || e.target.value })}
                          placeholder="Concorra ao iPhone ou R$ 5.000 no PIX"
                        />
                      </label>
                      <label className="md:col-span-2">
                        <span className="block text-xs font-mono text-slate-400 mb-1">Destaque abaixo da mídia</span>
                        <input
                          className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                          value={currentRaffle.homeHighlightText || ""}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, homeHighlightText: e.target.value })}
                          placeholder="Sorteio ao vivo em 25/12/2025 às 20:00"
                        />
                      </label>
                      <label className="md:col-span-2">
                        <span className="block text-xs font-mono text-slate-400 mb-1">Texto secundário opcional</span>
                        <input
                          className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                          value={currentRaffle.heroSecondaryText || ""}
                          onChange={e => setCurrentRaffle({ ...currentRaffle, heroSecondaryText: e.target.value })}
                          placeholder="Ex: PIX instantâneo e cotas liberadas após confirmação"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2 rounded-3xl border border-amber-300/20 bg-amber-300/[0.05] p-5">
                    <h3 className="font-display text-lg font-bold text-white">Premiação Top Vendedores</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Configure os prêmios exibidos para afiliados com mais vendas pagas de indicados diretos nesta campanha. Isso não altera comissão.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {normalizeTopSellerRewards(currentRaffle.topSellerRewards).map(reward => (
                        <div key={reward.position} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <label className="flex items-center justify-between gap-3 text-sm font-bold text-white">
                            <span>{reward.position}º lugar</span>
                            <input
                              type="checkbox"
                              checked={reward.enabled}
                              onChange={e => updateTopSellerReward(reward.position, { enabled: e.target.checked })}
                            />
                          </label>
                          <input
                            className="mt-3 w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                            value={reward.label}
                            onChange={e => updateTopSellerReward(reward.position, { label: e.target.value, enabled: reward.enabled })}
                            placeholder={reward.position === 1 ? "Moto Pop 110" : reward.position === 2 ? "iPhone" : "R$ 1.000 Pix"}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Status</label>
                    <select className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none" 
                            value={currentRaffle.status || 'active'} onChange={e => setCurrentRaffle({...currentRaffle, status: e.target.value as any})}>
                       <option value="active">Ativo</option>
                       <option value="completed">Finalizado</option>
                    </select>
                  </div>
                   <div>
                     <label className="block text-xs font-mono text-slate-400 mb-1">Data Sorteio (YYYY-MM-DD)</label>
                     <input type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none" 
                            value={currentRaffle.drawDate || ''} onChange={e => setCurrentRaffle({...currentRaffle, drawDate: e.target.value})} />
                   </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Reserva da campanha (min)</label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                      value={currentRaffle.reservationMinutes || ""}
                      onChange={e => setCurrentRaffle({ ...currentRaffle, reservationMinutes: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
                      placeholder="Usar padrao global"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Opcional. Se vazio, usa o prazo global de rifa tradicional.</p>
                  </div>
                  <label className="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                    <input
                      type="checkbox"
                      checked={Boolean(currentRaffle.countdownEnabled)}
                      onChange={e => setCurrentRaffle({ ...currentRaffle, countdownEnabled: e.target.checked })}
                    />
                    <span>
                      <span className="block text-sm font-bold text-white">Ativar contador regressivo de vendas</span>
                      <span className="mt-1 block text-xs text-slate-400">Quando desligado, a rifa nao encerra por data e continua ativa ate encerramento manual.</span>
                    </span>
                  </label>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Fim das vendas</label>
                    <input
                      type="datetime-local"
                      className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                      value={toDateTimeLocal(currentRaffle.salesEndAt || currentRaffle.countdownEndAt || "")}
                      onChange={e => {
                        const next = e.target.value ? new Date(e.target.value).toISOString() : "";
                        setCurrentRaffle({ ...currentRaffle, salesEndAt: next, countdownEndAt: next });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Texto do time regressivo</label>
                    <input type="text" className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
                            value={currentRaffle.countdownLabel || ''} onChange={e => setCurrentRaffle({...currentRaffle, countdownLabel: e.target.value})} placeholder="Ex: Encerra hoje as 20h" />
                   </div>
                </div>

                <div className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.03] p-5">
                  <div className="mb-4">
                    <RewardExperienceSelector
                      enabled={currentRaffle.lootboxEnabled !== false}
                      value={currentRaffle.lootboxConfig}
                      onChange={(lootboxEnabled, lootboxConfig) => setCurrentRaffle({ ...currentRaffle, lootboxEnabled, lootboxConfig })}
                    />
                  </div>
                  <LootboxRulesEditor
                    title="Regras da premiação deste sorteio"
                    value={currentRaffle.lootboxConfig}
                    onChange={lootboxConfig => setCurrentRaffle({ ...currentRaffle, lootboxConfig })}
                    showExperienceSelector={false}
                  />
                </div>

               <div className="flex justify-end pt-4">
                 <button type="submit" className="bg-neon-cyan text-black px-6 py-3 rounded-lg font-bold font-mono tracking-wider flex items-center gap-2 hover:bg-white transition-colors">
                    <Check className="w-5 h-5" /> Salvar Rifa
                 </button>
               </div>
            </form>
         </div>
       ) : (
          <div className="grid gap-4">
            {raffles.length === 0 ? (
              <div className="admin-card rounded-2xl p-5 text-center">
                <Ticket className="mx-auto h-8 w-8 text-[var(--admin-primary)]" />
                <h2 className="mt-3 text-lg font-semibold text-white">Você ainda não possui campanhas cadastradas.</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-muted)]">
                  Use o botão Nova campanha no topo para criar a primeira campanha.
                </p>
              </div>
            ) : raffles.map(r => (
               <div key={r.id} className="glass-card p-4 rounded-xl border border-white/5 flex flex-col md:flex-row gap-6 items-center">
                  <div className="w-full md:w-48 h-32 rounded-lg bg-cyber-900 overflow-hidden relative shrink-0">
                     <ResponsiveMediaFrame src={r.image} type="image" alt={r.title} preferredFit="auto" aspectMode="auto" className="h-full w-full rounded-none" />
                     <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono border border-white/10 uppercase">
                        {r.status}
                     </div>
                  </div>
                  <div className="flex-1">
                     <h3 className="text-xl font-bold text-white mb-2">{r.title}</h3>
                     <p className="text-sm text-slate-400 line-clamp-2 max-w-lg mb-4">{r.description}</p>
                     <div className="flex gap-4 font-mono text-xs text-slate-500">
                        <span>Preço: R$ {r.price.toFixed(2)}</span>
                        <span>|</span>
                        <span>Progresso: {((r.progressOverride ?? (r.soldTickets / r.totalTickets) * 100)).toFixed(1)}%</span>
                        <span>|</span>
                        <span>Bilhetes: {r.soldTickets}/{r.totalTickets}</span>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => openRaffleAdmin(r)} className="p-3 bg-cyber-800 rounded-lg border border-white/10 hover:border-emerald-400 transition-colors text-slate-300 hover:text-emerald-300" title="Administração individual">
                        <BarChart3 className="w-4 h-4" />
                     </button>
                     <button onClick={() => { setCurrentRaffle(r); setIsEditing(true); }} className="p-3 bg-cyber-800 rounded-lg border border-white/10 hover:border-neon-cyan transition-colors text-slate-300 hover:text-neon-cyan">
                        <Edit2 className="w-4 h-4" />
                     </button>
                     <button onClick={async () => { await fetch(`/api/admin/raffles/${r.id}`, {method: 'DELETE'}); loadRaffles(); }} className="p-3 bg-cyber-800 rounded-lg border border-white/10 hover:border-red-500 transition-colors text-slate-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            ))}
         </div>
       )}
    </div>
  );
}

function AdminMetric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="glass-card p-5 border border-white/5">
      <Icon className="w-5 h-5 text-neon-cyan mb-3" />
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-2xl font-display font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label>
      <span className="block text-xs font-mono text-slate-400 mb-1">{label}</span>
      <input
        className="w-full bg-cyber-900 border border-white/10 rounded-lg p-3 text-white focus:border-neon-cyan/50 outline-none"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function AdminTable({ title, rows, empty }: { title: string; rows: Array<Array<string>>; empty: string }) {
  return (
    <div className="glass-card p-6 overflow-hidden">
      <h3 className="text-xl font-display font-bold text-white mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-white/5">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-3 pr-4 text-slate-300 whitespace-nowrap">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
