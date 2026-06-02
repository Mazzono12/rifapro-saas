import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Download,
  Gift,
  Headphones,
  Menu,
  Minus,
  Plus,
  QrCode,
  Radio,
  Send,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  WalletCards
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import type { PromotionType, Raffle } from "../types";
import { useCustomerStore } from "../store/useCustomerStore";
import { usePurchasePolling } from "../hooks/usePurchasePolling";
import { NumberRevealModal } from "../components/NumberRevealModal";
import { PostPurchaseLootboxModal } from "../components/PostPurchaseLootboxModal";
import { PixPaymentResultModal } from "../components/PixPaymentResultModal";
import { StandardRaffleMediaBlock } from "../components/StandardRaffleMediaBlock";
import { GamificationPanel } from "../components/GamificationPanel";
import { PrePaymentReceiptModal, type CheckoutPreview } from "../components/checkout/PrePaymentReceiptModal";
import { CheckoutCampaignMedia } from "../components/checkout/CheckoutCampaignMedia";
import { CheckoutModalShell, CheckoutPrimaryActionButton } from "../components/premium/PremiumUI";
import { checkoutService } from "../services/api";
import { GeoPrefillService } from "../services/GeoPrefillService";
import { useCityDetection } from "../hooks/useCityDetection";
import { finishMetric, markPageLoaded, startMetric } from "../lib/performanceMetrics";
import { TenantLogo } from "../components/branding/TenantLogo";
import { TenantHeaderName } from "../components/branding/TenantHeaderName";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";
import { PublicConversionWidgets } from "../components/PublicConversionWidgets";
import { PromotionBadges, PromotionSummaryCard } from "../components/promotions/PromotionBadges";

type CheckoutStep = "review" | "payment" | "ticket";
type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; ended: boolean };

const quickAmounts = [100, 700, 1800, 3000, 5000, 10000];

const casinoCards = [
  { tone: "from-sky-500 to-cyan-300", qty: 100, chances: 1, prize: "R$ 50 instantaneo" },
  { tone: "from-rose-500 to-orange-300", qty: 700, chances: 8, prize: "Roleta turbo" },
  { tone: "from-violet-500 to-fuchsia-300", qty: 1800, chances: 22, prize: "Cashback especial" },
  { tone: "from-emerald-400 to-lime-300", qty: 3000, chances: 40, prize: "Premio relampago" }
];

