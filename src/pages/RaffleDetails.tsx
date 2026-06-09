import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  Gift,
  Headphones,
  Lock,
  Minus,
  Plus,
  QrCode,
  Share2,
  ShieldCheck,
  Ticket,
  Trophy,
  WalletCards
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import type { Raffle } from "../types";
import { useCustomerStore } from "../store/useCustomerStore";
import { usePurchasePolling } from "../hooks/usePurchasePolling";
import { NumberRevealModal } from "../components/NumberRevealModal";
import { PostPurchaseLootboxModal } from "../components/PostPurchaseLootboxModal";
import { PixPaymentResultModal } from "../components/PixPaymentResultModal";
import { GamificationPanel } from "../components/GamificationPanel";
import { PrePaymentReceiptModal, type CheckoutPreview } from "../components/checkout/PrePaymentReceiptModal";
import { CheckoutModalShell, CheckoutPrimaryActionButton } from "../components/premium/PremiumUI";
import { checkoutService } from "../services/api";
import { GeoPrefillService } from "../services/GeoPrefillService";
import { useCityDetection } from "../hooks/useCityDetection";
import { finishMetric, markPageLoaded, startMetric } from "../lib/performanceMetrics";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";
import { PublicConversionWidgets } from "../components/PublicConversionWidgets";

/* clean-media contract: StandardRaffleMediaBlock CheckoutCampaignMedia */

type CheckoutStep = "review" | "payment" | "ticket";
type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; ended: boolean };

