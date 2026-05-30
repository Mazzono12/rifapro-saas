import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { ArrowLeft, Clover, Filter, History, ShieldCheck, TicketCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FazendinhaCard } from "../components/FazendinhaCard";
import { PostPurchaseLootboxModal } from "../components/PostPurchaseLootboxModal";
import { PixPaymentResultModal } from "../components/PixPaymentResultModal";
import { useFazendinha, useFazendinhaMediaSettings } from "../hooks/useRaffles";
import { checkoutService, fazendinhaService } from "../services/api";
import { useCustomerStore } from "../store/useCustomerStore";
import type { FazendinhaGroup, FazendinhaGroupStatus, FazendinhaPurchase, Raffle } from "../types";
import { cn } from "../lib/utils";
import { fazendinhaOrderIndex } from "../lib/fazendinha";
import {
  BonusRouletteCard,
  CheckoutPrimaryButton,
  FloatingCTA,
  PixPaymentCard,
  PremiumHero,
  PremiumCheckoutModal,
  PremiumPageLayout,
  PremiumTicketReceipt,
  PrizeCard,
  QuickQuantityGrid,
  SectionTitle,
  TrustBadges
} from "../components/premium/PremiumUI";
import { PrePaymentReceiptModal, type CheckoutPreview } from "../components/checkout/PrePaymentReceiptModal";
import { FazendinhaCheckoutMedia } from "../components/FazendinhaCheckoutMedia";
import { useCityDetection } from "../hooks/useCityDetection";
import { GeoPrefillService } from "../services/GeoPrefillService";

