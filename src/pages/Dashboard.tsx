import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Camera, CheckCircle2, ChevronRight, Clock3, Coins, FileText, Gift, LockKeyhole, LogOut, Megaphone, MessageCircle, ReceiptText, Save, Sparkles, Ticket, Trophy, UploadCloud, User, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useCustomerStore } from "../store/useCustomerStore";
import { uploadCustomerProfilePhoto } from "../utils/customerMedia";
import { PremiumEmptyState, PremiumPageLayout, SectionTitle } from "../components/premium/PremiumUI";
import { PublicBrandMark } from "../components/branding/PublicBrandMark";
import type { Raffle } from "../types";

type TicketFilter = "all" | "pending" | "paid" | "prized";

function toSafeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function toSafeString(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { customer, setCustomer, clearCustomer } = useCustomerStore();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [activeTicketFilter, setActiveTicketFilter] = useState<TicketFilter>("paid");
  const [form, setForm] = useState({ name: "", phone: "", photoUrl: "", city: "", state: "", accessPassword: "" });
  const [areaPassword, setAreaPassword] = useState("");
  const [unlocked, setUnlocked] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [affiliateDashboard, setAffiliateDashboard] = useState<any>(null);
  const isProfile = location.pathname === "/perfil";
  const tabs = [
    { label: "Minhas Cotas", icon: Ticket, path: "/minhas-cotas" },
    { label: "Meus Afiliados", icon: Users, path: "/afiliados" },
    { label: "Meu Perfil", icon: User, path: "/perfil" },
  ];
  const ticketPurchases = useMemo(() => {
    return toSafeArray(purchases).map(item => {
      const raffle = raffles.find(candidate => String(candidate.id) === String(item.raffleId));
      const status = String(item.status || "pending").toLowerCase();
      const isPaid = status === "paid";
      const mediaType = String(item.mediaType || raffle?.mediaType || raffle?.checkoutMediaType || "").toLowerCase();
      const image = item.raffleImage || item.image || (!mediaType.includes("video") ? (raffle?.image || raffle?.checkoutMediaUrl || raffle?.mediaUrl) : raffle?.image) || "";
      const numbers = isPaid ? toSafeArray<number | string>(item.numeros) : [];
      const instantPrizes = isPaid ? toSafeArray(item.premiosInstantaneos) : [];
      const orderId = toSafeString(item.purchaseId || item.id || item.orderId || item.order_id || item.codigo || item.code).trim();
      const games = [
        item.gamification?.scratchcardEventId ? "Raspadinha" : null,
        item.gamification?.mysteryBoxEventId || toSafeNumber(item.earnedLootboxes) > 0 ? "Caixinha" : null,
        toSafeNumber(item.earnedLootboxes) > 0 ? "Roleta" : null
      ].filter(Boolean) as string[];

      return {
        ...item,
        purchaseId: orderId,
        id: orderId || item.id,
        raffle,
        image,
        title: item.raffleTitle || raffle?.title || item.raffleName || `Campanha ${item.raffleId || ""}`.trim(),
        status,
        isPaid,
        isPending: status === "pending",
        isPrized: instantPrizes.length > 0,
        amount: toSafeNumber(item.amount || item.totalValue),
        tickets: toSafeNumber(item.tickets || numbers.length),
        numbers,
        instantPrizes,
        games,
        createdAt: item.createdAt || item.created_at || item.paidAt || item.paid_at || ""
      };
    });
  }, [purchases, raffles]);
  const ticketSummary = useMemo(() => {
    return ticketPurchases.reduce((summary, item) => {
      summary.total += 1;
      if (item.isPaid) summary.paid += 1;
      if (item.isPending) summary.pending += 1;
      summary.numbers += item.isPaid ? item.numbers.length : 0;
      summary.prizes += item.instantPrizes.length;
      return summary;
    }, { total: 0, paid: 0, pending: 0, numbers: 0, prizes: 0 });
  }, [ticketPurchases]);
  const filteredTicketPurchases = useMemo(() => {
    if (activeTicketFilter === "pending") return ticketPurchases.filter(item => item.isPending);
    if (activeTicketFilter === "paid") return ticketPurchases.filter(item => item.isPaid);
    if (activeTicketFilter === "prized") return ticketPurchases.filter(item => item.isPrized);
    return ticketPurchases;
  }, [activeTicketFilter, ticketPurchases]);
  const customerName = customer?.name || "Cliente";
  const customerCpf = String(customer?.cpf || "");
  const formattedCustomerCpf = customerCpf
    ? customerCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : "não informado";
  const affiliateLink = useMemo(() => {
    if (!customer?.affiliateRefCode || typeof window === "undefined") return "";
    return `${window.location.origin}/?r=${customer.affiliateRefCode}`;
  }, [customer?.affiliateRefCode]);
  const affiliateWhatsAppUrl = useMemo(() => {
    if (!affiliateLink) return "";
    return `https://wa.me/?text=${encodeURIComponent(buildAffiliateShareMessage(affiliateLink))}`;
  }, [affiliateLink]);
  const affiliateMetrics = useMemo(() => {
    const affiliate = ((customer as any)?.affiliate || {}) as Record<string, any>;
    const metrics = affiliateDashboard?.metrics || {};
    const indicated = Number(metrics.customers || metrics.indicated || metrics.referrals || affiliate.customers || affiliate.indicated || affiliate.clicks || 0);
    const commissions = Number(metrics.commissionsTotal ?? metrics.commissionsReleased ?? affiliate.commission ?? affiliate.commissionBalance ?? 0);
    const balance = Number(metrics.availableToWithdraw ?? affiliate.commissionBalance ?? affiliate.availableBalance ?? affiliate.commission ?? 0);
    return { indicated, commissions, balance };
  }, [affiliateDashboard, customer]);

  useEffect(() => {
    if (!customer) return;
    setUnlocked(true);
    setAreaPassword("");
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      photoUrl: customer.photoUrl || "",
      city: customer.city || "",
      state: customer.state || "",
      accessPassword: ""
    });
    fetch(`/api/customers/${customer.id}/purchases`)
      .then(res => res.ok ? res.json() : [])
      .then(payload => setPurchases(toSafeArray(payload)))
      .catch(error => {
        console.error("[CUSTOMER_TICKETS_LOAD_ERROR]", error);
        setPurchases([]);
      });
    fetch("/api/raffles").then(res => res.ok ? res.json() : []).then(payload => setRaffles(Array.isArray(payload) ? payload : [])).catch(() => setRaffles([]));
    if (customer.affiliateRefCode) {
      fetch(`/api/affiliates/${customer.affiliateRefCode}/dashboard`).then(res => res.ok ? res.json() : null).then(setAffiliateDashboard).catch(() => setAffiliateDashboard(null));
    } else {
      setAffiliateDashboard(null);
    }
  }, [customer?.id]);

  const copyAffiliateLink = async () => {
    if (!affiliateLink) {
      toast.info("Ative seu cadastro de afiliado para gerar seu link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(affiliateLink);
      toast.success("Link copiado com sucesso!");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        accessPassword: form.accessPassword || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao salvar perfil");
      return;
    }
    setCustomer(data);
    toast.success("Perfil atualizado");
  };

  const uploadProfilePhoto = async (file?: File) => {
    if (!customer || !file) return;
    setUploadingPhoto(true);
    try {
      const updatedCustomer = await uploadCustomerProfilePhoto(customer.id, file);
      if (!updatedCustomer) return;
      setCustomer(updatedCustomer);
      setForm(current => ({ ...current, photoUrl: updatedCustomer.photoUrl || "" }));
      toast.success("Foto do perfil atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao subir foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const logoutCustomer = () => {
    clearCustomer();
    setUnlocked(false);
    setAreaPassword("");
    toast.success("Você saiu com sucesso");
    navigate("/", { replace: true });
  };

  const unlockArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!/^\d{6}$/.test(areaPassword)) {
      toast.error("A senha deve ter 6 dígitos");
      return;
    }
    if (customer.accessPassword && areaPassword !== customer.accessPassword) {
      toast.error("Senha incorreta");
      return;
    }
    if (!customer.accessPassword) {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessPassword: areaPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao definir senha");
        return;
      }
      setCustomer(data);
      toast.success("Senha de acesso criada");
    }
    setUnlocked(true);
  };

  if (!customer) {
    return (
      <PremiumPageLayout className="cfx-customer-page px-4 pb-10 pt-6">
      <div className="cfx-customer-shell mx-auto max-w-xl">
        <div className="cfx-customer-panel p-8 text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <h1 className="text-2xl font-display font-bold">Acesse suas cotas</h1>
          <p className="text-slate-400 mb-6">Seu cadastro é criado automaticamente na primeira compra, na etapa do PIX.</p>
          <Link to="/" className="cfx-customer-cta inline-flex px-6 py-3 rounded-xl">Comprar cotas</Link>
        </div>
      </div>
      </PremiumPageLayout>
    );
  }

  if (!unlocked) {
    return (
      <PremiumPageLayout className="cfx-customer-page px-4 pb-10 pt-6">
      <div className="cfx-customer-shell mx-auto max-w-xl">
        <form onSubmit={unlockArea} className="cfx-customer-panel p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/25 bg-amber-400/10 text-amber-200">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-display font-bold">Área do cliente</h1>
          <p className="mt-2 text-slate-400">
            {customer.accessPassword ? "Digite sua senha de 6 dígitos para ver suas informações." : "Crie uma senha simples de 6 dígitos para proteger seus dados."}
          </p>
          <input
            value={areaPassword}
            onChange={e => setAreaPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="mt-6 w-full px-5 py-4 text-center font-mono text-2xl tracking-[0.35em]"
          />
          <button className="cfx-customer-cta mt-5 w-full rounded-xl py-4">
            Entrar
          </button>
          <button type="button" onClick={logoutCustomer} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
      </PremiumPageLayout>
    );
  }

  if (!isProfile) {
    return (
      <PremiumPageLayout className="cfx-my-tickets-page" data-premium-surface="my-tickets">
        <main className="cfx-my-tickets-shell">
          <header className="cfx-my-tickets-topbar">
            <Link to="/" aria-label="Ir para o início" className="cfx-my-tickets-brand">
              <PublicBrandMark eager inline logoClassName="cfx-my-tickets-logo" nameClassName="cfx-my-tickets-brand-name" />
            </Link>
            <Link to="/perfil" className="cfx-my-tickets-profile" aria-label="Abrir perfil">
              <User />
            </Link>
          </header>

          <nav className="cfx-my-tickets-tabs" aria-label="Filtrar bilhetes">
            {[
              ["all", "Todos"],
              ["pending", "Pendentes"],
              ["paid", "Pagos"],
              ["prized", "Premiados"]
            ].map(([value, label]) => (
              <button key={value} type="button" data-active={activeTicketFilter === value} onClick={() => setActiveTicketFilter(value as TicketFilter)}>
                {label}
              </button>
            ))}
          </nav>

          <section className="cfx-my-tickets-list" aria-label="Lista de bilhetes">
            {filteredTicketPurchases.length === 0 ? (
              <PremiumEmptyState
                title="Nenhum bilhete encontrado"
                description="Quando uma compra aparecer neste filtro, ela será exibida aqui."
                action={<Link to="/" className="premium-button mt-4 px-5">Participar agora</Link>}
              />
            ) : filteredTicketPurchases.map((item, index) => {
              const orderId = String(item.purchaseId || item.id || "").trim();
              const receiptUrl = String(item.receiptUrl || item.receipt_url || item.comprovanteUrl || item.comprovante_url || item.invoiceUrl || item.invoice_url || "").trim();
              const numbersToShow = expandedPurchase === orderId ? item.numbers : item.numbers.slice(0, 18);
              return (
                <motion.article
                  key={orderId || `${item.raffleId}-${index}`}
                  className="cfx-my-ticket-entry"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.035 }}
                >
                  <div className="cfx-my-ticket-card">
                    <div className="cfx-my-ticket-media">
                      {item.image ? <img src={item.image} alt={item.title} onError={event => { event.currentTarget.style.display = "none"; }} /> : <Ticket />}
                    </div>
                    <div className="cfx-my-ticket-copy">
                      <h2>{item.title}</h2>
                      <span className={cn("cfx-my-ticket-badge", item.isPaid ? "is-paid" : item.isPending ? "is-pending" : "")}>{item.isPaid ? "PAGO" : item.isPending ? "PENDENTE" : String(item.status).toUpperCase()}</span>
                      <div className="cfx-my-ticket-meta">
                        <span><CalendarDays /> {formatTicketDate(item.createdAt)}</span>
                        <span><ReceiptText /> {formatTicketCurrency(item.amount)}</span>
                        <span><Users /> {item.tickets.toLocaleString("pt-BR")} cotas</span>
                      </div>
                    </div>
                    <div className="cfx-my-ticket-actions">
                      <Link to={`/checkout/pedido/${encodeURIComponent(orderId)}`}>
                        <Ticket /> Ver Bilhete
                      </Link>
                      {receiptUrl ? (
                        <a href={receiptUrl} target="_blank" rel="noreferrer"><FileText /> Comprovante</a>
                      ) : (
                        <Link to={`/checkout/pedido/${encodeURIComponent(orderId)}`}><FileText /> Comprovante</Link>
                      )}
                    </div>
                  </div>

                  <section className="cfx-my-ticket-numbers">
                    <h3><Ticket /> Meus Números</h3>
                    {item.isPaid && item.numbers.length > 0 ? (
                      <>
                        <div className="cfx-my-ticket-number-grid">
                          {numbersToShow.map((number: number | string, numberIndex: number) => (
                            <span key={`${orderId}-${number}-${numberIndex}`}>{formatTicketNumber(number)}</span>
                          ))}
                        </div>
                        {item.numbers.length > 18 && (
                          <button type="button" onClick={() => setExpandedPurchase(expandedPurchase === orderId ? null : orderId)}>
                            {expandedPurchase === orderId ? "Ver menos" : `Ver todos os ${item.numbers.length.toLocaleString("pt-BR")}`}
                          </button>
                        )}
                      </>
                    ) : item.isPaid ? (
                      <p>Cotas confirmadas. Atualize caso os números ainda não apareçam.</p>
                    ) : (
                      <p>Os números serão liberados após a confirmação do pagamento.</p>
                    )}
                  </section>
                </motion.article>
              );
            })}
          </section>

          <section className="cfx-my-tickets-affiliate">
            <div className="cfx-my-tickets-megaphone"><Megaphone /></div>
            <div>
              <h2>Ganhe mais indicando amigos</h2>
              <p>{affiliateLink ? "Compartilhe seu link de afiliado e ganhe comissões!" : "Ative seu cadastro de afiliado para gerar seu link."}</p>
            </div>
            {affiliateLink ? (
              <div className="cfx-my-tickets-affiliate-actions">
                <a href={affiliateWhatsAppUrl} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
                <button type="button" onClick={copyAffiliateLink}>
                  <FileText /> Copiar meu link
                </button>
              </div>
            ) : (
              <Link to="/afiliados" className="cfx-my-tickets-affiliate-cta">Ativar cadastro</Link>
            )}
          </section>

          <section className="cfx-my-tickets-affiliate-stats" aria-label="Estatísticas de afiliado">
            <article><Users /><strong>{affiliateMetrics.indicated.toLocaleString("pt-BR")}</strong><span>Indicados</span></article>
            <article><Coins /><strong>{formatTicketCurrency(affiliateMetrics.commissions)}</strong><span>Comissões</span></article>
            <article><WalletCards /><strong>{formatTicketCurrency(affiliateMetrics.balance)}</strong><span>Saldo Disponível</span></article>
          </section>
        </main>
      </PremiumPageLayout>
    );
  }

  return (
    <PremiumPageLayout className="cfx-customer-page px-4 pb-24 pt-4 md:pb-8" data-premium-surface="customer">
    <div className="cfx-customer-shell mx-auto max-w-6xl">
      <div className="cfx-customer-title mb-6">
        <SectionTitle eyebrow="Área do cliente" title="Meus bilhetes e perfil" description="Comprovantes, histórico e dados protegidos em uma experiência mobile-first." compact />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 lg:col-span-3 space-y-6">
          <div className="cfx-customer-panel p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-700 p-1 mx-auto mb-4">
              <div className="w-full h-full bg-cyber-900 rounded-full overflow-hidden flex items-center justify-center">
                {customer.photoUrl ? <img src={customer.photoUrl} alt={customerName} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-slate-400" />}
              </div>
            </div>
            <h2 className="text-xl font-bold font-display">{customerName}</h2>
            <p className="text-sm text-slate-400">CPF {formattedCustomerCpf}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-300/30 text-amber-200 text-xs font-semibold">
              {Number(customer.totalTickets || 0).toLocaleString("pt-BR")} cotas compradas
            </div>
            <button type="button" onClick={logoutCustomer} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08]">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>

          <div className="cfx-customer-panel overflow-hidden">
            <nav className="flex flex-col">
              {tabs.map(tab => {
                const active = location.pathname === tab.path || (!isProfile && tab.path === "/minhas-cotas");
                return (
                  <Link key={tab.path} to={tab.path} className={cn("flex items-center justify-between p-4 text-left transition-colors border-b last:border-0 border-white/5", active ? "bg-amber-400/10 border-l-2 border-l-amber-300" : "hover:bg-amber-400/10 text-slate-400 hover:text-white")}>
                    <div className="flex items-center gap-3">
                      <tab.icon className={cn("w-5 h-5", active ? "text-amber-200" : "")} />
                      <span className="font-medium">{tab.label}</span>
                    </div>
                    {!active && <ChevronRight className="w-4 h-4 text-slate-500" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="md:col-span-8 lg:col-span-9">
          {isProfile ? (
            <form onSubmit={saveProfile} className="cfx-customer-panel p-6 md:p-8 space-y-6">
              <h1 className="text-2xl font-display font-bold flex items-center gap-3"><User className="w-6 h-6 text-amber-200" /> Meu Perfil</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Nome</span>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Telefone</span>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Cidade</span>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-3" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">UF</span>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} className="w-full px-4 py-3 uppercase" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">CPF bloqueado</span>
                  <input value={formattedCustomerCpf} disabled className="w-full px-4 py-3 opacity-60 cursor-not-allowed" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-mono text-slate-400 uppercase flex items-center gap-2"><Camera className="w-4 h-4" /> Foto do perfil</span>
                  <span className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-400/15">
                    <UploadCloud className="w-4 h-4" /> {uploadingPhoto ? "Enviando..." : "Escolher foto ou GIF da galeria"}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp"
                      disabled={uploadingPhoto}
                      onChange={event => {
                        uploadProfilePhoto(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                      className="sr-only"
                    />
                  </span>
                  {form.photoUrl && <p className="break-all text-xs text-slate-500">Foto atual: {form.photoUrl}</p>}
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Trocar senha de acesso</span>
                  <input
                    value={form.accessPassword}
                    onChange={e => setForm({ ...form, accessPassword: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full px-4 py-3"
                    placeholder="Nova senha com 6 dígitos"
                  />
                </label>
              </div>
              <button className="cfx-customer-cta px-6 py-3 rounded-xl flex items-center gap-2"><Save className="w-4 h-4" /> Salvar dados</button>
            </form>
          ) : (
            <section className="cfx-tickets-premium">
              <header className="cfx-tickets-hero">
                <span><Ticket /></span>
                <h1>MEUS BILHETES</h1>
                <p>Acompanhe suas compras, números e prêmios.</p>
              </header>

              <div className="cfx-tickets-summary">
                <TicketSummaryCard icon={<ReceiptText />} label="Total de compras" value={ticketSummary.total.toLocaleString("pt-BR")} />
                <TicketSummaryCard icon={<CheckCircle2 />} label="Pagas" value={ticketSummary.paid.toLocaleString("pt-BR")} tone="success" />
                <TicketSummaryCard icon={<Clock3 />} label="Pendentes" value={ticketSummary.pending.toLocaleString("pt-BR")} tone="warning" />
                <TicketSummaryCard icon={<Ticket />} label="Números recebidos" value={ticketSummary.numbers.toLocaleString("pt-BR")} />
                <TicketSummaryCard icon={<Trophy />} label="Prêmios encontrados" value={ticketSummary.prizes.toLocaleString("pt-BR")} tone="gold" />
              </div>

              <div className="cfx-ticket-tabs" role="tablist" aria-label="Filtrar bilhetes">
                {[
                  ["all", "Todos"],
                  ["pending", "Pendentes"],
                  ["paid", "Pagos"],
                  ["prized", "Premiados"]
                ].map(([value, label]) => (
                  <button key={value} type="button" data-active={activeTicketFilter === value} onClick={() => setActiveTicketFilter(value as TicketFilter)}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="cfx-ticket-list">
                {filteredTicketPurchases.length === 0 ? (
                  <PremiumEmptyState
                    title="Nenhum bilhete encontrado"
                    description="Quando uma compra aparecer neste filtro, seus dados reais serão exibidos aqui."
                    action={<Link to="/" className="premium-button mt-4 px-5">Participar agora</Link>}
                  />
                ) : filteredTicketPurchases.map((item, idx) => (
                  <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }} key={item.purchaseId || `${item.raffleId}-${idx}`} className="cfx-ticket-card" data-status={item.status}>
                    <div className="cfx-ticket-card-main">
                      <div className="cfx-ticket-media">
                        {item.image ? <img src={item.image} alt={item.title} onError={event => { event.currentTarget.style.display = "none"; }} /> : <Ticket />}
                      </div>
                      <div className="cfx-ticket-info">
                        <div className="cfx-ticket-title-row">
                          <h2>{item.title}</h2>
                          <span className="cfx-ticket-status">{item.isPaid ? "PAGO" : item.isPending ? "PENDENTE" : String(item.status).toUpperCase()}</span>
                        </div>
                        <div className="cfx-ticket-meta">
                          <span><CalendarDays /> {formatTicketDate(item.createdAt)}</span>
                          <span>{formatTicketCurrency(item.amount)}</span>
                          <span>{item.tickets.toLocaleString("pt-BR")} cotas</span>
                        </div>
                        <div className="cfx-ticket-actions">
                          <button
                            type="button"
                            onClick={() => setExpandedPurchase(expandedPurchase === item.purchaseId ? null : item.purchaseId)}
                          >
                            <Ticket /> Ver Bilhete
                          </button>
                          {item.isPaid && (
                            <button type="button" onClick={() => setExpandedPurchase(item.purchaseId)}>
                              <ReceiptText /> Comprovante
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <section className="cfx-ticket-numbers">
                      <h3>Números</h3>
                      {item.isPaid && item.numbers.length > 0 ? (
                        <>
                          <div>
                            {(expandedPurchase === item.purchaseId ? item.numbers : item.numbers.slice(0, 10)).map((number: number | string, index: number) => (
                              <span key={`${number}-${index}`}>{formatTicketNumber(number)}</span>
                            ))}
                          </div>
                          {item.numbers.length > 10 && (
                            <button type="button" onClick={() => setExpandedPurchase(expandedPurchase === item.purchaseId ? null : item.purchaseId)}>
                              {expandedPurchase === item.purchaseId ? "Ver menos" : `Ver todos os ${item.numbers.length.toLocaleString("pt-BR")}`}
                            </button>
                          )}
                        </>
                      ) : item.isPaid ? (
                        <p>Compra paga sem números informados.</p>
                      ) : (
                        <p>Números liberados após pagamento.</p>
                      )}
                    </section>

                    {item.instantPrizes.length > 0 && (
                      <section className="cfx-ticket-super">
                        <h3><Trophy /> Super Cotas</h3>
                        <div>
                          {item.instantPrizes.map((prize: any, prizeIndex: number) => (
                            <article key={`${prize.numeroPremiado}-${prize.valorPremio}-${prizeIndex}`}>
                              <strong>{formatTicketNumber(prize.numeroPremiado)}</strong>
                              <span>{formatTicketCurrency(Number(prize.valorPremio || 0))}</span>
                            </article>
                          ))}
                        </div>
                      </section>
                    )}

                    {item.games.length > 0 && (
                      <section className="cfx-ticket-benefits">
                        <h3><Sparkles /> Benefícios liberados</h3>
                        <div>
                          {item.games.map((game: string) => (
                            <span key={game}><Gift /> {game}</span>
                          ))}
                        </div>
                      </section>
                    )}
                  </motion.article>
                ))}
              </div>

              <div className="cfx-tickets-cta">
                <Link to="/">Comprar mais cotas</Link>
                <Link to="/">Voltar para campanhas</Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
    </PremiumPageLayout>
  );
}

function TicketSummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "success" | "warning" | "gold" }) {
  return (
    <article className="cfx-ticket-summary-card" data-tone={tone || "purple"}>
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function formatTicketDate(value?: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data não informada";
  return date.toLocaleDateString("pt-BR");
}

function formatTicketCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildAffiliateShareMessage(link: string) {
  return [
    "🎉 Estou participando da Deni Premiações!",
    "",
    "🍀 Já garanti minhas cotas e você também pode participar.",
    "",
    "🎁 iPhone 17 Pro Max ou R$ 5.000 no PIX",
    "",
    "🔥 Além disso tem:",
    "• Roleta Premiada",
    "• Caixinha Premiada",
    "• Raspadinha",
    "• Top Compradores",
    "",
    "👇 Compre suas cotas pelo meu link:",
    "",
    link
  ].join("\n");
}

function formatTicketNumber(value: number | string) {
  const text = String(value);
  return /^\d+$/.test(text) ? text.padStart(6, "0") : text;
}
