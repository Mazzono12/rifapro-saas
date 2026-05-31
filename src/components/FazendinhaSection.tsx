import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clover, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useFazendinha, useFazendinhaMediaSettings } from "../hooks/useRaffles";
import { checkoutService, fazendinhaService } from "../services/api";
import { useCustomerStore } from "../store/useCustomerStore";
import { cn } from "../lib/utils";
import { FAZENDINHA_ANIMAL_MARKS, FAZENDINHA_GROUP_ORDER } from "../lib/fazendinha";
import type { FazendinhaGroup, FazendinhaPurchase, Raffle } from "../types";
import { PostPurchaseLootboxModal } from "./PostPurchaseLootboxModal";
import { PixPaymentResultModal } from "./PixPaymentResultModal";
import { PrePaymentReceiptModal, type CheckoutPreview } from "./checkout/PrePaymentReceiptModal";
import { CheckoutModalHeader, CheckoutPrimaryButton } from "./premium/PremiumUI";
import { FazendinhaAnimalPickerBanner } from "./FazendinhaAnimalPickerBanner";
import { FazendinhaCheckoutMedia } from "./FazendinhaCheckoutMedia";
import { FazendinhaCompactPremiumInfo, FazendinhaParticipateCTA } from "./FazendinhaPremiumExperience";
import { useCityDetection } from "../hooks/useCityDetection";
import { GeoPrefillService } from "../services/GeoPrefillService";

const boardGroupIds = FAZENDINHA_GROUP_ORDER;

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeGroupNumbers(group: Partial<FazendinhaGroup>) {
  return Array.isArray(group.numeros) ? group.numeros : [];
}

function normalizeFazendinhaGroup(group: Partial<FazendinhaGroup> | null | undefined): FazendinhaGroup | null {
  if (!group?.id) return null;
  return {
    ...group,
    id: String(group.id),
    nomeBicho: String(group.nomeBicho || group.id),
    numeros: safeGroupNumbers(group),
    preco: safeNumber(group.preco),
    status: group.status || "available"
  } as FazendinhaGroup;
}