export function Fazendinha() {
  const { data, isLoading } = useFazendinha();
  const { data: mediaSettings } = useFazendinhaMediaSettings();
  const queryClient = useQueryClient();
  const { customer, setCustomer } = useCustomerStore();
  const [filter, setFilter] = useState<FazendinhaGroupStatus | "all">("all");
  const [selectedGroups, setSelectedGroups] = useState<FazendinhaGroup[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [checkoutPreview, setCheckoutPreview] = useState<CheckoutPreview | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", cpf: "", city: "", state: "", accessPassword: "" });
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [requireIdentity, setRequireIdentity] = useState(false);
  const [buying, setBuying] = useState(false);
  const [addonSuggestion, setAddonSuggestion] = useState<{ raffle: Raffle; tickets: number; amount: number } | null>(null);
  const [acceptAddon, setAcceptAddon] = useState(false);
  const [pendingPix, setPendingPix] = useState<{ purchase: FazendinhaPurchase; pixPayload: string } | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] = useState<{ purchase: FazendinhaPurchase; groups: FazendinhaGroup[] } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [lootboxReward, setLootboxReward] = useState({ open: false, count: 0, contact: "" });
  const [pendingLootbox, setPendingLootbox] = useState({ count: 0, contact: "" });
  const [paymentResult, setPaymentResult] = useState<"approved" | "rejected" | null>(null);
  const { detectedCity } = useCityDetection();

  useEffect(() => {
    if (customer) {
      setForm(current => ({
        name: customer.name,
        phone: customer.phone,
        cpf: customer.cpf,
        city: customer.city || current.city || "",
        state: customer.state || current.state || "",
        accessPassword: customer.accessPassword || ""
      }));
      setRequireIdentity(false);
    }
  }, [customer]);

  useEffect(() => {
    fazendinhaService.getAddonSuggestion().then(setAddonSuggestion).catch(() => setAddonSuggestion(null));
  }, []);

  useEffect(() => {
    if (!detectedCity?.city) return;
    setForm(current => current.city ? current : { ...current, city: detectedCity.city, state: current.state || detectedCity.state });
  }, [detectedCity]);

  const config = data?.config && typeof data.config === "object" ? data.config : {} as NonNullable<typeof data>["config"];
  const winners = Array.isArray(data?.winners) ? data.winners : [];
  const purchases = Array.isArray(data?.purchases) ? data.purchases : [];

  const groups = useMemo(() => {
    const rawGroups = Array.isArray(data?.groups) ? data.groups : [];
    const filtered = filter === "all" ? rawGroups : rawGroups.filter(group => group.status === filter);
    return [...filtered].sort((a, b) => fazendinhaOrderIndex(a.id) - fazendinhaOrderIndex(b.id));
  }, [data, filter]);

  const history = purchases.filter(item => item.usuarioId === customer?.id);
  const selectedTotal = selectedGroups.reduce((sum, group) => sum + group.preco, 0);
  const addonValue = acceptAddon && addonSuggestion ? addonSuggestion.amount : 0;
  const totalValue = selectedTotal + addonValue;
  const hasSavedCustomer = Boolean(customer?.name && customer.phone && customer.cpf);
  const canUseSavedCustomer = hasSavedCustomer && !requireIdentity;
  const isReturningCustomerVerification = hasSavedCustomer && requireIdentity && customerMode === "existing";
  const firstName = (customer?.name || form.name || "").trim().split(/\s+/)[0] || "cliente";
  const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const checkoutMedia = mediaSettings?.checkoutMedia || data?.mediaSettings?.checkoutMedia;

  const toggleGroup = (group: FazendinhaGroup) => {
    if (group.status !== "available") return;
    setConfirmedReceipt(null);
    setCheckoutPreview(null);
    setSelectedGroups(current =>
      current.some(item => item.id === group.id)
        ? current.filter(item => item.id !== group.id)
        : [...current, group]
    );
  };

  const validateFazendinhaCheckout = () => {
    if (!selectedGroups.length) {
      toast.error("Selecione ao menos um bichinho");
      return false;
    }
    if (!canUseSavedCustomer) {
      if (customerMode === "existing") {
        if (!hasSavedCustomer && !form.phone.trim() && !form.cpf.trim()) {
          toast.error("Informe telefone ou CPF para localizar seu cadastro");
          return false;
        }
        if (!/^\d{6}$/.test(form.accessPassword)) {
          toast.error("Informe sua senha de acesso com 6 dígitos");
          return false;
        }
      } else {
        if (!form.name.trim() || !form.phone.trim() || !form.cpf.trim() || !form.city.trim()) {
          toast.error("Preencha nome, WhatsApp, CPF e cidade para participar");
          return false;
        }
        if (!/^\d{6}$/.test(form.accessPassword)) {
          toast.error("Crie uma senha de acesso com 6 dígitos");
          return false;
        }
      }
    }
    return true;
  };

  const openPrePaymentReceipt = async () => {
    if (!validateFazendinhaCheckout()) return;
    setBuying(true);
    try {
      const preview = await checkoutService.preview({
        type: "fazendinha",
        groupIds: selectedGroups.map(group => group.id),
        customer: customer && (canUseSavedCustomer || isReturningCustomerVerification)
          ? { ...form, name: customer.name, phone: customer.phone, cpf: customer.cpf }
          : form,
        addon: acceptAddon && addonSuggestion ? { raffleId: addonSuggestion.raffle.id, tickets: addonSuggestion.tickets } : undefined
      });
      setCheckoutPreview(preview);
      setReceiptOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel calcular o resumo");
    } finally {
      setBuying(false);
    }
  };

  const confirmBuy = async () => {
    if (!validateFazendinhaCheckout()) return;
    setBuying(true);
    try {
      const checkoutCustomer = customer && (canUseSavedCustomer || isReturningCustomerVerification)
        ? {
            ...form,
            name: customer.name,
            phone: customer.phone,
            cpf: customer.cpf,
            city: customer.city || form.city,
            state: customer.state || form.state,
            browserId: customer.browserId
          }
        : form;
      GeoPrefillService.saveManual(checkoutCustomer.city, checkoutCustomer.state);
      const result = await fazendinhaService.buyGroups(
        selectedGroups.map(group => group.id),
        checkoutCustomer,
        false,
        acceptAddon && addonSuggestion ? { raffleId: addonSuggestion.raffle.id, tickets: addonSuggestion.tickets } : undefined
      );
      if (result.purchase?.customer) setCustomer(result.purchase.customer);
      setReceiptOpen(false);
      setConfirmedReceipt(null);
      setPendingPix({ purchase: result.purchase, pixPayload: result.pixPayload });
      setCopiedPix(false);
      toast.success("PIX gerado para a Fazendinha", {
        description: "Após confirmar o pagamento, a caixinha será liberada."
      });
      queryClient.invalidateQueries({ queryKey: ["fazendinha"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar PIX da Fazendinha";
      if (/senha/i.test(message)) {
        setRequireIdentity(true);
        setCustomerMode("existing");
      }
      toast.error(message);
    } finally {
      setBuying(false);
    }
  };

  const checkPixPayment = async () => {
    if (!pendingPix) return;
    setBuying(true);
    try {
      const status = await checkoutService.checkPixPaymentStatus(pendingPix.purchase.id);
      if (!status.paid) {
        toast.info(status.message || "Aguardando pagamento", { description: "Assim que o webhook confirmar, seu bilhete sera liberado." });
        return;
      }
      const paidPurchase = status.purchase || pendingPix.purchase;
      if (paidPurchase?.customer) setCustomer(paidPurchase.customer);
      toast.success("Pagamento confirmado", { description: "Compra concluida com sucesso." });
      if (Number(paidPurchase.earnedLootboxes || 0) > 0) {
        setPendingLootbox({
          count: Number(paidPurchase.earnedLootboxes || 0),
          contact: paidPurchase?.customer?.phone || form.phone
        });
      }
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.75 } });
      setConfirmedReceipt({ purchase: paidPurchase, groups: selectedGroups });
      setSelectedGroups([]);
      setAcceptAddon(false);
      setPendingPix(null);
      queryClient.invalidateQueries({ queryKey: ["fazendinha"] });
      setPaymentResult("approved");
    } catch (error) {
      setPaymentResult("rejected");
      toast.error(error instanceof Error ? error.message : "Erro ao verificar pagamento");
    } finally {
      setBuying(false);
    }
  };

  const copyPixPayload = async () => {
    if (!pendingPix?.pixPayload) return;
    await navigator.clipboard.writeText(pendingPix.pixPayload);
    setCopiedPix(true);
    toast.success("Código PIX copiado");
    setTimeout(() => setCopiedPix(false), 1800);
  };

  const shareConfirmedReceipt = async () => {
    if (!confirmedReceipt) return;
    const campaignName = data?.config.name || "Fazendinha";
    const text = `Compra confirmada na ${campaignName}! Pedido #${confirmedReceipt.purchase.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: campaignName, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Comprovante copiado para compartilhar");
    } catch {
      toast.info("Compartilhamento cancelado");
    }
  };

  const useMyLocation = async () => {
    const geoLocation = await captureGeoLocation();
    if (!geoLocation) {
      toast.error("Não foi possível capturar sua localização. Preencha manualmente.");
      return;
    }
    setForm(current => ({ ...current, city: current.city || geoLocation.city, state: current.state || geoLocation.state }));
    toast.success("Localização vinculada ao cadastro");
  };

  const closePaymentResult = () => {
    const wasApproved = paymentResult === "approved";
    setPaymentResult(null);
    if (wasApproved && pendingLootbox.count > 0) {
      setLootboxReward({ open: true, count: pendingLootbox.count, contact: pendingLootbox.contact });
      setPendingLootbox({ count: 0, contact: "" });
    }
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-24"><div className="h-96 rounded-3xl skeleton" /></div>;
  }

  if (!data?.config.enabled) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-24">
        <div className="glass-card p-10 text-center">
          <h1 className="font-display text-3xl font-bold">A Fazendinha esta pausada</h1>
          <p className="mt-3 text-slate-400">O admin ainda nao habilitou esta modalidade.</p>
          <Link to="/" className="premium-button mt-6 inline-flex rounded-xl px-6 py-3">Voltar</Link>
        </div>
      </div>
    );
  }

  const quickQuantities = [100, 700, 1800, 3000, 5000, 10000];

  return (
    <PremiumPageLayout className="pb-28">
      <PostPurchaseLootboxModal
        isOpen={lootboxReward.open}
        onClose={() => setLootboxReward({ ...lootboxReward, open: false })}
        earnedCount={lootboxReward.count}
        contact={lootboxReward.contact}
        config={config.lootboxConfig}
      />
      <PixPaymentResultModal result={paymentResult} onClose={closePaymentResult} />

      <PremiumHero
        eyebrow="Fazendinha premium"
        title={config.name || "Fazendinha dos Sonhos"}
        subtitle="Concorra a uma Fazendinha dos Sonhos com PIX automático, bilhetes instantâneos e sorteio auditável pela Loteria Federal."
        image={config.mediaUrl || "/fazendinha-animais-premium.png"}
        cta={<CheckoutPrimaryButton onClick={() => setCheckoutOpen(true)} className="inline-flex min-h-14 items-center justify-center rounded-2xl px-7">Participar Agora</CheckoutPrimaryButton>}
      >
        <TrustBadges />
      </PremiumHero>

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar para inicio
        </Link>

        <section className="grid gap-3 md:grid-cols-3">
          <PrizeCard title="Prêmio principal" description="Uma experiência completa para realizar o sonho da sua fazenda." image={config.mediaUrl || "/fazendinha-animais-premium.png"} badge="Principal" />
          <PrizeCard title="Prêmios extras" description="Rodadas promocionais, bônus e ativações especiais durante a campanha." badge="Bônus" />
          <PrizeCard title="Bilhete premium" description="Comprovante visual com validação, status do PIX e seus grupos comprados." badge="Seguro" />
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="premium-card p-4">
            <SectionTitle eyebrow="Blocos de cotas" title="Escolha seu impulso" description="Selecione grupos abaixo ou use os atalhos para entrar mais rápido." compact />
            <div className="mt-4">
              <QuickQuantityGrid values={quickQuantities} selected={selectedGroups.length} onSelect={value => toast.info(`Selecione ${value.toLocaleString("pt-BR")} cotas nos grupos disponíveis.`)} />
            </div>
          </div>
          <div className="space-y-3">
            <BonusRouletteCard qty={700} chances={2} prize="2 chances de contemplação nas roletas premiadas" />
            <BonusRouletteCard qty={1800} chances={5} prize="5 chances de contemplação nas roletas premiadas" tone="from-rose-500 to-fuchsia-500" />
            <BonusRouletteCard qty={3000} chances={15} prize="15 chances de contemplação nas roletas premiadas" tone="from-indigo-600 to-blue-500" />
          </div>
        </section>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="h-4 w-4" /> Filtrar grupos
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "Todos"],
            ["available", "Disponiveis"],
            ["reserved", "Reservados"],
            ["sold", "Vendidos"],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value as typeof filter)} className={cn("rounded-full border px-4 py-2 text-xs font-mono uppercase", filter === value ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-white/10 text-slate-400")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
        {groups.map(group => (
          <FazendinhaCard key={group.id} group={group} selected={selectedGroups.some(item => item.id === group.id)} onSelect={() => toggleGroup(group)} />
        ))}
      </div>

      <div className="sticky bottom-4 z-40 mt-5 rounded-3xl border border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Seleção da Fazendinha</p>
            <p className="mt-1 text-lg font-bold text-white">{selectedGroups.length} grupo(s) • {formatCurrency(selectedTotal)}</p>
            {selectedGroups.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedGroups.map(group => (
                  <span key={group.id} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
                    {group.nomeBicho}: {formatCurrency(group.preco)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <CheckoutPrimaryButton onClick={() => setCheckoutOpen(true)} disabled={!selectedGroups.length} className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 disabled:opacity-40">
            <TicketCheck className="h-5 w-5" /> Participar
          </CheckoutPrimaryButton>
        </div>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><History className="h-5 w-5 text-emerald-300" /> Meu historico</h2>
          <div className="mt-5 space-y-3">
            {history.length === 0 ? <p className="text-slate-500">Nenhum bichinho comprado neste cadastro.</p> : history.map(item => (
              <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="font-bold text-white">{item.nomeBicho}</p>
                <p className="text-sm font-mono text-slate-400">{item.numeros.join(", ")} • {item.statusPagamento}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="font-display text-2xl font-bold">Ultimos ganhadores</h2>
          <div className="mt-5 space-y-3">
            {winners.length === 0 ? <p className="text-slate-500">Nenhum resultado apurado ainda.</p> : winners.map(winner => (
              <div key={winner.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="font-bold text-white">{winner.semGanhador ? "Sem ganhador" : winner.nomeBicho}</p>
                <p className="text-sm font-mono text-slate-400">Numero {winner.numeroSorteado} • {winner.premio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PremiumCheckoutModal
        open={checkoutOpen}
        title={confirmedReceipt ? "Bilhete confirmado" : pendingPix ? "Pagamento PIX" : "Confirmar participação"}
        onClose={() => setCheckoutOpen(false)}
      >
        <div className="space-y-5 p-4 sm:p-5">
          <FazendinhaCheckoutMedia {...checkoutMedia} />
          {confirmedReceipt ? (
            <>
              <PremiumTicketReceipt
                title={config.name || "Fazendinha"}
                purchaseId={confirmedReceipt.purchase.id}
                numbers={confirmedReceipt.groups.flatMap(group => group.numeros).map(number => Number(number)).filter(Number.isFinite)}
                onShare={shareConfirmedReceipt}
              />
              <CheckoutPrimaryButton onClick={() => setCheckoutOpen(false)} className="w-full">
                Voltar para campanha
              </CheckoutPrimaryButton>
            </>
          ) : pendingPix ? (
            <>
              <div className="premium-card border-emerald-300/20 bg-emerald-300/[0.07] text-center">
                <p className="premium-eyebrow text-emerald-100">PIX gerado</p>
                <h3 className="mt-2 text-2xl font-black text-white">{formatCurrency(totalValue || pendingPix.purchase.valorPago)}</h3>
                <p className="mt-2 text-sm text-slate-300">Use o código abaixo e confirme o pagamento para liberar seu bilhete premium.</p>
              </div>
              <PixPaymentCard payload={pendingPix.pixPayload} copied={copiedPix} onCopy={copyPixPayload} />
              <CheckoutPrimaryButton onClick={checkPixPayment} disabled={buying} className="min-h-14 w-full disabled:opacity-50">
                {buying ? "Consultando status..." : "Confirmar PIX"}
              </CheckoutPrimaryButton>
            </>
          ) : (
            <>
              <div className="premium-card border-emerald-300/20 bg-emerald-300/[0.07]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="premium-eyebrow text-emerald-100">Resumo da compra</p>
                    <h3 className="mt-2 text-3xl font-black text-white">{selectedGroups.length} grupo(s)</h3>
                    <p className="mt-2 text-sm text-slate-300">{selectedGroups.flatMap(group => group.numeros).length} números no bilhete</p>
                  </div>
                  <div className="rounded-2xl bg-black/25 px-4 py-3 text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Total</p>
                    <p className="text-2xl font-black text-emerald-100">{formatCurrency(totalValue)}</p>
                  </div>
                </div>
                {selectedGroups.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {selectedGroups.map(group => (
                      <div key={group.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <strong className="text-white">{group.nomeBicho}</strong>
                          <span className="font-bold text-emerald-100">{formatCurrency(group.preco)}</span>
                        </div>
                        <p className="mt-1 break-words font-mono text-xs text-slate-300">{group.numeros.join(" ")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canUseSavedCustomer ? (
                <div className="premium-card border-emerald-300/20 bg-emerald-300/[0.08]">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                    <Clover className="h-4 w-4 fill-emerald-300 text-emerald-300" /> Cliente identificado
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-xl font-black text-white">
                    Olá, {firstName}. Boa sorte! <Clover className="h-5 w-5 fill-emerald-300 text-emerald-300" />
                  </p>
                </div>
              ) : (
                <div className="premium-card grid gap-3">
                  <p className="premium-eyebrow">Dados do comprador</p>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
                    <button type="button" onClick={() => setCustomerMode("existing")} className={cn("rounded-xl px-3 py-3 text-sm font-bold", customerMode === "existing" ? "bg-emerald-300 text-slate-950" : "text-slate-300")}>
                      Já sou cliente
                    </button>
                    <button type="button" onClick={() => setCustomerMode("new")} className={cn("rounded-xl px-3 py-3 text-sm font-bold", customerMode === "new" ? "bg-emerald-300 text-slate-950" : "text-slate-300")}>
                      Novo cadastro
                    </button>
                  </div>
                  {customerMode === "existing" ? (
                    <>
                      {isReturningCustomerVerification ? (
                        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">
                          Cliente já identificado. Confirme apenas sua senha de acesso.
                        </div>
                      ) : (
                        <>
                          <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="WhatsApp ou telefone cadastrado" className="p-4" />
                          <input value={form.cpf} onChange={event => setForm({ ...form, cpf: event.target.value })} placeholder="CPF cadastrado (opcional)" className="p-4" />
                        </>
                      )}
                      <input value={form.accessPassword} onChange={event => setForm({ ...form, accessPassword: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="Senha de acesso com 6 dígitos" className="p-4" />
                    </>
                  ) : (
                    <>
                      <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Nome completo" className="p-4" />
                      <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="WhatsApp" className="p-4" />
                      <input value={form.cpf} onChange={event => setForm({ ...form, cpf: event.target.value })} placeholder="CPF" className="p-4" />
                      <div className="grid gap-3 sm:grid-cols-[1fr_92px]">
                        <input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} placeholder="Cidade" className="p-4" />
                        <input value={form.state} onChange={event => setForm({ ...form, state: event.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" className="p-4 uppercase" />
                      </div>
                      <button type="button" onClick={useMyLocation} className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-left text-sm font-semibold text-emerald-100">
                        Preencher cidade automaticamente por geolocalização
                      </button>
                      <input value={form.accessPassword} onChange={event => setForm({ ...form, accessPassword: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="Crie uma senha de acesso com 6 dígitos" className="p-4" />
                    </>
                  )}
                </div>
              )}

              {addonSuggestion && (
                <label className="premium-card block cursor-pointer border-fuchsia-300/20 bg-fuchsia-300/[0.07]">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={acceptAddon} onChange={event => setAcceptAddon(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">Adicionar {addonSuggestion.tickets} cotas em {addonSuggestion.raffle.title}</p>
                      <p className="mt-1 text-xs text-slate-400">Oferta configurada no admin, somada no mesmo PIX por + {formatCurrency(addonSuggestion.amount)}.</p>
                    </div>
                  </div>
                </label>
              )}

              <CheckoutPrimaryButton onClick={openPrePaymentReceipt} disabled={buying} className="min-h-14 w-full disabled:opacity-50">
                {buying ? "Calculando resumo..." : `Revisar compra - ${formatCurrency(totalValue)}`}
              </CheckoutPrimaryButton>
              <p className="flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-200" /> Compra segura, PIX automático e bilhete liberado após confirmação.
              </p>
            </>
          )}
        </div>
      </PremiumCheckoutModal>
      <PrePaymentReceiptModal
        open={receiptOpen}
        campaign={config.name || "Fazendinha"}
        raffle={config.name || "Fazendinha"}
        hideMedia={!checkoutMedia?.enabled}
        fazendinhaCheckoutMedia={checkoutMedia}
        selectedQuantity={selectedGroups.flatMap(group => group.numeros).length}
        selectedPackage={`${selectedGroups.length} grupo(s)`}
        calculatedPrice={totalValue}
        customerData={{
          name: customer?.name || form.name,
          phone: customer?.phone || form.phone,
          email: (customer as any)?.email || "",
          cpf: customer?.cpf || form.cpf,
          city: customer?.city || form.city,
          state: customer?.state || form.state
        }}
        preview={checkoutPreview}
        bonuses={checkoutPreview?.bonuses}
        gatewayInfo={checkoutPreview?.gateway}
        affiliateInfo={checkoutPreview?.affiliateInfo}
        walletUsage={checkoutPreview?.walletUsage}
        loading={buying}
        onConfirm={confirmBuy}
        onEdit={() => setReceiptOpen(false)}
        onClose={() => setReceiptOpen(false)}
      />
      </div>
      <FloatingCTA
        label="Participar"
        meta={selectedGroups.length ? `${selectedGroups.length} grupos - ${formatCurrency(totalValue)}` : "Escolha seus grupos"}
        onClick={() => setCheckoutOpen(true)}
        hidden={checkoutOpen || receiptOpen}
      />
    </PremiumPageLayout>
  );
}

async function captureGeoLocation() {
  return GeoPrefillService.captureCoordinates();
}