export function RaffleDetails() {
  const { id } = useParams();
  const { branding } = useTenantBranding();
  const { customer, setCustomer } = useCustomerStore();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState(100);
  const [selectedQuick, setSelectedQuick] = useState(100);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [checkoutPreview, setCheckoutPreview] = useState<CheckoutPreview | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingPix, setConfirmingPix] = useState(false);
  const [purchase, setPurchase] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [paymentResult, setPaymentResult] = useState<"approved" | "rejected" | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showLootboxModal, setShowLootboxModal] = useState(false);
  const [ranking, setRanking] = useState<Array<{ name: string; phone: string; tickets: number; amount: number }>>([]);
  const [instantPrizeNumbers, setInstantPrizeNumbers] = useState<Array<{ id: string; numeroPremiado: number; valorPremio: number; status: string }>>([]);
  const [gamification, setGamification] = useState<any>(null);
  const [publicPromotions, setPublicPromotions] = useState<Array<{ label: string; type: PromotionType; promotionId: string }>>([]);
  const [settings, setSettings] = useState<any>(null);
  const [addonSuggestion, setAddonSuggestion] = useState<{ raffle: Raffle; tickets: number; amount: number } | null>(null);
  const [acceptAddon, setAcceptAddon] = useState(false);
  const [acceptOrderBump, setAcceptOrderBump] = useState(false);
  const [customerMode, setCustomerMode] = useState<"register" | "login">("register");
  const [requireIdentity, setRequireIdentity] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<{ discount: number; bonusTickets: number; total: number; coupon?: { code: string } } | null>(null);
  const [useBalance, setUseBalance] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", cpf: "", city: "", state: "", accessPassword: "" });
  const notifiedPrizePurchase = useRef<string | null>(null);
  const { purchase: polledPurchase } = usePurchasePolling(purchase?.purchaseId, 7000);
  const { detectedCity } = useCityDetection();

  useEffect(() => {
    startMetric("public_page_load");
    fetch(`/api/raffles/${id}`)
      .then(res => {
        if (!res.ok) throw new Error("Rifa nao encontrada");
        return res.json();
      })
      .then(data => setRaffle(data))
      .catch(err => {
        setError(err.message || "Nao foi possivel carregar esta rifa");
        toast.error("Erro ao carregar rifa", { description: err.message });
      })
      .finally(() => {
        setLoading(false);
        markPageLoaded({ page: "raffle-details", raffleId: id });
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/raffles/${id}/ranking`).then(res => res.json()).then(payload => setRanking(Array.isArray(payload) ? payload : [])).catch(() => setRanking([]));
    fetch(`/api/raffles/${id}/instant-prizes`).then(res => res.json()).then(payload => setInstantPrizeNumbers(Array.isArray(payload) ? payload : [])).catch(() => setInstantPrizeNumbers([]));
    fetch(`/api/raffles/${id}/gamification`).then(res => res.json()).then(setGamification).catch(() => null);
    fetch(`/api/public/promotions?raffleId=${encodeURIComponent(id)}`).then(res => res.json()).then(payload => setPublicPromotions(Array.isArray(payload?.badges) ? payload.badges : [])).catch(() => setPublicPromotions([]));
    fetch(`/api/raffles/${id}/addon-suggestion`).then(res => res.ok ? res.json() : null).then(data => data && setAddonSuggestion(data)).catch(() => null);
    fetch("/api/settings").then(res => res.json()).then(setSettings).catch(() => null);
  }, [id]);

  useEffect(() => {
    if (!customer) return;
    setCustomerForm(current => ({
      name: customer.name || "",
      phone: customer.phone || "",
      cpf: customer.cpf || "",
      city: customer.city || current.city || "",
      state: customer.state || current.state || "",
      accessPassword: ""
    }));
    setCustomerMode("login");
    setRequireIdentity(false);
  }, [customer]);

  useEffect(() => {
    if (!detectedCity?.city) return;
    setCustomerForm(current => {
      if (current.city && current.state) return current;
      return {
        ...current,
        city: current.city || detectedCity.city,
        state: current.state || detectedCity.state
      };
    });
  }, [detectedCity]);

  useEffect(() => {
    if (!polledPurchase) return;
    if (polledPurchase.status === "paid" && purchase?.status !== "paid") {
      setPurchase(polledPurchase);
      if (polledPurchase.customer) setCustomer(polledPurchase.customer);
      setPaymentResult("approved");
      setCheckoutStep("ticket");
      toast.success("Pagamento confirmado", { description: "Seus bilhetes foram liberados." });
    }
    if (polledPurchase.status === "cancelled" && purchase?.status !== "cancelled") {
      setPurchase(polledPurchase);
      setPaymentResult("rejected");
      toast.error("Pagamento recusado", { description: "Tente gerar um novo PIX." });
    }
  }, [polledPurchase, purchase, setCustomer]);

  useEffect(() => {
    if (!purchase?.premiosInstantaneos?.length || notifiedPrizePurchase.current === purchase.purchaseId) return;
    notifiedPrizePurchase.current = purchase.purchaseId;
    const total = purchase.premiosInstantaneos.reduce((sum: number, prize: any) => sum + Number(prize.valorPremio || 0), 0);
    toast.success("Cota premiada encontrada", { description: `Premio instantaneo: ${formatCurrency(total)}` });
  }, [purchase]);

  const countdown = useCountdown(raffle?.drawDate || (raffle as any)?.endDate || (raffle as any)?.createdAt);
  const totalTickets = Math.max(1, Number(raffle?.totalTickets || 1));
  const soldTickets = Math.max(0, Number(raffle?.soldTickets || 0));
  const progress = raffle ? Math.min(100, Math.max(0, raffle.progressOverride ?? (soldTickets / totalTickets) * 100)) : 0;
  const subtotalValue = raffle ? tickets * raffle.price : 0;
  const addonValue = acceptAddon && addonSuggestion ? addonSuggestion.amount : 0;
  const orderBumpValue = acceptOrderBump && gamification?.orderBump?.enabled && raffle
    ? gamification.orderBump.tickets * raffle.price * (1 - (gamification.orderBump.discountPercent || 0) / 100)
    : 0;
  const couponDiscount = couponPreview?.discount || 0;
  const totalValue = Math.max(0, subtotalValue + addonValue + orderBumpValue - couponDiscount);
  const walletBalance = (customer?.affiliate?.commissionBalance ?? customer?.affiliate?.commission ?? 0) + (customer?.affiliate?.prizeBalance || 0);
  const canUseBalance = Boolean(customer?.affiliate?.useBalanceForPurchases && walletBalance >= totalValue);
  const promotionalPackages = useMemo(() => buildPackages(raffle?.price || 0.01, settings), [raffle?.price, settings]);
  const mediaUrl = raffle?.checkoutMediaUrl || raffle?.mediaUrl || raffle?.image || "";
  const mediaType = raffle?.checkoutMediaUrl ? raffle.checkoutMediaType : raffle?.mediaType;
  const mediaFit = mediaType === "video" || mediaType === "youtube" || mediaType === "vimeo" || mediaType === "bunny"
    ? "cover"
    : (raffle?.checkoutMediaFit || raffle?.mediaFit || "cover");
  const checkoutCriticalActive = checkoutOpen || receiptOpen || showNumbers || Boolean(paymentResult);

  const setQuantity = (value: number) => {
    const next = Math.min(100000, Math.max(1, Math.floor(Number(value) || 1)));
    setTickets(next);
    setSelectedQuick(next);
    setCouponPreview(null);
  };

  const handlePackageClick = (quantity: number) => {
    setQuantity(quantity);
    navigator.vibrate?.(18);
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponPreview(null);
      return;
    }
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, raffleId: id, tickets })
    });
    const data = await res.json();
    if (!res.ok) {
      setCouponPreview(null);
      toast.error(data.error || "Cupom invalido");
      return;
    }
    setCouponPreview(data);
    toast.success("Cupom aplicado");
  };

  const buildCheckoutCustomer = async () => {
    const geoLocation = await captureGeoLocation();
    GeoPrefillService.saveManual(customerForm.city, customerForm.state);
    return customer
      ? {
          ...customerForm,
          name: customer.name,
          phone: customer.phone,
          cpf: customer.cpf,
          city: customer.city || customerForm.city,
          state: customer.state || customerForm.state,
          browserId: customer.browserId,
          geoLocation
        }
      : { ...customerForm, geoLocation };
  };

  const validateCheckoutForm = () => {
    if (!raffle) return;
    const phone = (customer?.phone || customerForm.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Informe seu WhatsApp");
      return false;
    }
    if ((!customer || requireIdentity) && !/^\d{6}$/.test(customerForm.accessPassword)) {
      toast.error("Informe uma senha de acesso com 6 digitos");
      return false;
    }
    return true;
  };

  const openPrePaymentReceipt = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!raffle || !validateCheckoutForm()) return;
    startMetric("checkout_modal_open");
    setIsSubmitting(true);
    try {
      const preview = await checkoutService.preview({
        type: "raffle",
        raffleId: id,
        tickets,
        customer: customer ? { ...customerForm, name: customer.name, phone: customer.phone, cpf: customer.cpf } : customerForm,
        refCode: localStorage.getItem("refCode") || undefined,
        useBalance,
        couponCode: couponCode || undefined,
        addon: acceptAddon && addonSuggestion ? { raffleId: addonSuggestion.raffle.id, tickets: addonSuggestion.tickets } : undefined,
        orderBumpAccepted: acceptOrderBump
      });
      setCheckoutPreview(preview);
      setReceiptOpen(true);
      finishMetric("checkout_modal_open", { raffleId: id });
    } catch (err: any) {
      toast.error("Revise sua compra", { description: err.message || "Nao foi possivel calcular o resumo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeBuy = async () => {
    if (!raffle || !validateCheckoutForm()) return;
    startMetric("pix_generation");
    setIsSubmitting(true);
    try {
      const checkoutCustomer = await buildCheckoutCustomer();
      const phone = (customer?.phone || customerForm.phone || "").replace(/\D/g, "");
      const res = await fetch(`/api/raffles/${id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickets,
          contact: phone,
          customer: checkoutCustomer,
          refCode: localStorage.getItem("refCode") || undefined,
          useBalance,
          couponCode: couponCode || undefined,
          addon: acceptAddon && addonSuggestion ? { raffleId: addonSuggestion.raffle.id, tickets: addonSuggestion.tickets } : undefined,
          orderBumpAccepted: acceptOrderBump
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nao foi possivel gerar PIX");
      setPurchase(data);
      if (data.customer) setCustomer(data.customer);
      setRequireIdentity(false);
      setReceiptOpen(false);
      setCheckoutStep(data.status === "paid" ? "ticket" : "payment");
      finishMetric("pix_generation", { raffleId: id, status: data.status });
      toast.success("PIX gerado", { description: `${tickets} cotas reservadas para voce.` });
    } catch (err: any) {
      if (/senha/i.test(err.message || "")) {
        setRequireIdentity(true);
        setCustomerMode("login");
      }
      toast.error("Erro no checkout", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPix = async () => {
    if (!purchase?.pixPayload) {
      toast.error("PIX indisponivel");
      return;
    }
    await navigator.clipboard.writeText(purchase.pixPayload);
    setCopied(true);
    toast.success("PIX copia e cola copiado");
    window.setTimeout(() => setCopied(false), 1800);
  };

  const confirmPixStatus = async () => {
    if (!purchase?.purchaseId) {
      toast.error("Pedido indisponivel para consulta");
      return;
    }
    setConfirmingPix(true);
    try {
      const status = await checkoutService.checkPixPaymentStatus(purchase.purchaseId);
      const refreshedPurchase = status.purchase || purchase;
      setPurchase((current: any) => ({ ...current, ...refreshedPurchase, pixPayload: refreshedPurchase?.pixPayload || current?.pixPayload }));
      if (refreshedPurchase?.customer) setCustomer(refreshedPurchase.customer);
      if (status.paid || refreshedPurchase?.status === "paid") {
        setPaymentResult("approved");
        setCheckoutStep("ticket");
        toast.success("Pagamento confirmado", { description: "Bilhete liberado pelo status seguro do pedido." });
        return;
      }
      toast.info(status.message || "Pagamento ainda pendente", { description: "O sistema vai atualizar quando o webhook confirmar." });
    } catch (err: any) {
      toast.error("Nao foi possivel consultar o PIX", { description: err.message || "Tente novamente em instantes." });
    } finally {
      setConfirmingPix(false);
    }
  };

  const shareTicket = async () => {
    const text = `Estou participando de ${raffle?.title}. Pedido ${purchase?.purchaseId}.`;
    if (navigator.share) {
      await navigator.share({ title: raffle?.title, text }).catch(() => null);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Resumo copiado para compartilhar");
  };

  const openCheckout = () => {
    setCheckoutOpen(true);
    setCheckoutStep(purchase ? (purchase.status === "paid" ? "ticket" : "payment") : "review");
  };

  if (loading) return <RaffleSkeleton />;
  if (error || !raffle) return <div className="premium-page min-h-screen px-6 py-28 text-center text-red-200">{error}</div>;

  return (
    <div className="premium-page min-h-screen pb-32 text-white">
      <div className="premium-ambient" />
      <div className="relative z-10">
        <PremiumRaffleHeader cartCount={tickets} slogan={branding.slogan} />

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pt-[calc(env(safe-area-inset-top)+5rem)] sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-7">
          <section className="space-y-4">
            <HeroCard raffle={raffle} mediaUrl={mediaUrl} mediaType={mediaType} mediaFit={mediaFit} progress={progress} />
            <Link to="/minhas-cotas" className="-mt-2 flex min-h-12 items-center justify-center gap-2 rounded-b-2xl border border-white/10 bg-black/85 text-sm font-black text-white shadow-[0_16px_40px_rgba(0,0,0,0.32)]">
              <ShoppingCart className="h-4 w-4" /> Meus Bilhetes
            </Link>
            <CountdownStrip countdown={countdown} />
            <DrawInfo raffle={raffle} />
            <PriceImpact price={raffle.price} />
            <PromotionBadges badges={publicPromotions} />
            <PromotionSummaryCard summary={checkoutPreview?.promotionSummary} />
            <GamificationPanel data={gamification} />
            <PromotionalPackages packages={promotionalPackages} selected={selectedQuick} onSelect={handlePackageClick} />
            <QuickGrid selected={selectedQuick} onSelect={handlePackageClick} />
            <ManualSelector tickets={tickets} onChange={setQuantity} />
            <PublicConversionWidgets raffleId={id} />
            <InstantRouletteSection cards={casinoCards} />
            <RankingSection ranking={ranking} prizes={instantPrizeNumbers} />
          </section>

          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <PurchaseSummary
              raffle={raffle}
              tickets={tickets}
              totalValue={totalValue}
              progress={progress}
              onParticipate={openCheckout}
              loading={isSubmitting}
            />
          </aside>
        </main>

        {!checkoutCriticalActive && <FloatingActions settings={settings} />}

        {!checkoutCriticalActive && (
          <button
            type="button"
            onClick={openCheckout}
            className="premium-floating-cta text-left lg:hidden"
          >
            <span>
              <span className="block text-[10px] uppercase tracking-[0.22em] opacity-75">Resumo da compra</span>
              <span className="block text-base">{tickets.toLocaleString("pt-BR")} cotas</span>
            </span>
            <span className="rounded-xl bg-black/10 px-3 py-2 text-sm">{formatCurrency(totalValue)}</span>
          </button>
        )}

        <CheckoutModal
        open={checkoutOpen}
        step={checkoutStep}
        raffle={raffle}
        tickets={tickets}
        totalValue={totalValue}
        purchase={purchase}
        customer={customer}
        customerForm={customerForm}
        setCustomerForm={setCustomerForm}
        customerMode={customerMode}
        setCustomerMode={setCustomerMode}
        requireIdentity={requireIdentity}
        isSubmitting={isSubmitting}
        addonSuggestion={addonSuggestion}
        acceptAddon={acceptAddon}
        setAcceptAddon={setAcceptAddon}
        gamification={gamification}
        acceptOrderBump={acceptOrderBump}
        setAcceptOrderBump={setAcceptOrderBump}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        couponPreview={couponPreview}
        validateCoupon={validateCoupon}
        canUseBalance={canUseBalance}
        useBalance={useBalance}
        setUseBalance={setUseBalance}
        settings={settings}
        copied={copied}
        confirmingPix={confirmingPix}
        onClose={() => setCheckoutOpen(false)}
        onSubmit={openPrePaymentReceipt}
        onCopyPix={copyPix}
        onConfirmPix={confirmPixStatus}
        onBackToReview={() => setCheckoutStep("review")}
        onShare={shareTicket}
        onShowNumbers={() => setShowNumbers(true)}
      />
      <PrePaymentReceiptModal
        open={receiptOpen}
        campaign={raffle.title}
        raffle={raffle.title}
        raffleData={raffle}
        selectedQuantity={tickets}
        selectedPackage={checkoutPreview?.packageLabel || `${tickets.toLocaleString("pt-BR")} cotas`}
        calculatedPrice={totalValue}
        customerData={{
          name: customer?.name || customerForm.name,
          phone: customer?.phone || customerForm.phone,
          email: (customer as any)?.email || "",
          cpf: customer?.cpf || customerForm.cpf,
          city: customer?.city || customerForm.city,
          state: customer?.state || customerForm.state
        }}
        bonuses={checkoutPreview?.bonuses}
        affiliateInfo={checkoutPreview?.affiliateInfo}
        walletUsage={checkoutPreview?.walletUsage}
        gatewayInfo={checkoutPreview?.gateway}
        preview={checkoutPreview}
        loading={isSubmitting}
        onConfirm={executeBuy}
        onEdit={() => setReceiptOpen(false)}
        onClose={() => setReceiptOpen(false)}
      />
      </div>

      <NumberRevealModal
        isOpen={showNumbers}
        onClose={() => {
          setShowNumbers(false);
          if (purchase?.earnedLootboxes > 0) window.setTimeout(() => setShowLootboxModal(true), 300);
        }}
        numeros={purchase?.numeros || []}
        premiosInstantaneos={purchase?.premiosInstantaneos}
      />
      <PixPaymentResultModal result={paymentResult} onClose={() => setPaymentResult(null)} />
      {purchase?.earnedLootboxes > 0 && (
        <PostPurchaseLootboxModal
          isOpen={showLootboxModal}
          onClose={() => setShowLootboxModal(false)}
          earnedCount={purchase.earnedLootboxes}
          contact={purchase.contact}
          config={raffle.lootboxConfig}
        />
      )}
    </div>
  );
}

function PremiumRaffleHeader({ cartCount, slogan }: { cartCount: number; slogan?: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/72 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-5">
        <Link to="/" className="flex items-center gap-2">
          <TenantLogo className="h-10 w-10" eager />
          <span className="leading-none">
            <TenantHeaderName className="block text-sm font-black tracking-wide" />
            <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">{slogan || "premiacoes"}</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/minhas-cotas" className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 sm:inline-flex">
            Meus bilhetes
          </Link>
          <Link to="/minhas-cotas" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04]" aria-label="Meus bilhetes">
            <Ticket className="h-4 w-4" />
          </Link>
          <button className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04]" aria-label="Carrinho">
            <ShoppingCart className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-black">{cartCount > 999 ? "999+" : cartCount}</span>
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04]" aria-label="Menu">
            <Menu className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}

function HeroCard({ raffle, mediaUrl, mediaType, mediaFit: _mediaFit, progress }: { raffle: Raffle; mediaUrl: string; mediaType?: any; mediaFit: "cover" | "contain" | "fill"; progress: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
      <StandardRaffleMediaBlock
        mediaUrl={mediaUrl}
        mediaType={(mediaType || "image") as any}
        title={raffle.title}
        description={raffle.description || (raffle as any).subtitle || "Premio principal"}
        price={raffle.price}
        showDescriptionBelow
        noOverlay
        progress={progress}
        soldTickets={raffle.soldTickets}
        totalTickets={raffle.totalTickets}
        href={`/raffle/${raffle.id}`}
        priority
        className="border-white/10 bg-white/[0.045] shadow-[0_34px_120px_rgba(0,0,0,0.45)]"
      />
    </motion.div>
  );
}

function CountdownStrip({ countdown }: { countdown: CountdownParts }) {
  const items = [
    ["dias", countdown.days],
    ["horas", countdown.hours],
    ["min", countdown.minutes],
    ["seg", countdown.seconds]
  ];
  return (
    <section className="premium-card rounded-[1.5rem] p-4">
      <p className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.28em] text-[var(--theme-primary)]">Vendas encerram em</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/35 p-3 text-center">
            <span className="block text-2xl font-black text-white">{String(value).padStart(2, "0")}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DrawInfo({ raffle }: { raffle: Raffle }) {
  return (
    <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Sorteio pela Loteria Federal</p>
        <p className="mt-1 text-lg font-black text-white">{formatDrawDate(raffle.drawDate || (raffle as any).createdAt)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge icon={<Radio className="h-3.5 w-3.5" />} label="Ao vivo" tone="red" />
        <Badge icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Auditado" tone="cyan" />
        <Badge icon={<Sparkles className="h-3.5 w-3.5" />} label="Em andamento" tone="green" />
      </div>
    </section>
  );
}

function PriceImpact({ price }: { price: number }) {
  return (
    <section className="rounded-[1.5rem] border border-lime-300/20 bg-gradient-to-br from-lime-300/10 to-emerald-400/5 p-5 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-lime-100">Por apenas</p>
      <motion.p animate={{ scale: [1, 1.025, 1] }} transition={{ duration: 2.2, repeat: Infinity }} className="mt-1 text-5xl font-black tracking-tight text-white">
        {formatCurrency(price)}
      </motion.p>
      <p className="mt-2 text-xs font-semibold text-slate-300">quanto mais cotas, maior sua chance no sorteio</p>
    </section>
  );
}

function PromotionalPackages({ packages, selected, onSelect }: { packages: Array<{ qty: number; label: string; bonus: string; economy: string; value: number }>; selected: number; onSelect: (qty: number) => void }) {
  return (
    <section className="space-y-3">
      <SectionTitle eyebrow="Pacotes promocionais" title="Escolha um turbo" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {packages.map(pack => (
          <button key={pack.qty} type="button" onClick={() => onSelect(pack.qty)} className={cn("relative overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.98]", selected === pack.qty ? "border-[var(--theme-primary)] bg-[var(--theme-surface-strong)] shadow-[0_0_32px_var(--theme-glow)]" : "border-white/10 bg-white/[0.045]")}>
            {pack.qty === 700 && <span className="absolute right-2 top-2 rounded-full bg-amber-300 px-2 py-1 text-[9px] font-black text-slate-950">POPULAR</span>}
            <p className="text-2xl font-black">{pack.qty.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">titulos</p>
            <p className="mt-3 text-lg font-black text-[var(--theme-primary)]">{formatCurrency(pack.value)}</p>
            <p className="mt-1 text-xs text-slate-300">{pack.economy}</p>
            <p className="mt-2 rounded-xl bg-black/25 px-2 py-1 text-[11px] font-bold text-amber-100">{pack.bonus}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuickGrid({ selected, onSelect }: { selected: number; onSelect: (qty: number) => void }) {
  return (
    <section className="space-y-3">
      <SectionTitle eyebrow="Compra rapida" title="Adicionar cotas" />
      <div className="grid grid-cols-3 gap-2">
        {quickAmounts.map(qty => (
          <button key={qty} type="button" onClick={() => onSelect(qty)} className={cn("min-h-14 rounded-2xl border text-sm font-black transition active:scale-95", selected === qty ? "border-lime-200 bg-lime-300 text-slate-950" : "border-white/10 bg-white/[0.045] text-white")}>
            +{qty.toLocaleString("pt-BR")}
          </button>
        ))}
      </div>
    </section>
  );
}

function ManualSelector({ tickets, onChange }: { tickets: number; onChange: (value: number) => void }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Quantidade manual</p>
      <div className="grid grid-cols-[56px_1fr_56px] gap-2">
        <button type="button" onClick={() => onChange(tickets - 1)} className="grid h-14 place-items-center rounded-2xl border border-white/10 bg-black/30"><Minus className="h-5 w-5" /></button>
        <input value={tickets} onChange={e => onChange(Number(e.target.value))} inputMode="numeric" className="h-14 rounded-2xl border border-white/10 bg-black/30 text-center text-xl font-black outline-none focus:border-[var(--theme-primary)]" />
        <button type="button" onClick={() => onChange(tickets + 1)} className="grid h-14 place-items-center rounded-2xl border border-white/10 bg-black/30"><Plus className="h-5 w-5" /></button>
      </div>
    </section>
  );
}

function InstantRouletteSection({ cards }: { cards: typeof casinoCards }) {
  return (
    <section className="space-y-3">
      <SectionTitle eyebrow="Roletas instantaneas" title="Chances extras liberadas" />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(card => (
          <motion.div key={card.qty} whileHover={{ y: -2 }} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className={cn("absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-30 blur-xl", card.tone)} />
            <div className={cn("mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-slate-950 shadow-[0_0_30px_rgba(255,255,255,0.16)]", card.tone)}>
              <Gift className="h-6 w-6" />
            </div>
            <p className="text-lg font-black">{card.qty.toLocaleString("pt-BR")} numeros</p>
            <p className="text-sm text-slate-300">{card.chances} chance(s) na roleta</p>
            <p className="mt-3 text-xs font-bold text-amber-100">{card.prize}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function RankingSection({ ranking, prizes }: { ranking: Array<{ name: string; tickets: number; phone: string }>; prizes: Array<{ id: string; numeroPremiado: number; valorPremio: number; status: string }> }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
        <SectionTitle eyebrow="Top compradores" title="Ranking ao vivo" compact />
        <div className="mt-3 space-y-2">
          {ranking.slice(0, 4).length ? ranking.slice(0, 4).map((buyer, index) => (
            <div key={`${buyer.phone}-${index}`} className="flex items-center justify-between rounded-2xl bg-black/25 px-3 py-2 text-sm">
              <span className="truncate">{index + 1}. {buyer.name}</span>
              <span className="font-black text-amber-100">{buyer.tickets}</span>
            </div>
          )) : <p className="text-sm text-slate-400">Ranking em formacao.</p>}
        </div>
      </div>
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
        <SectionTitle eyebrow="Bilhetes premiados" title="Premios instantaneos" compact />
        <div className="mt-3 space-y-2">
          {prizes.slice(0, 4).length ? prizes.slice(0, 4).map(prize => (
            <div key={prize.id} className="flex items-center justify-between rounded-2xl bg-black/25 px-3 py-2 text-sm">
              <span>#{String(prize.numeroPremiado).padStart(6, "0")}</span>
              <span className="font-black text-[var(--theme-primary)]">{formatCurrency(prize.valorPremio)}</span>
            </div>
          )) : <p className="text-sm text-slate-400">Cotas premiadas em breve.</p>}
        </div>
      </div>
    </section>
  );
}

function PurchaseSummary({ raffle, tickets, totalValue, progress, onParticipate, loading }: { raffle: Raffle; tickets: number; totalValue: number; progress: number; onParticipate: () => void; loading: boolean }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-5 shadow-[0_32px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--theme-primary)]">Checkout rapido</p>
      <h2 className="mt-2 text-2xl font-black">{raffle.title}</h2>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <InfoCard label="Cotas" value={tickets.toLocaleString("pt-BR")} />
        <InfoCard label="Total" value={formatCurrency(totalValue)} />
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div style={{ width: `${progress}%` }} className="h-full rounded-full premium-cta-bg" />
      </div>
      <CheckoutPrimaryActionButton disabled={loading} onClick={onParticipate} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 disabled:opacity-60">
        <ShoppingCart className="h-5 w-5" /> Participar
      </CheckoutPrimaryActionButton>
    </div>
  );
}

function CheckoutModal(props: {
  open: boolean;
  step: CheckoutStep;
  raffle: Raffle;
  tickets: number;
  totalValue: number;
  purchase: any;
  customer: any;
  customerForm: any;
  setCustomerForm: React.Dispatch<React.SetStateAction<any>>;
  customerMode: "register" | "login";
  setCustomerMode: (mode: "register" | "login") => void;
  requireIdentity: boolean;
  isSubmitting: boolean;
  addonSuggestion: { raffle: Raffle; tickets: number; amount: number } | null;
  acceptAddon: boolean;
  setAcceptAddon: (value: boolean) => void;
  gamification: any;
  acceptOrderBump: boolean;
  setAcceptOrderBump: (value: boolean) => void;
  couponCode: string;
  setCouponCode: (value: string) => void;
  couponPreview: any;
  validateCoupon: () => void;
  canUseBalance: boolean;
  useBalance: boolean;
  setUseBalance: (value: boolean) => void;
  settings?: any;
  copied: boolean;
  confirmingPix: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onCopyPix: () => void;
  onConfirmPix: () => void;
  onBackToReview: () => void;
  onShare: () => void;
  onShowNumbers: () => void;
}) {
  return (
    <AnimatePresence>
      {props.open && (
        <>
        {/* CheckoutModalHeader and checkout-modal-overlay are rendered by CheckoutModalShell for the checkout-modal-shell contract. */}
        <CheckoutModalShell
          open={props.open}
          title={`${props.tickets.toLocaleString("pt-BR")} cotas - ${formatCurrency(props.totalValue)}`}
          eyebrow={props.step === "review" ? "Confirmar participacao" : props.step === "payment" ? "Pagamento PIX" : "Bilhete premium"}
          onClose={props.onClose}
          compact={props.step !== "review"}
          shellClassName="checkout-modal-shell"
        >
              <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <CheckoutCampaignMedia
                  raffle={props.raffle}
                  fallbackTitle={props.raffle.title}
                  compact
                  showStatus
                  showPrice
                  statusLabel={props.step === "payment" ? "Aguardando pagamento" : props.step === "ticket" ? "Bilhete confirmado" : "Checkout seguro"}
                  priceLabel={`${props.tickets.toLocaleString("pt-BR")} cotas - ${formatCurrency(props.totalValue)}`}
                />
              </div>

              {props.step === "review" && <CheckoutReview {...props} />}
              {props.step === "payment" && <PaymentPix {...props} />}
              {props.step === "ticket" && <PremiumTicket {...props} />}
        </CheckoutModalShell>
        </>
      )}
    </AnimatePresence>
  );
}

function CheckoutReview(props: Parameters<typeof CheckoutModal>[0]) {
  return (
    <form onSubmit={props.onSubmit} className="checkout-form space-y-4 p-4">
      <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
        <div className="checkout-info-grid grid grid-cols-2 gap-3">
          <InfoCard label="Cotas" value={props.tickets.toLocaleString("pt-BR")} />
          <InfoCard label="Total PIX" value={formatCurrency(props.totalValue)} />
        </div>
      </div>

      {props.customer && !props.requireIdentity ? (
        <div className="customer-identified-card rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.08] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--theme-primary)]">Cliente identificado</p>
          <p className="mt-1 text-xl font-black">Ola, {(props.customer.name || "cliente").split(/\s+/)[0]}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1">
            <button type="button" onClick={() => props.setCustomerMode("register")} className={cn("rounded-xl py-3 text-xs font-black uppercase", props.customerMode === "register" ? "bg-white text-slate-950" : "text-slate-400")}>Novo</button>
            <button type="button" onClick={() => props.setCustomerMode("login")} className={cn("rounded-xl py-3 text-xs font-black uppercase", props.customerMode === "login" ? "bg-white text-slate-950" : "text-slate-400")}>Ja tenho</button>
          </div>
          {props.customerMode === "register" && (
            <>
              <Field label="Nome completo" value={props.customerForm.name} onChange={value => props.setCustomerForm((current: any) => ({ ...current, name: value }))} required />
              <Field label="CPF" value={props.customerForm.cpf} onChange={value => props.setCustomerForm((current: any) => ({ ...current, cpf: value }))} required />
          <div className="grid gap-2 sm:grid-cols-[1fr_88px]">
                <Field label="Cidade" value={props.customerForm.city} onChange={value => props.setCustomerForm((current: any) => ({ ...current, city: value }))} required />
                <Field label="UF" value={props.customerForm.state} onChange={value => props.setCustomerForm((current: any) => ({ ...current, state: value.toUpperCase().slice(0, 2) }))} />
              </div>
            </>
          )}
          <Field label="WhatsApp" value={props.customerForm.phone} onChange={value => props.setCustomerForm((current: any) => ({ ...current, phone: value }))} required inputMode="tel" />
        </>
      )}

      {(!props.customer || props.requireIdentity) && (
        <Field label="Senha de acesso com 6 digitos" value={props.customerForm.accessPassword} onChange={value => props.setCustomerForm((current: any) => ({ ...current, accessPassword: value.replace(/\D/g, "").slice(0, 6) }))} required inputMode="numeric" maxLength={6} />
      )}

      <div className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--theme-primary)]">Cupom</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={props.couponCode} onChange={e => props.setCouponCode(e.target.value.toUpperCase())} placeholder="BEMVINDO10" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold uppercase outline-none" />
          <button type="button" onClick={props.validateCoupon} className="rounded-2xl border border-[var(--theme-border)] px-4 py-3 text-sm font-black text-[var(--theme-text)]">Aplicar</button>
        </div>
        {props.couponPreview && <p className="mt-2 text-xs text-emerald-100">Cupom aplicado no resumo.</p>}
      </div>

      {props.addonSuggestion && (
        <ToggleCard checked={props.acceptAddon} onChange={props.setAcceptAddon} title={`Adicionar ${props.addonSuggestion.tickets} cotas extras`} description={`${props.addonSuggestion.raffle.title} por + ${formatCurrency(props.addonSuggestion.amount)}`} />
      )}

      <GamificationPanel data={props.gamification} onOrderBumpChange={props.setAcceptOrderBump} orderBumpAccepted={props.acceptOrderBump} />

      {props.canUseBalance && (
        <ToggleCard checked={props.useBalance} onChange={props.setUseBalance} title="Usar saldo afiliado" description="Abater valor com saldo disponivel." />
      )}

      <CheckoutPrimaryActionButton type="submit" disabled={props.isSubmitting} className="flex min-h-14 w-full items-center justify-center gap-2 disabled:opacity-60">
        <WalletCards className="h-5 w-5" /> {props.isSubmitting ? "Calculando resumo..." : "Revisar compra"}
      </CheckoutPrimaryActionButton>
    </form>
  );
}

function PaymentPix(props: Parameters<typeof CheckoutModal>[0]) {
  const expiresAt = useMemo(() => {
    return props.purchase?.expiresAt || props.purchase?.expires_at || props.purchase?.pixExpiresAt || props.purchase?.reservedUntil || new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }, [props.purchase?.expiresAt, props.purchase?.expires_at, props.purchase?.pixExpiresAt, props.purchase?.reservedUntil, props.purchase?.purchaseId]);
  const expiresIn = useCountdown(expiresAt);
  const gateway = props.purchase?.pixGateway || props.purchase?.gateway || props.purchase?.paymentGateway || "PIX";
  return (
    <div className="space-y-5 p-4 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-primary)]">
        <QrCode className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-3xl font-black">Pague com PIX</h3>
        <p className="mt-2 text-sm text-slate-400">Confirmacao automatica em tempo real. Pedido #{props.purchase?.purchaseId}</p>
      </div>
      <div className="checkout-info-grid grid gap-2 rounded-3xl border border-white/10 bg-white/[0.045] p-3 text-left sm:grid-cols-3">
        <InfoCard label="Status" value={props.purchase?.status === "paid" ? "Pago" : "Aguardando"} />
        <InfoCard label="Gateway" value={String(gateway).toUpperCase()} />
        <InfoCard label="Total" value={formatCurrency(props.totalValue)} />
      </div>
      {props.purchase?.pixPayload ? (
        <div className="mx-auto w-full max-w-[min(18rem,calc(100vw-3rem))] rounded-[1.35rem] bg-white p-3 shadow-[0_0_42px_rgba(34,211,238,0.18)] sm:w-fit sm:max-w-none sm:rounded-[1.75rem] sm:p-5">
          <QRCodeSVG value={props.purchase.pixPayload} className="h-auto w-full sm:h-[250px] sm:w-[250px]" bgColor="#ffffff" fgColor="#0f172a" level="M" />
        </div>
      ) : (
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">PIX indisponivel. Revise o gateway do tenant.</div>
      )}
      <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Tempo para pagar</p>
        <p className="mt-1 text-2xl font-black text-[var(--theme-primary)]">{String(expiresIn.minutes).padStart(2, "0")}:{String(expiresIn.seconds).padStart(2, "0")}</p>
        <p className="mt-2 text-xs text-slate-400">A tela atualiza sozinha quando o webhook confirmar o pagamento.</p>
      </div>
      <button type="button" onClick={props.onCopyPix} className={cn("checkout-primary-button flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl font-black transition", props.copied ? "premium-button" : "border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]")}>
        <Copy className="h-5 w-5" /> {props.copied ? "PIX copiado" : "Copiar PIX copia e cola"}
      </button>
      <div className="checkout-actions grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={props.onBackToReview} className="min-h-12 rounded-2xl border border-white/10 py-3 text-sm font-bold text-slate-300">Alterar dados</button>
        <CheckoutPrimaryActionButton onClick={props.onConfirmPix} disabled={props.confirmingPix} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black disabled:opacity-60">
          <CheckCircle2 className="h-4 w-4" /> {props.confirmingPix ? "Consultando status..." : "Confirmar PIX"}
        </CheckoutPrimaryActionButton>
      </div>
    </div>
  );
}

function PremiumTicket(props: Parameters<typeof CheckoutModal>[0]) {
  const numbers = props.purchase?.numeros || [];
  const buyer = props.purchase?.customer || props.customer || {};
  const gateway = props.purchase?.pixGateway || props.purchase?.gateway || props.purchase?.paymentGateway || "PIX";
  const paidAt = props.purchase?.paidAt || props.purchase?.paid_at || props.purchase?.createdAt || props.purchase?.created_at;
  return (
    <div className="space-y-5 p-4">
      <div className="premium-card relative overflow-hidden rounded-[1.75rem] border-emerald-200/25 bg-gradient-to-br from-emerald-300/14 via-white/[0.055] to-cyan-300/10 p-5">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-200/12 blur-2xl" />
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/12" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex rounded-full border border-emerald-200/25 bg-emerald-300/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-100">Compra Confirmada</p>
            <h3 className="mt-2 text-3xl font-black">{props.raffle.title}</h3>
            <p className="mt-2 text-sm text-slate-300">Pedido #{props.purchase?.purchaseId}</p>
          </div>
          <div className="rounded-2xl bg-white p-2">
            <QRCodeSVG value={String(props.purchase?.purchaseId || "rifapro")} size={86} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
        </div>
        <div className="checkout-info-grid mt-6 grid gap-2 sm:grid-cols-2">
          <InfoCard label="Comprador" value={buyer.name || props.customerForm.name || "Cliente"} />
          <InfoCard label="WhatsApp" value={maskPhone(buyer.phone || props.customerForm.phone || props.purchase?.contact)} />
          <InfoCard label="E-mail" value={maskEmail(buyer.email || props.purchase?.email || "")} />
          <InfoCard label="Gateway" value={String(gateway).toUpperCase()} />
          <InfoCard label="Cotas" value={String(props.tickets.toLocaleString("pt-BR"))} />
          <InfoCard label="Valor pago" value={formatCurrency(props.totalValue)} />
          <InfoCard label="Data" value={formatReceiptDate(paidAt)} />
          <InfoCard label="Validacao" value={String(props.purchase?.purchaseId || "").slice(0, 12) || "rifapro"} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {numbers.slice(0, 18).map((number: number) => (
            <span key={number} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black">{String(number).padStart(6, "0")}</span>
          ))}
          {numbers.length > 18 && <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black">+{numbers.length - 18}</span>}
        </div>
      </div>
      <GamificationPanel data={props.gamification} purchase={props.purchase} />
      {props.purchase?.gamification?.doubleTickets?.applied && (
        <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-emerald-50">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100">Cotas em dobro</p>
          <p className="mt-2 text-sm font-semibold">
            Seu bilhete inclui +{props.purchase.gamification.doubleTickets.bonusTickets} cotas extras, já contando no sorteio.
          </p>
        </div>
      )}
      <div className="checkout-actions grid grid-cols-2 gap-2">
        <button type="button" onClick={props.onShare} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] font-bold"><Share2 className="h-4 w-4" /> Compartilhar</button>
        <button type="button" onClick={() => toast.info("PDF sera gerado no modulo de comprovantes.")} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] font-bold"><Download className="h-4 w-4" /> PDF</button>
      </div>
      <CheckoutPrimaryActionButton onClick={props.onShowNumbers} className="flex min-h-14 w-full items-center justify-center gap-2">
        <Ticket className="h-5 w-5" /> Ver meus numeros
      </CheckoutPrimaryActionButton>
    </div>
  );
}

function FloatingActions({ settings }: { settings?: any }) {
  const groupUrl = settings?.socialLinks?.group || "";
  const whatsappUrl = settings?.socialLinks?.whatsapp || "";
  return (
    <div className="checkout-blocking-floating-actions fixed bottom-24 right-3 z-40 flex flex-col items-end gap-2 lg:bottom-5">
      {groupUrl && <a href={groupUrl} target="_blank" rel="noreferrer" className="mobile-hidden-action premium-button h-11 w-[132px] items-center justify-center gap-2 rounded-full px-4 text-sm font-black sm:inline-flex"><Users className="h-4 w-4" /> Grupo</a>}
      <a href="#contato" className="mobile-hidden-action premium-button h-11 w-[132px] items-center justify-center gap-2 rounded-full px-4 text-sm font-black sm:inline-flex"><Headphones className="h-4 w-4" /> Contato</a>
      <Link to="/minhas-cotas" className="mobile-hidden-action premium-button h-11 w-[132px] items-center justify-center gap-2 rounded-full px-4 text-sm font-black sm:inline-flex"><Ticket className="h-4 w-4" /> Meus Jogos</Link>
      {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="premium-button grid h-12 w-12 place-items-center rounded-full p-0 sm:h-14 sm:w-14" aria-label="WhatsApp"><Send className="h-5 w-5" /></a>}
    </div>
  );
}

function SectionTitle({ eyebrow, title, compact = false }: { eyebrow: string; title: string; compact?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--theme-primary)]">{eyebrow}</p>
      <h2 className={cn("font-black tracking-tight text-white", compact ? "text-xl" : "text-2xl")}>{title}</h2>
    </div>
  );
}

function Badge({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "red" | "cyan" | "green" }) {
  const toneClass = tone === "red" ? "border-red-300/25 bg-red-400/10 text-red-100" : tone === "cyan" ? "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]" : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]", toneClass)}>{icon}{label}</span>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="checkout-info-card rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, required, inputMode, maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; maxLength?: number }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} required={required} inputMode={inputMode} maxLength={maxLength} className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-cyan-300/10" />
    </label>
  );
}

function ToggleCard({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="block font-black text-white">{title}</span>
        <span className="mt-1 block text-sm text-slate-400">{description}</span>
      </span>
    </label>
  );
}

function RaffleSkeleton() {
  return (
    <div className="premium-page min-h-screen px-3 pt-24">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-[520px] animate-pulse rounded-[2rem] bg-white/[0.06]" />
        <div className="h-24 animate-pulse rounded-[1.5rem] bg-white/[0.05]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-32 animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}

function useCountdown(date?: string): CountdownParts {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const target = date ? new Date(date).getTime() : now + 15 * 60 * 1000;
  const diff = Math.max(0, (Number.isFinite(target) ? target : now) - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    ended: diff <= 0
  };
}

function buildPackages(price: number, settings: any) {
  const cashback = settings?.cashbackEnabled ? "cashback ativo" : "bonus progressivo";
  return [
    { qty: 100, label: "Start", economy: "entrada rapida", bonus: "1 roleta", value: 100 * price },
    { qty: 700, label: "Popular", economy: "mais escolhido", bonus: `8 roletas + ${cashback}`, value: 700 * price },
    { qty: 1800, label: "Turbo", economy: "chance ampliada", bonus: "22 roletas premiadas", value: 1800 * price },
    { qty: 3000, label: "Pro", economy: "alto impacto", bonus: "40 roletas + destaque", value: 3000 * price },
    { qty: 5000, label: "Elite", economy: "volume vencedor", bonus: "70 roletas", value: 5000 * price },
    { qty: 10000, label: "Max", economy: "maior exposicao", bonus: "150 roletas VIP", value: 10000 * price }
  ];
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDrawDate(date?: string) {
  if (!date) return "Data em breve";
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return "Data em breve";
  return parsed.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

function maskPhone(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return "Nao informado";
  return `(${digits.slice(0, 2)}) *****-${digits.slice(-4)}`;
}

function maskEmail(value?: string) {
  const email = String(value || "");
  const [user, domain] = email.split("@");
  if (!user || !domain) return "Nao informado";
  return `${user.slice(0, 2)}***@${domain}`;
}

function formatReceiptDate(value?: string) {
  if (!value) return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Agora";
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function captureGeoLocation() {
  return GeoPrefillService.captureCoordinates();
}