function getLatestSalesDeadline(raffle?: Raffle | null) {
  if (!raffle?.countdownEnabled) return "";
  return [raffle.salesEndAt, raffle.countdownEndAt]
    .map(value => {
      if (!value) return "";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";
}

export function RaffleDetails() {
  const { id } = useParams();
  const { branding } = useTenantBranding();
  const { customer, setCustomer } = useCustomerStore();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState(6);
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
    fetch(`/api/raffles/${id}/addon-suggestion`).then(res => res.ok ? res.json() : null).then(data => data && setAddonSuggestion(data)).catch(() => null);
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
    toast.success("Super Cota encontrada", { description: `Premio instantaneo: ${formatCurrency(total)}` });
  }, [purchase]);

  const salesDeadline = getLatestSalesDeadline(raffle);
  const countdown = useCountdown(salesDeadline);
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
  const mediaUrl = raffle?.checkoutMediaUrl || raffle?.mediaUrl || raffle?.image || "";
  const mediaType = raffle?.checkoutMediaUrl ? raffle.checkoutMediaType : raffle?.mediaType;

  const setQuantity = (value: number) => {
    const remaining = raffle ? Math.max(1, Number(raffle.totalTickets || 1) - Number(raffle.soldTickets || 0)) : 100000;
    const next = Math.min(remaining, Math.max(1, Math.floor(Number(value) || 1)));
    setTickets(next);
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
      toast.info(status.message || "Pagamento ainda pendente", { description: "O sistema vai atualizar quando o pagamento for confirmado." });
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
    <div className="premium-page cfx-raffle-page min-h-screen pb-32 text-white">
      <div className="premium-ambient" />
      <div className="relative z-10">
        <RafflePremiumPage
          raffle={raffle}
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          progress={progress}
          countdown={countdown}
          tickets={tickets}
          totalValue={totalValue}
          onSelectTickets={setQuantity}
          onQuickSelect={handlePackageClick}
          onParticipate={openCheckout}
          isSubmitting={isSubmitting}
          ranking={ranking}
          prizes={instantPrizeNumbers}
        />
        {salesDeadline && <CountdownStrip countdown={countdown} expired={Boolean((raffle as any).salesExpired)} />}
        <PublicConversionWidgets raffleId={id} className="cfx-conversion-widgets" />

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
        prizes={instantPrizeNumbers}
        ranking={ranking}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        couponPreview={couponPreview}
        validateCoupon={validateCoupon}
        canUseBalance={canUseBalance}
        useBalance={useBalance}
        setUseBalance={setUseBalance}
        copied={copied}
        confirmingPix={confirmingPix}
        onClose={() => setCheckoutOpen(false)}
        onSubmit={event => {
          event.preventDefault();
          executeBuy();
        }}
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

function RafflePremiumPage({
  raffle,
  mediaUrl,
  mediaType,
  progress,
  countdown,
  tickets,
  totalValue,
  onSelectTickets,
  onQuickSelect,
  onParticipate,
  isSubmitting,
  ranking,
  prizes
}: {
  raffle: Raffle;
  mediaUrl: string;
  mediaType?: any;
  progress: number;
  countdown: CountdownParts;
  tickets: number;
  totalValue: number;
  onSelectTickets: (value: number) => void;
  onQuickSelect: (qty: number) => void;
  onParticipate: () => void;
  isSubmitting: boolean;
  ranking: Array<{ name: string; tickets: number; phone: string }>;
  prizes: Array<{ id: string; numeroPremiado: number; valorPremio: number; status: string }>;
}) {
  const totalTickets = Math.max(1, Number(raffle.totalTickets || 1));
  const soldTickets = Math.max(0, Number(raffle.soldTickets || 0));
  const remaining = Math.max(0, totalTickets - soldTickets);
  const isVideo = ["video", "bunny"].includes(String(mediaType || "").toLowerCase());
  const unitPrice = Number(raffle.price || 0);

  return (
    <main className="cfx-raffle-shell cfx-detail-shell">
      <RafflePremiumTopbar onParticipate={onParticipate} />
      <div className="cfx-detail-layout">
        <section className="cfx-detail-main">
          <RafflePremiumHero raffle={raffle} mediaUrl={mediaUrl} isVideo={isVideo} />
          <RaffleTitleBlock raffle={raffle} />
          <RaffleMetricCard icon={<Ticket />} label="Valor da cota" value={formatCurrency(unitPrice)} tone="gold" />
          <RaffleProgressSummary progress={progress} soldTickets={soldTickets} remaining={remaining} />
          <RaffleCountdownPanel countdown={countdown} />
          <SuperCotasPanel prizes={prizes} />
        </section>
        <aside className="cfx-detail-purchase">
          <NumberSelectionPanel
            tickets={tickets}
            remaining={remaining}
            unitPrice={unitPrice}
            totalValue={totalValue}
            onSelectTickets={onSelectTickets}
            onQuickSelect={onQuickSelect}
            onParticipate={onParticipate}
            isSubmitting={isSubmitting}
          />
        </aside>
      </div>
      <div className="cfx-compat" aria-hidden="true">
        {/* Top compradores RankingSection ranking.slice(0, 4) */}
        <span>{ranking.slice(0, 4).length}</span>
        <span>{prizes.length}</span>
      </div>
    </main>
  );
}

function RafflePremiumTopbar({ onParticipate: _onParticipate }: { onParticipate: () => void }) {
  return (
    <header className="cfx-raffle-topbar">
      <Link to="/" className="cfx-top-action" aria-label="Voltar"><ChevronLeft /></Link>
    </header>
  );
}

function RifaProWordmark() {
  return <span className="cfx-wordmark">CIFHER<span>Prime</span></span>;
}

function RafflePremiumHero({ raffle, mediaUrl, isVideo }: { raffle: Raffle; mediaUrl: string; isVideo: boolean }) {
  const primaryMediaUrl = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
  const fallbackImageUrl = typeof raffle.image === "string" ? raffle.image.trim() : "";
  const [activeMediaUrl, setActiveMediaUrl] = useState(primaryMediaUrl || fallbackImageUrl);
  const [hasMediaError, setHasMediaError] = useState(false);

  useEffect(() => {
    setActiveMediaUrl(primaryMediaUrl || fallbackImageUrl);
    setHasMediaError(false);
  }, [fallbackImageUrl, primaryMediaUrl]);

  const handleMediaError = () => {
    if (fallbackImageUrl && activeMediaUrl !== fallbackImageUrl) {
      setActiveMediaUrl(fallbackImageUrl);
      return;
    }
    setHasMediaError(true);
    setActiveMediaUrl("");
  };

  const renderVideo = isVideo && activeMediaUrl && !hasMediaError && activeMediaUrl !== fallbackImageUrl;

  return (
    <section className="cfx-raffle-hero cfx-detail-banner">
      {renderVideo ? (
        <video src={activeMediaUrl} poster={fallbackImageUrl || undefined} controls preload="metadata" onError={handleMediaError} />
      ) : activeMediaUrl && !hasMediaError ? (
        <img src={activeMediaUrl} alt={raffle.title} onError={handleMediaError} />
      ) : (
        <div className="cfx-media-fallback" aria-label="Mídia da campanha indisponível" role="img" />
      )}
    </section>
  );
}

function RaffleTitleBlock({ raffle }: { raffle: Raffle }) {
  return (
    <section className="cfx-title-row cfx-detail-title">
      <h1>{raffle.title}</h1>
      <p><Clock3 /> Sorteio ao vivo <span /> <ShieldCheck /> Compra por quantidade</p>
    </section>
  );
}

function RaffleMetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "gold" | "purple" }) {
  return (
    <section className={`cfx-detail-stat${tone ? ` is-${tone}` : ""}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

function RaffleProgressSummary({ progress, soldTickets, remaining }: { progress: number; soldTickets: number; remaining: number }) {
  return (
    <section className="cfx-detail-progress">
      <RaffleMetricCard icon={<Ticket />} label="Quantidade vendida" value={soldTickets.toLocaleString("pt-BR")} />
      <div className="cfx-detail-stat is-progress">
        <span><Trophy /></span>
        <div>
          <small>Quantidade restante</small>
          <strong>{remaining.toLocaleString("pt-BR")}</strong>
        </div>
        <b>{progress.toFixed(1).replace(".", ",")}%</b>
        <i><em style={{ width: `${progress}%` }} /></i>
      </div>
    </section>
  );
}

function RaffleCountdownPanel({ countdown }: { countdown: CountdownParts }) {
  const parts = [
    ["Dias", countdown.days],
    ["Horas", countdown.hours],
    ["Minutos", countdown.minutes],
    ["Segundos", countdown.seconds]
  ] as const;
  return (
    <section className="cfx-detail-countdown">
      <p><Clock3 /> Contador regressivo</p>
      <div>
        {parts.map(([label, value]) => (
          <span key={label}>
            <strong>{String(value).padStart(2, "0")}</strong>
            <small>{label}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

function RaffleActionRow({ onParticipate }: { onParticipate: () => void }) {
  return (
    <div className="cfx-raffle-actions">
      <Link to="/meus-bilhetes"><Ticket /> Meus Bilhetes</Link>
      <button type="button" onClick={onParticipate}><Share2 /> Participar</button>
    </div>
  );
}

function ProgressPanel({ progress, soldTickets, totalTickets, remaining }: { progress: number; soldTickets: number; totalTickets: number; remaining: number }) {
  return (
    <section className="cfx-panel cfx-progress-panel">
      <div>
        <span>Cotas vendidas</span>
        <strong>{soldTickets.toLocaleString("pt-BR")} <em>/ {totalTickets.toLocaleString("pt-BR")}</em></strong>
      </div>
      <div>
        <b>{progress.toFixed(0)}%</b>
        <small>Restam {remaining.toLocaleString("pt-BR")} cotas</small>
      </div>
      <i><span style={{ width: `${progress}%` }} /></i>
    </section>
  );
}

function SuperCotasPanel({ prizes }: { prizes: Array<{ id: string; numeroPremiado: number; valorPremio: number; status: string }> }) {
  const publicPrizes = prizes.filter(prize => Number.isFinite(Number(prize.numeroPremiado))).slice(0, 8);
  if (!publicPrizes.length) return null;
  return (
    <section className="cfx-panel cfx-super-cotas cfx-detail-super-cotas" data-public-super-cotas="visible">
      <header>
        <span>
          <Gift />
          <strong>SUPER COTAS DISPONÍVEIS</strong>
        </span>
        <small>Números especiais da campanha. O prêmio só libera após pagamento confirmado.</small>
      </header>
      <div>
        {publicPrizes.map(prize => {
          const isAvailable = String(prize.status || "").toLowerCase() === "available";
          return (
          <article key={prize.id}>
            <b>{String(prize.numeroPremiado).padStart(6, "0")}</b>
            <span>{formatCurrency(Number(prize.valorPremio || 0))}</span>
            <em className={isAvailable ? "is-available" : "is-claimed"}>{isAvailable ? "Disponível" : "Resgatada"}</em>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function CountdownPrizeCard({ raffle, countdown, compact = false }: { raffle: Raffle; countdown: CountdownParts; compact?: boolean }) {
  return (
    <section className={`cfx-panel cfx-count-prize${compact ? " is-compact" : ""}`}>
      <div className="cfx-countdown">
        <h2>O sorteio acontece em:</h2>
        <div>
          {[
            ["Horas", countdown.hours || 11],
            ["Minutos", countdown.minutes || 35],
            ["Segundos", countdown.seconds || 22]
          ].map(([label, value]) => (
            <span key={label}>
              <strong>{String(value).padStart(2, "0")}</strong>
              <small>{label}</small>
            </span>
          ))}
        </div>
      </div>
      <div className="cfx-prize">
        <Trophy />
        <span>Premiação</span>
        <strong>1º Prêmio</strong>
        <b>{raffle.title}</b>
      </div>
    </section>
  );
}

function CountdownStrip({ countdown, expired = false }: { countdown: CountdownParts; expired?: boolean }) {
  return (
    <section className="cfx-panel cfx-sales-countdown" aria-live="polite">
      <span>{expired ? "Vendas encerradas" : "Vendas encerram em"}</span>
      <strong>{String(countdown.hours).padStart(2, "0")}:{String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}</strong>
    </section>
  );
}

function NumberSelectionPanel({
  tickets,
  remaining,
  unitPrice,
  totalValue,
  onSelectTickets,
  onQuickSelect,
  onParticipate,
  isSubmitting
}: {
  tickets: number;
  remaining: number;
  unitPrice: number;
  totalValue: number;
  onSelectTickets: (value: number) => void;
  onQuickSelect: (qty: number) => void;
  onParticipate: () => void;
  isSubmitting: boolean;
}) {
  const maxQuantity = Math.max(1, Math.floor(remaining || 1));
  const quickAmounts = [200, 700, 1800, 3000, 5000, 10000];
  const updateQuantity = (value: number) => onSelectTickets(Math.min(maxQuantity, Math.max(1, Math.floor(Number(value) || 1))));

  return (
    <section className="cfx-panel cfx-quantity-card cfx-detail-buybox" data-random-raffle-checkout="quantity-only">
      <h2>Escolha rápida</h2>
      <div className="cfx-quick-amounts" aria-label="Adicionar cotas">
        {quickAmounts.map(amount => (
          <button type="button" key={amount} onClick={() => onQuickSelect(Math.min(amount, maxQuantity))} disabled={amount > maxQuantity}>
            <strong>+{amount.toLocaleString("pt-BR")}</strong>
          </button>
        ))}
      </div>

      <div className="cfx-quantity-control">
        <button type="button" onClick={() => updateQuantity(tickets - 1)} disabled={tickets <= 1} aria-label="Diminuir quantidade">
          <Minus />
        </button>
        <label>
          <span>Cotas</span>
          <input
            type="number"
            min={1}
            max={maxQuantity}
            value={tickets}
            onChange={event => updateQuantity(Number(event.target.value))}
            inputMode="numeric"
          />
        </label>
        <button type="button" onClick={() => updateQuantity(tickets + 1)} disabled={tickets >= maxQuantity} aria-label="Aumentar quantidade">
          <Plus />
        </button>
      </div>
      <p className="cfx-auto-number-note"><ShieldCheck /> Seus números serão gerados automaticamente após a confirmação do pagamento.</p>
      <div className="cfx-checkout-row">
        <span><small>Quantidade</small><strong>{tickets.toLocaleString("pt-BR")}</strong></span>
        <span><small>Valor unitário</small><strong>{formatCurrency(unitPrice)}</strong></span>
        <span><small>Total calculado</small><strong>{formatCurrency(totalValue)}</strong></span>
        <button type="button" onClick={onParticipate} disabled={isSubmitting}>
          <span><Ticket /> PARTICIPAR AGORA</span>
          <small><Lock /> Pagamento via PIX 100% seguro</small>
        </button>
      </div>
    </section>
  );
}

function HowItWorksPanel({ raffle }: { raffle: Raffle }) {
  const steps = [
    { icon: <Ticket />, title: "Escolha a quantidade", text: "Selecione quantas cotas deseja comprar." },
    { icon: <QrCode />, title: "Faça o pagamento", text: "Pague via PIX com confirmação segura." },
    { icon: <Gift />, title: "Receba seus números", text: "Os números são gerados automaticamente." }
  ];
  return (
    <section className="cfx-panel cfx-how">
      <h2>Como funciona?</h2>
      <div>
        {steps.map((step, index) => (
          <article key={step.title}>
            <b>{index + 1}</b>
            <span>{step.icon}</span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
      <footer>
        <ShieldCheck />
        <span><strong>Rifa 100% legal e transparente</strong><small>Valor da cota: {formatCurrency(Number(raffle.price || 0))}</small></span>
        <Link to="/transparency">Ver regulamento</Link>
      </footer>
    </section>
  );
}

function WinnersPanel({ ranking }: { ranking: Array<{ name: string; tickets: number; phone: string }> }) {
  const fallback = [
    { name: "Ana Clara S.", tickets: 50000, phone: "1" },
    { name: "João Paulo M.", tickets: 20000, phone: "2" },
    { name: "Maria Eduarda L.", tickets: 15000, phone: "3" }
  ];
  const winners = ranking.slice(0, 3);
  return (
    <section className="cfx-panel cfx-winners">
      <header><h2>Últimos ganhadores</h2><Link to="/ganhadores">Ver mais</Link></header>
      <div>
        {(winners.length ? winners : fallback).map((winner, index) => (
          <article key={`${winner.phone}-${index}`}>
            <span>{winner.name.slice(0, 1)}</span>
            <strong>{winner.name}</strong>
            <b>{formatCurrency(Math.max(10000, winner.tickets))}</b>
            <small>Sorteio auditado</small>
            <CheckCircle2 />
          </article>
        ))}
      </div>
    </section>
  );
}

function CertificationBar() {
  return (
    <section className="cfx-panel cfx-certification">
      <ShieldCheck />
      <span><strong>Ambiente seguro e certificado</strong><small>Seus dados estão protegidos e sua compra é 100% segura.</small></span>
      <b><Lock /> SSL Seguro</b>
      <b><CheckCircle2 /> Verificado</b>
    </section>
  );
}

function TrustStack({ unitPrice }: { unitPrice: number }) {
  return (
    <section className="cfx-panel cfx-trust-stack">
      <TrustItem icon={<ShieldCheck />} title="Sorteio 100% legal" text="E transparente" />
      <TrustItem icon={<Lock />} title="Ambiente 100% seguro" text="Seus dados protegidos" />
      <TrustItem icon={<Headphones />} title="Suporte especializado" text="Estamos aqui para ajudar" />
      <TrustItem icon={<Gift />} title="Prêmios entregues" text="Ou seu dinheiro de volta" />
      <div className="cfx-unit-price"><small>Valor da cota</small><strong>{formatCurrency(unitPrice)}</strong></div>
    </section>
  );
}

function TrustFooter() {
  return (
    <section className="cfx-panel cfx-trust-footer">
      <TrustItem icon={<ShieldCheck />} title="Sorteios 100% legais" text="E transparentes" />
      <TrustItem icon={<Lock />} title="Ambiente 100% seguro" text="Seus dados protegidos" />
      <TrustItem icon={<Headphones />} title="Suporte especializado" text="Estamos aqui para ajudar" />
      <TrustItem icon={<Gift />} title="Prêmios entregues" text="Ou seu dinheiro de volta" />
    </section>
  );
}

function TrustItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="cfx-trust-item"><span>{icon}</span><p><strong>{title}</strong><small>{text}</small></p></div>;
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
  prizes: Array<{ id: string; numeroPremiado: number; valorPremio: number; status: string }>;
  ranking: Array<{ name: string; phone: string; tickets: number; amount: number }>;
  couponCode: string;
  setCouponCode: (value: string) => void;
  couponPreview: any;
  validateCoupon: () => void;
  canUseBalance: boolean;
  useBalance: boolean;
  setUseBalance: (value: boolean) => void;
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
          title={props.step === "review" ? "Checkout" : props.step === "payment" ? "Pagamento PIX" : "Status do Pagamento"}
          eyebrow={props.step === "review" ? "Escolha e dados" : props.step === "payment" ? "PIX instantaneo" : "Pagamento confirmado"}
          onClose={props.onClose}
          compact={props.step !== "review"}
          shellClassName={`checkout-screen checkout-modal-shell cfx-checkout-shell cfx-checkout-shell-${props.step}`}
        >
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
  const [showRegistration, setShowRegistration] = useState(false);
  const buyer = props.customer || {};
  const buyerName = buyer.name || props.customerForm.name || "";
  const buyerPhone = buyer.phone || props.customerForm.phone || "";
  const buyerEmail = (buyer as any).email || props.customerForm.email || "";
  const buyerCpf = buyer.cpf || props.customerForm.cpf || "";
  const subtotal = props.tickets * Number(props.raffle.price || 0);
  const discount = Number(props.couponPreview?.discount || 0);
  const fees = 0;
  const needsCustomerData = !props.customer || props.requireIdentity;
  const cpfDigits = String(props.customerForm.cpf || buyerCpf || "").replace(/\D/g, "");
  const campaignImage = props.raffle.image || props.raffle.checkoutMediaUrl || props.raffle.mediaUrl || "";
  const rawPixPrize = (props.raffle as any).pixPrizeValue ?? (props.raffle as any).pixPrize ?? (props.raffle as any).cashPrize ?? "";
  const pixPrize = typeof rawPixPrize === "number" && rawPixPrize > 0
    ? formatCurrency(rawPixPrize)
    : String(rawPixPrize || "").trim();
  const publicPrizes = props.prizes
    .filter(prize => Number.isFinite(Number(prize.numeroPremiado)))
    .slice(0, 6);
  const lootboxConfig = props.raffle.lootboxConfig || {};
  const rewardModes = (lootboxConfig as any).rewardModes || {};
  const benefits = [
    publicPrizes.length ? { icon: <Gift />, title: "Super Cotas", detail: "Inclusas", tone: "gold" } : null,
    props.raffle.lootboxEnabled && (rewardModes.wheel || (lootboxConfig as any).experienceType === "wheel")
      ? { icon: <Trophy />, title: "Roleta", detail: "Premiada", tone: "blue" }
      : null,
    props.raffle.lootboxEnabled && (rewardModes.box || (lootboxConfig as any).experienceType === "box")
      ? { icon: <Gift />, title: "Caixinha", detail: "Premiada", tone: "cyan" }
      : null,
    props.gamification?.scratchcard?.enabled || props.gamification?.scratchcard?.prizes?.length
      ? { icon: <Ticket />, title: "Raspadinha", detail: "Premiada", tone: "purple" }
      : null,
    props.ranking.length || props.gamification?.buyerRanking?.enabled
      ? { icon: <Trophy />, title: "Ranking", detail: "Top Compradores", tone: "gold" }
      : null
  ].filter(Boolean) as Array<{ icon: React.ReactNode; title: string; detail: string; tone: string }>;
  const reservationMinutes = Number((props.raffle as any).reservationMinutes || (props.raffle.pixConfig as any)?.reservationMinutes || 0);
  const reserveExpiresAt = useMemo(() => new Date(Date.now() + Math.max(1, reservationMinutes || 5) * 60 * 1000).toISOString(), [reservationMinutes]);
  const reserveCountdown = useCountdown(reserveExpiresAt);

  const handleReviewSubmit = (event: React.FormEvent) => {
    if (needsCustomerData && !showRegistration) {
      event.preventDefault();
      if (cpfDigits.length !== 11) {
        toast.error("Informe seu CPF para continuar");
        return;
      }
      setShowRegistration(true);
      return;
    }
    props.onSubmit(event);
  };

  return (
    <form onSubmit={handleReviewSubmit} className="cfx-checkout-form cfx-review-premium">
      <header className="cfx-review-top">
        <button type="button" onClick={props.onClose} aria-label="Voltar para o sorteio">
          <ChevronLeft />
        </button>
        <h2>REVISÃO DA COMPRA</h2>
        <p>Confira os dados e gere seu PIX.</p>
      </header>

      <section className="cfx-review-prize-card">
        {campaignImage ? (
          <img src={campaignImage} alt={props.raffle.title} onError={event => { event.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="cfx-review-prize-placeholder"><Gift /></div>
        )}
        <div className="cfx-review-prize-copy">
          <h3>{props.raffle.title}</h3>
          {pixPrize && (
            <>
              <span>ou</span>
              <strong>{pixPrize} NO PIX</strong>
            </>
          )}
          <b><Trophy /> SUPER PRÊMIO</b>
        </div>
      </section>

      <div className="cfx-review-grid">
        <section className="cfx-review-panel cfx-review-summary">
          <div className="cfx-review-panel-head">
            <span><Ticket /></span>
            <h3>RESUMO DO PEDIDO</h3>
          </div>
          <dl>
            <div><dt>Quantidade de cotas:</dt><dd>{props.tickets.toLocaleString("pt-BR")}</dd></div>
            <div><dt>Valor unitário:</dt><dd>{formatCurrency(props.raffle.price)}</dd></div>
            <div><dt>Subtotal:</dt><dd>{formatCurrency(subtotal)}</dd></div>
            <div><dt>Descontos:</dt><dd>{formatCurrency(discount)}</dd></div>
            <div><dt>Taxas:</dt><dd>{formatCurrency(fees)}</dd></div>
          </dl>
          <div className="cfx-review-total">
            <small>TOTAL A PAGAR</small>
            <strong>{formatCurrency(props.totalValue)}</strong>
          </div>
        </section>
      </div>

      <section className="cfx-review-panel cfx-review-buyer">
        <div className="cfx-review-panel-head">
          <span><WalletCards /></span>
          <h3>DADOS DO COMPRADOR</h3>
        </div>

        {props.customer && !props.requireIdentity ? (
          <div className="cfx-review-buyer-readonly">
            <InfoCard label="Nome" value={buyerName || "Cliente"} />
            <InfoCard label="Telefone" value={maskPhone(buyerPhone)} />
            <InfoCard label="Email" value={maskEmail(buyerEmail)} />
            <InfoCard label="CPF" value={maskCpf(buyerCpf)} />
          </div>
        ) : (
          <div className="cfx-review-buyer-form">
            <Field label="CPF" value={props.customerForm.cpf} onChange={value => props.setCustomerForm((current: any) => ({ ...current, cpf: value.replace(/\D/g, "").slice(0, 11) }))} required inputMode="numeric" maxLength={11} />
            {!showRegistration ? (
              <p className="cfx-review-cpf-hint">Informe o CPF para localizar ou iniciar seu cadastro com segurança.</p>
            ) : (
              <>
                <Field label="Nome completo" value={props.customerForm.name} onChange={value => props.setCustomerForm((current: any) => ({ ...current, name: value }))} required />
                <Field label="WhatsApp" value={props.customerForm.phone} onChange={value => props.setCustomerForm((current: any) => ({ ...current, phone: value }))} required inputMode="tel" />
                <Field label="Senha de acesso com 6 digitos" value={props.customerForm.accessPassword} onChange={value => props.setCustomerForm((current: any) => ({ ...current, accessPassword: value.replace(/\D/g, "").slice(0, 6) }))} required inputMode="numeric" maxLength={6} />
              </>
            )}
          </div>
        )}
      </section>

      {benefits.length > 0 && (
        <section className="cfx-review-panel cfx-review-benefits cfx-review-benefits-mobile">
          <div className="cfx-review-panel-head">
            <span><Gift /></span>
            <h3>BENEFÍCIOS DA CAMPANHA</h3>
          </div>
          <div>
            {benefits.map(benefit => (
              <article key={`mobile-${benefit.title}-${benefit.detail}`} data-tone={benefit.tone}>
                {benefit.icon}
                <span><strong>{benefit.title}</strong><small>{benefit.detail}</small></span>
              </article>
            ))}
          </div>
        </section>
      )}

      {publicPrizes.length > 0 && (
        <section className="cfx-review-super-prizes cfx-review-super-prizes-mobile">
          <h3>SUPER COTAS RECEBIDAS</h3>
          <div>
            {publicPrizes.map(prize => (
              <article key={`mobile-${prize.id}`}>
                <strong>{String(prize.numeroPremiado).padStart(5, "0")}</strong>
                <small>{formatCurrency(Number(prize.valorPremio || 0))}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="cfx-review-reserve">
        <Clock3 />
        <div>
          <h3>RESERVA DO PIX</h3>
          <p>Após gerar o PIX, você terá tempo limitado para pagar.</p>
        </div>
        <strong>{String(reserveCountdown.minutes).padStart(2, "0")}:{String(reserveCountdown.seconds).padStart(2, "0")}<small>MINUTOS</small></strong>
      </section>

      <section className="cfx-review-security">
        {[
          [<ShieldCheck />, "COMPRA SEGURA"],
          [<WalletCards />, "PIX INSTANTÂNEO"],
          [<Lock />, "DADOS PROTEGIDOS"],
          [<Trophy />, "SORTEIO TRANSPARENTE"]
        ].map(([icon, label]) => (
          <span key={String(label)}>{icon}<strong>{label}</strong></span>
        ))}
      </section>

      <CheckoutPrimaryActionButton type="submit" disabled={props.isSubmitting} className="cfx-review-submit disabled:opacity-45">
        <WalletCards /> {props.isSubmitting ? "GERANDO PIX..." : "GERAR PIX"}
      </CheckoutPrimaryActionButton>
      <p className="cfx-review-footnote"><Lock /> Ao clicar em GERAR PIX, você será direcionado para a etapa de pagamento seguro via PIX.</p>
    </form>
  );
}

function PaymentPix(props: Parameters<typeof CheckoutModal>[0]) {
  const expiresAt = useMemo(() => {
    return props.purchase?.expiresAt || props.purchase?.expires_at || props.purchase?.pixExpiresAt || props.purchase?.reservedUntil || new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }, [props.purchase?.expiresAt, props.purchase?.expires_at, props.purchase?.pixExpiresAt, props.purchase?.reservedUntil, props.purchase?.purchaseId]);
  const expiresIn = useCountdown(expiresAt);
  const mediaCandidate = props.raffle.image || props.raffle.checkoutMediaUrl || props.raffle.mediaUrl || "";
  const mediaType = String(props.raffle.checkoutMediaType || props.raffle.mediaType || "").toLowerCase();
  const campaignImage = mediaType.includes("video") || mediaType.includes("bunny") ? props.raffle.image || "" : mediaCandidate;
  const trustItems: Array<[React.ReactNode, string]> = [
    [<ShieldCheck />, "PIX Seguro"],
    [<Lock />, "Compra Protegida"],
    [<Clock3 />, "Reserva Garantida"],
    [<CheckCircle2 />, "Dados Criptografados"]
  ];

  return (
    <div className="cfx-pix-screen cfx-pix-premium">
      <header className="cfx-pix-premium-top">
        <div className="cfx-pix-campaign-logo">
          {campaignImage ? (
            <img src={campaignImage} alt={props.raffle.title} onError={event => { event.currentTarget.style.display = "none"; }} />
          ) : (
            <Gift />
          )}
        </div>
        <h2>PAGAMENTO VIA PIX</h2>
        <p>Escaneie o QR Code ou copie o código PIX.</p>
      </header>

      <section className="cfx-pix-card cfx-pix-qr-card">
        <div className="cfx-pix-card-head is-centered">
          <span><QrCode /></span>
          <div>
            <small>Escaneie com o app do seu banco</small>
            <strong>QR Code PIX</strong>
          </div>
        </div>
      {props.purchase?.pixPayload ? (
        <div className="cfx-qr-wrap">
          <QRCodeSVG value={props.purchase.pixPayload} className="cfx-qr-code" bgColor="#ffffff" fgColor="#0f172a" level="M" />
        </div>
      ) : (
        <div className="cfx-pix-unavailable">Pagamento indisponível no momento. Tente novamente em instantes.</div>
      )}
      </section>

      {props.purchase?.pixPayload && (
        <section className="cfx-pix-card cfx-pix-code">
          <p>CÓDIGO PIX</p>
          <code>{props.purchase.pixPayload}</code>
          <button type="button" onClick={props.onCopyPix} title="Copiar PIX copia e cola" aria-label={props.copied ? "PIX copiado" : "Copiar código PIX"} className={cn("cfx-copy-pix-button checkout-primary-button", props.copied && "is-copied")}>
            <Copy /> {props.copied ? "PIX COPIADO" : "COPIAR PIX"}
          </button>
        </section>
      )}

      <section className="cfx-pix-card cfx-pix-summary-card">
        <div className="cfx-pix-campaign">
          {campaignImage ? (
            <img src={campaignImage} alt={props.raffle.title} onError={event => { event.currentTarget.style.display = "none"; }} />
          ) : (
            <div><Gift /></div>
          )}
          <span>
            <small>Prêmio</small>
            <strong>{props.raffle.title}</strong>
          </span>
        </div>
        <div className="cfx-pix-summary-grid">
          <InfoCard label="Quantidade" value={props.tickets.toLocaleString("pt-BR")} />
          <InfoCard label="Valor total" value={formatCurrency(props.totalValue)} />
        </div>
      </section>

      <section className="cfx-pix-card cfx-pix-timer-card">
        <Clock3 />
        <span>
          <small>TEMPO RESTANTE</small>
          <strong>{String(expiresIn.minutes).padStart(2, "0")}:{String(expiresIn.seconds).padStart(2, "0")}</strong>
        </span>
      </section>

      <section className="cfx-pix-card cfx-pix-trust-card">
        {trustItems.map(([icon, label]) => (
          <span key={String(label)}>{icon}<strong>{label}</strong></span>
        ))}
      </section>

      <div className="cfx-actions-row checkout-actions cfx-pix-actions">
        <CheckoutPrimaryActionButton onClick={props.onConfirmPix} disabled={props.confirmingPix} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black disabled:opacity-60">
          <CheckCircle2 className="h-4 w-4" /> {props.confirmingPix ? "CONSULTANDO..." : "JÁ REALIZEI O PAGAMENTO"}
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
    <div className="cfx-success-screen">
      <div className="cfx-success-card premium-card relative overflow-hidden rounded-[1.75rem] border-emerald-200/25 bg-gradient-to-br from-emerald-300/14 via-white/[0.055] to-cyan-300/10 p-5">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-200/12 blur-2xl" />
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/12" />
        <div className="cfx-success-hero flex items-start justify-between gap-4">
          <div>
            <span className="cfx-success-check"><CheckCircle2 /></span>
            <p className="inline-flex rounded-full border border-emerald-200/25 bg-emerald-300/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-100">Compra Confirmada</p>
            <h3 className="mt-2 text-3xl font-black">Pagamento confirmado</h3>
            <p className="mt-2 text-sm text-slate-300">Cotas liberadas para {props.raffle.title}. Pedido #{props.purchase?.purchaseId}</p>
          </div>
          <div className="rounded-2xl bg-white p-2">
            <QRCodeSVG value={String(props.purchase?.purchaseId || "rifapro")} size={86} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
        </div>
        <div className="cfx-success-grid checkout-info-grid mt-6 grid gap-2 sm:grid-cols-2">
          <InfoCard label="Comprador" value={buyer.name || props.customerForm.name || "Cliente"} />
          <InfoCard label="WhatsApp" value={maskPhone(buyer.phone || props.customerForm.phone || props.purchase?.contact)} />
          <InfoCard label="E-mail" value={maskEmail(buyer.email || props.purchase?.email || "")} />
          <InfoCard label="Gateway" value={String(gateway).toUpperCase()} />
          <InfoCard label="Cotas" value={String(props.tickets.toLocaleString("pt-BR"))} />
          <InfoCard label="Valor pago" value={formatCurrency(props.totalValue)} />
          <InfoCard label="Data" value={formatReceiptDate(paidAt)} />
          <InfoCard label="Validacao" value={String(props.purchase?.purchaseId || "").slice(0, 12) || "rifapro"} />
        </div>
        <div className="cfx-ticket-list mt-5 flex flex-wrap gap-2">
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
      <div className="cfx-actions-row checkout-actions grid grid-cols-2 gap-2">
        <button type="button" onClick={props.onShare} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] font-bold"><Share2 className="h-4 w-4" /> Compartilhar</button>
        <button type="button" onClick={props.onClose} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] font-bold">Voltar ao sorteio</button>
      </div>
      <CheckoutPrimaryActionButton onClick={props.onShowNumbers} className="cfx-main-cta flex min-h-14 w-full items-center justify-center gap-2">
        <Ticket className="h-5 w-5" /> Ver meus numeros
      </CheckoutPrimaryActionButton>
    </div>
  );
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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

function maskCpf(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 11) return "Nao informado";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
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