export function FazendinhaSection() {
  const { data } = useFazendinha();
  const { data: mediaSettings } = useFazendinhaMediaSettings();
  const queryClient = useQueryClient();
  const { customer, setCustomer } = useCustomerStore();
  const [selectedGroups, setSelectedGroups] = useState<FazendinhaGroup[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [checkoutPreview, setCheckoutPreview] = useState<CheckoutPreview | null>(null);
  const [buying, setBuying] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", cpf: "", city: "", state: "", accessPassword: "" });
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [requireIdentity, setRequireIdentity] = useState(false);
  const [addonSuggestion, setAddonSuggestion] = useState<{ raffle: Raffle; tickets: number; amount: number } | null>(null);
  const [acceptAddon, setAcceptAddon] = useState(false);
  const [pendingPix, setPendingPix] = useState<{ purchase: FazendinhaPurchase; pixPayload: string } | null>(null);
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

  const groups = useMemo(() => {
    const rawGroups = Array.isArray(data?.groups) ? data.groups : [];
    return rawGroups.map(group => normalizeFazendinhaGroup(group)).filter((group): group is FazendinhaGroup => Boolean(group));
  }, [data?.groups]);
  const groupsById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups]);
  const extraGroups = groups.filter(group => !boardGroupIds.includes(group.id));
  const selectedTotal = selectedGroups.reduce((sum, group) => sum + safeNumber(group.preco), 0);
  const safeAddonSuggestion = addonSuggestion?.raffle?.id ? addonSuggestion : null;
  const addonAmount = safeNumber(safeAddonSuggestion?.amount);
  const addonValue = acceptAddon && safeAddonSuggestion ? addonAmount : 0;
  const totalValue = selectedTotal + addonValue;
  const config = data?.config;
  if (!config?.enabled || config.status !== "active") return null;

  const configName = String(config.name || "Fazendinha");
  const configMainPrize = String(config.mainPrize || (config as any).prize || "Premio principal");
  const configPricePerGroup = safeNumber(config.pricePerGroup);
  const hasSavedCustomer = Boolean(customer?.name && customer.phone && customer.cpf);
  const canUseSavedCustomer = hasSavedCustomer && !requireIdentity;
  const isReturningCustomerVerification = hasSavedCustomer && requireIdentity && customerMode === "existing";
  const firstName = (customer?.name || form.name || "").trim().split(/\s+/)[0] || "cliente";
  const formatCurrency = (value: number) => safeNumber(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const selectedNumbers = selectedGroups.flatMap(group => safeGroupNumbers(group));
  const homeBanner = mediaSettings?.homeBanner || data?.mediaSettings?.homeBanner || data?.homeMedia;
  const checkoutMedia = mediaSettings?.checkoutMedia || data?.mediaSettings?.checkoutMedia;
  const premiumExperience = mediaSettings?.premiumExperience || data?.mediaSettings?.premiumExperience;
  const formattedPricePerGroup = formatCurrency(configPricePerGroup);
  const pixCountdown = usePixCountdown(pendingPix?.purchase?.pixExpiresAt || pendingPix?.purchase?.reservedUntil);

  const toggleGroup = (group?: FazendinhaGroup) => {
    if (!group || group.status !== "available") return;
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
        addon: acceptAddon && safeAddonSuggestion ? { raffleId: safeAddonSuggestion.raffle.id, tickets: safeNumber(safeAddonSuggestion.tickets) } : undefined
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
        acceptAddon && safeAddonSuggestion ? { raffleId: safeAddonSuggestion.raffle.id, tickets: safeNumber(safeAddonSuggestion.tickets) } : undefined
      );
      if (!result?.purchase || !result.pixPayload) throw new Error("Resposta de PIX incompleta");
      if (result.purchase?.customer) setCustomer(result.purchase.customer);
      setReceiptOpen(false);
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

  const useMyLocation = async () => {
    const geoLocation = await captureGeoLocation();
    if (!geoLocation) {
      toast.error("Não foi possível capturar sua localização. Preencha manualmente.");
      return;
    }
    setForm(current => ({
      ...current,
      city: current.city || geoLocation.city,
      state: current.state || geoLocation.state,
    }));
    toast.success("Localização vinculada ao cadastro");
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
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.75 } });
      toast.success("Pagamento confirmado", {
        description: "Compra concluída com sucesso."
      });
      setSelectedGroups([]);
      setCheckoutOpen(false);
      setAcceptAddon(false);
      setPendingPix(null);
      queryClient.invalidateQueries({ queryKey: ["fazendinha"] });
      setPaymentResult("approved");
      if (Number(paidPurchase.earnedLootboxes || 0) > 0) {
        setPendingLootbox({
          count: Number(paidPurchase.earnedLootboxes || 0),
          contact: paidPurchase?.customer?.phone || form.phone
        });
      }
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

  const closePaymentResult = () => {
    const wasApproved = paymentResult === "approved";
    setPaymentResult(null);
    if (wasApproved && pendingLootbox.count > 0) {
      setLootboxReward({ open: true, count: pendingLootbox.count, contact: pendingLootbox.contact });
      setPendingLootbox({ count: 0, contact: "" });
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-3 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-4 md:p-5">
      <PostPurchaseLootboxModal
        isOpen={lootboxReward.open}
        onClose={() => setLootboxReward({ ...lootboxReward, open: false })}
        earnedCount={lootboxReward.count}
        contact={lootboxReward.contact}
        config={config.lootboxConfig}
      />
      <PixPaymentResultModal result={paymentResult} onClose={closePaymentResult} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,var(--theme-glow),transparent_30%),radial-gradient(circle_at_86%_18%,var(--theme-glow-2),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/18 to-transparent opacity-70" />

      <div className="relative z-10 mx-auto max-w-[980px] space-y-3 sm:space-y-4">
        <FazendinhaAnimalPickerBanner {...homeBanner} />
        <FazendinhaCompactPremiumInfo settings={premiumExperience} prize={configMainPrize} price={formattedPricePerGroup} drawDate={config.drawDate} caixinhaActive={Boolean(config.lootboxEnabled)} />
        <h2 className="fazendinha-animal-picker-title flex items-center justify-center gap-2 px-1 text-center font-display text-2xl font-black leading-tight text-[var(--theme-text)] sm:text-3xl">
          <Sparkles className="h-5 w-5 text-[var(--theme-primary)]" /> Escolha seus bichinhos
        </h2>
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--theme-border)] bg-[var(--theme-bg-soft)] p-2 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_20%,var(--theme-glow),transparent_38%)] opacity-70" />
          <div className="relative z-10 grid grid-cols-5 gap-2 rounded-2xl bg-black/10 p-2 sm:gap-3 sm:p-3">
            {boardGroupIds.map(groupId => {
              const group = groupsById.get(groupId);
              const selected = Boolean(group && selectedGroups.some(item => item.id === group.id));
              const unavailable = Boolean(group && group.status !== "available");
              const disabled = !group || unavailable;
              return (
                <button
                  key={groupId}
                  type="button"
                  aria-label={group ? `${group.nomeBicho} ${group.status === "available" ? "disponível" : group.status === "reserved" ? "reservado" : "vendido"}` : groupId}
                  onClick={() => toggleGroup(group)}
                  disabled={disabled}
                  className={cn(
                    "relative min-h-[92px] overflow-hidden rounded-2xl border p-2 text-left transition-all sm:min-h-[126px] sm:p-3",
                    selected && "border-emerald-300 bg-emerald-300/20 shadow-[0_0_28px_rgba(110,231,183,0.55)]",
                    !selected && !unavailable && "border-[var(--theme-border)] bg-[var(--theme-surface)] hover:border-[var(--theme-primary)]/70 hover:bg-[var(--theme-primary)]/10",
                    unavailable && group?.status === "reserved" && "cursor-not-allowed border-amber-300/90 bg-amber-500/30 shadow-[inset_0_0_22px_rgba(245,158,11,0.45)]",
                    unavailable && group?.status === "sold" && "cursor-not-allowed border-red-400/90 bg-red-600/35 shadow-[inset_0_0_24px_rgba(239,68,68,0.55)]"
                  )}
                >
                  <span className="block text-center text-3xl leading-none sm:text-5xl">
                    {FAZENDINHA_ANIMAL_MARKS[groupId] || group?.nomeBicho?.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="mt-1 block truncate text-center text-[10px] font-black text-[var(--theme-text)] sm:text-sm">
                    {group?.nomeBicho || groupId}
                  </span>
                  <span className="mt-1 grid grid-cols-2 gap-1">
                    {safeGroupNumbers(group || {}).map(numero => (
                      <span key={numero} className="rounded-md bg-black/20 px-1 py-0.5 text-center text-[9px] font-mono text-[var(--theme-text)] sm:text-xs">
                        {numero}
                      </span>
                    ))}
                  </span>
                  {unavailable && (
                    <span className="absolute inset-0 grid place-items-center bg-black/35 text-[8px] font-black uppercase tracking-widest text-white backdrop-blur-[1px] sm:text-[10px]">
                      {group?.status === "reserved" ? "Reservado" : "Vendido"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {extraGroups.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {extraGroups.map(group => {
              const selected = selectedGroups.some(item => item.id === group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => toggleGroup(group)}
                  disabled={group.status !== "available"}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-bold transition-all",
                    selected ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-white/[0.04] text-white",
                    group.status === "reserved" && "border-amber-300/70 bg-amber-500/15 text-amber-100 opacity-80",
                    group.status === "sold" && "border-red-400/70 bg-red-500/20 text-red-100 opacity-80"
                  )}
                >
                  {group.nomeBicho} • {safeGroupNumbers(group).join(" ")}
                  {group.status !== "available" && <span className="ml-2 text-[10px] uppercase">({group.status === "reserved" ? "Reservado" : "Vendido"})</span>}
                </button>
              );
            })}
          </div>
        )}

        <FazendinhaParticipateCTA
          settings={premiumExperience}
          selectedCount={selectedGroups.length}
          selectedNumbers={selectedNumbers.length}
          total={formatCurrency(selectedTotal)}
          disabled={!selectedGroups.length}
          onClick={() => setCheckoutOpen(true)}
        />
      </div>

      <AnimatePresence>
        {checkoutOpen && (
          <motion.div className="fixed inset-0 z-[70] overflow-hidden bg-black/70 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="h-dvh overflow-y-auto overscroll-contain px-2 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-4 md:pt-[calc(env(safe-area-inset-top)+2.5rem)]">
            <div className="checkout-screen checkout-modal-shell glass-card mx-auto w-full overflow-hidden p-0">
              <CheckoutModalHeader title={`${selectedGroups.length} grupo(s)`} eyebrow="Participar da Fazendinha" onClose={() => setCheckoutOpen(false)} compact={!checkoutMedia?.enabled || !checkoutMedia?.mediaUrl} />
              <div className="p-4 sm:p-5">
              <FazendinhaCheckoutMedia {...checkoutMedia} className="mt-5" />

              {canUseSavedCustomer ? (
                <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                  <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-200">
                    <Clover className="h-4 w-4 fill-emerald-300 text-emerald-300" /> Cliente identificado
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-display text-xl font-black text-white">
                    Olá, {firstName}. Boa Sorte! <Clover className="h-5 w-5 fill-emerald-300 text-emerald-300" />
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Identificação para gerar PIX</p>
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
                          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp ou telefone cadastrado" className="p-4" />
                          <input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="CPF cadastrado (opcional se usar telefone)" className="p-4" />
                        </>
                      )}
                      <input
                        value={form.accessPassword}
                        onChange={e => setForm({ ...form, accessPassword: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Senha de acesso com 6 dígitos"
                        className="p-4"
                      />
                    </>
                  ) : (
                    <>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" className="p-4" />
                      <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp" className="p-4" />
                      <input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="CPF" className="p-4" />
                      <div className="grid gap-3 sm:grid-cols-[1fr_92px]">
                        <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Cidade" className="p-4" />
                        <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" className="p-4 uppercase" />
                      </div>
                      <button type="button" onClick={useMyLocation} className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-left text-sm font-semibold text-emerald-100">
                        Preencher cidade automaticamente por geolocalização
                      </button>
                      <input
                        value={form.accessPassword}
                        onChange={e => setForm({ ...form, accessPassword: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Crie uma senha de acesso com 6 dígitos"
                        className="p-4"
                      />
                    </>
                  )}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-emerald-200">Bilhete de compra</p>
                    <h3 className="mt-1 font-display text-xl font-bold text-white">Fazendinha Premiada</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-mono text-slate-300">
                    {selectedNumbers.length} números
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Grupos selecionados</span>
                    <strong className="font-mono text-white">{selectedGroups.length}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Subtotal Fazendinha</span>
                    <strong className="font-mono text-white">{formatCurrency(selectedTotal)}</strong>
                  </div>
                  {acceptAddon && safeAddonSuggestion && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400">Oferta combinada</span>
                      <strong className="font-mono text-white">{formatCurrency(addonValue)}</strong>
                    </div>
                  )}
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="flex items-end justify-between gap-4">
                      <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Total do bilhete</span>
                      <strong className="font-display text-3xl text-emerald-200">{formatCurrency(totalValue)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-slate-300">Você recebe automaticamente:</p>
                <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {selectedGroups.map(group => (
                    <div key={group.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-white">{group.nomeBicho}</strong>
                        <span className="text-xs font-semibold text-slate-300">{formatCurrency(group.preco)}</span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-emerald-200">{safeGroupNumbers(group).join(" ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              {safeAddonSuggestion && (
                <label className="mt-5 block cursor-pointer rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={acceptAddon} onChange={e => setAcceptAddon(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">Adicionar {safeNumber(safeAddonSuggestion.tickets)} cotas em {safeAddonSuggestion.raffle.title || "campanha ativa"}</p>
                      <p className="mt-1 text-xs text-slate-400">Sugestão configurada no admin, somada no mesmo PIX por + R$ {addonAmount.toFixed(2).replace(".", ",")}.</p>
                    </div>
                  </div>
                </label>
              )}

              {pendingPix && (
                <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-center">
                  <p className="text-xs font-mono uppercase tracking-widest text-emerald-200">PIX gerado</p>
                  <p className="mt-1 text-sm text-slate-300">Escaneie o QR Code ou copie o código PIX.</p>
                  <p className="mx-auto mt-3 w-fit rounded-2xl border border-emerald-300/20 bg-black/20 px-4 py-2 font-mono text-sm font-black text-emerald-100">
                    Expira em {pixCountdown}
                  </p>
                  <div className="mx-auto mt-4 w-full max-w-[min(17rem,calc(100vw-3rem))] rounded-2xl bg-white p-3 shadow-[0_0_35px_rgba(16,185,129,0.22)] sm:w-fit sm:max-w-none sm:p-4">
                    <QRCodeSVG value={pendingPix.pixPayload} className="h-auto w-full sm:h-[210px] sm:w-[210px]" bgColor="#ffffff" fgColor="#0f172a" level="M" />
                  </div>
                  <p className="mt-4 max-h-24 overflow-y-auto break-all rounded-xl bg-black/35 p-3 text-left font-mono text-xs text-emerald-50">
                    {pendingPix.pixPayload}
                  </p>
                  <button type="button" onClick={copyPixPayload} className={cn("mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold transition-colors", copiedPix ? "border-emerald-300 bg-emerald-300 text-black" : "border-emerald-300/40 bg-black/20 text-emerald-100 hover:bg-emerald-300 hover:text-black")}>
                    {copiedPix ? "PIX copiado" : "Copiar código PIX"} {!copiedPix && <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}

              <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Subtotal Fazendinha</span>
                  <strong className="text-white">{formatCurrency(selectedTotal)}</strong>
                </div>
                <div className="space-y-2 border-t border-white/10 pt-3">
                  {selectedGroups.map(group => (
                    <div key={group.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-400">{group.nomeBicho} • {safeGroupNumbers(group).length} números</span>
                      <span className="font-semibold text-slate-100">{formatCurrency(group.preco)}</span>
                    </div>
                  ))}
                  {acceptAddon && safeAddonSuggestion && (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-emerald-100">Adicional: {safeNumber(safeAddonSuggestion.tickets)} cotas em {safeAddonSuggestion.raffle.title || "campanha ativa"}</span>
                      <span className="font-semibold text-emerald-50">{formatCurrency(addonValue)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <span className="text-slate-300">Total do PIX</span>
                  <strong className="font-display text-xl text-white">{formatCurrency(totalValue)}</strong>
                </div>
              </div>
              <CheckoutPrimaryButton onClick={pendingPix ? checkPixPayment : openPrePaymentReceipt} disabled={buying} className="sticky bottom-0 z-20 mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-black shadow-[0_-18px_45px_rgba(0,0,0,0.38)] disabled:opacity-50">
                <CheckCircle2 className="h-5 w-5" /> {buying ? "Processando..." : pendingPix ? "Confirmar PIX" : "Revisar compra"}
              </CheckoutPrimaryButton>
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <PrePaymentReceiptModal
        open={receiptOpen}
        campaign={configName}
        raffle={configName}
        hideMedia={!checkoutMedia?.enabled}
        fazendinhaCheckoutMedia={checkoutMedia}
        selectedQuantity={selectedNumbers.length}
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
    </section>
  );
}

async function captureGeoLocation() {
  return GeoPrefillService.captureCoordinates();
}

function usePixCountdown(expiresAt?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const target = expiresAt ? new Date(expiresAt).getTime() : now + 5 * 60 * 1000;
  const diff = Math.max(0, (Number.isFinite(target) ? target : now) - now);
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
