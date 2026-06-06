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
  Heart,
  Lock,
  Maximize2,
  Minus,
  Plus,
  PlayCircle,
  QrCode,
  Share2,
  ShieldCheck,
  Ticket,
  Trophy,
  Volume2,
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
    toast.success("Cota premiada encontrada", { description: `Premio instantaneo: ${formatCurrency(total)}` });
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
    <div className="premium-page raffle-reference-page min-h-screen pb-32 text-white">
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
    <main className="rdp-page">
      <RafflePremiumTopbar />
      <div className="rdp-desktop-logo"><RifaProWordmark /></div>
      <div className="rdp-layout">
        <section className="rdp-main">
          <RafflePremiumHero raffle={raffle} mediaUrl={mediaUrl} isVideo={isVideo} />
          <RaffleTitleBlock raffle={raffle} />
          <RaffleActionRow />
        </section>
        <aside className="rdp-sidebar">
          <CountdownPrizeCard raffle={raffle} countdown={countdown} compact />
          <TrustStack unitPrice={unitPrice} />
        </aside>
      </div>

      <ProgressPanel progress={progress} soldTickets={soldTickets} totalTickets={totalTickets} remaining={remaining} />
      <div className="rdp-mobile-countdown">
        <CountdownPrizeCard raffle={raffle} countdown={countdown} />
      </div>
      <NumberSelectionPanel
        tickets={tickets}
        remaining={remaining}
        soldTickets={soldTickets}
        totalTickets={totalTickets}
        progress={progress}
        unitPrice={unitPrice}
        totalValue={totalValue}
        onSelectTickets={onSelectTickets}
        onQuickSelect={onQuickSelect}
        onParticipate={onParticipate}
        isSubmitting={isSubmitting}
      />
      <TrustFooter />
      <div className="rdp-compat" aria-hidden="true">
        {/* Top compradores RankingSection ranking.slice(0, 4) */}
        <span>{ranking.slice(0, 4).length}</span>
        <span>{prizes.length}</span>
      </div>
    </main>
  );
}

function RafflePremiumTopbar() {
  return (
    <header className="rdp-topbar">
      <Link to="/" className="rdp-top-action"><ChevronLeft /> Voltar</Link>
      <strong>Sorteio</strong>
      <span>
        <button type="button"><Share2 /> <span>Compartilhar</span></button>
        <button type="button"><Heart /> <span>Favoritar</span></button>
      </span>
    </header>
  );
}

function RifaProWordmark() {
  return <span className="rdp-wordmark">RIFA<span>PRO</span></span>;
}

function RafflePremiumHero({ raffle, mediaUrl, isVideo }: { raffle: Raffle; mediaUrl: string; isVideo: boolean }) {
  return (
    <section className="rdp-hero home-featured-raffle-block">
      <span className="rdp-hero-badge">Próximo sorteio</span>
      <span className="rdp-video-label">Assista ao vídeo <PlayCircle /></span>
      {isVideo && mediaUrl ? (
        <video src={mediaUrl} poster={raffle.image || undefined} controls preload="metadata" />
      ) : mediaUrl ? (
        <img src={mediaUrl} alt={raffle.title} />
      ) : (
        <div className="rdp-media-fallback"><Trophy /></div>
      )}
      <button type="button" className="rdp-play" aria-label="Reproduzir"><PlayCircle /></button>
      <div className="rdp-controls" aria-hidden="true">
        <PlayCircle />
        <span>0:04 / 1:25</span>
        <i><b /></i>
        <Volume2 />
        <Maximize2 />
      </div>
    </section>
  );
}

function RaffleTitleBlock({ raffle }: { raffle: Raffle }) {
  return (
    <section className="rdp-title-row">
      <div>
        <h1>{raffle.title}</h1>
        <p><Clock3 /> Sorteio hoje às 21h00 <span /> <Ticket /> Valor da cota: {formatCurrency(Number(raffle.price || 0))}</p>
      </div>
    </section>
  );
}

function RaffleActionRow() {
  return (
    <div className="rdp-actions">
      <button type="button"><Share2 /> Compartilhar</button>
      <button type="button"><Heart /> Favoritar</button>
    </div>
  );
}

function ProgressPanel({ progress, soldTickets, totalTickets, remaining }: { progress: number; soldTickets: number; totalTickets: number; remaining: number }) {
  return (
    <section className="rdp-card rdp-progress-card">
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

function CountdownPrizeCard({ raffle, countdown, compact = false }: { raffle: Raffle; countdown: CountdownParts; compact?: boolean }) {
  return (
    <section className={`rdp-card rdp-count-prize${compact ? " is-compact" : ""}`}>
      <div className="rdp-countdown">
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
      <div className="rdp-prize">
        <Trophy />
        <span>Premiação</span>
        <strong>1º Prêmio</strong>
        <b>{raffle.title}</b>
      </div>
    </section>
  );
}

function NumberSelectionPanel({
  tickets,
  remaining,
  soldTickets,
  totalTickets,
  progress,
  unitPrice,
  totalValue,
  onSelectTickets,
  onQuickSelect,
  onParticipate,
  isSubmitting
}: {
  tickets: number;
  remaining: number;
  soldTickets: number;
  totalTickets: number;
  progress: number;
  unitPrice: number;
  totalValue: number;
  onSelectTickets: (value: number) => void;
  onQuickSelect: (qty: number) => void;
  onParticipate: () => void;
  isSubmitting: boolean;
}) {
  const maxQuantity = Math.max(1, Math.floor(remaining || 1));
  const quickAmounts = [5, 10, 20, 50, 100];
  const updateQuantity = (value: number) => onSelectTickets(Math.min(maxQuantity, Math.max(1, Math.floor(Number(value) || 1))));

  return (
    <section className="rdp-card rdp-quantity-card" data-random-raffle-checkout="quantity-only">
      <header>
        <span>
          <h2>Escolha a quantidade</h2>
          <p>Seus números serão gerados automaticamente após a confirmação do pagamento.</p>
        </span>
      </header>

      <div className="rdp-quantity-stats" aria-label="Disponibilidade da rifa">
        <span><small>Total disponível</small><strong>{totalTickets.toLocaleString("pt-BR")}</strong></span>
        <span><small>Cotas vendidas</small><strong>{soldTickets.toLocaleString("pt-BR")}</strong></span>
        <span><small>Cotas restantes</small><strong>{remaining.toLocaleString("pt-BR")}</strong></span>
        <span><small>Percentual</small><strong>{progress.toFixed(0)}%</strong></span>
      </div>

      <div className="rdp-quick-amounts" aria-label="Adicionar cotas">
        {quickAmounts.map(amount => (
          <button type="button" key={amount} onClick={() => onQuickSelect(tickets + amount)} disabled={tickets >= maxQuantity}>
            +{amount}
          </button>
        ))}
      </div>

      <div className="rdp-quantity-control">
        <button type="button" onClick={() => updateQuantity(tickets - 1)} disabled={tickets <= 1} aria-label="Diminuir quantidade">
          <Minus />
        </button>
        <label>
          <span>Quantidade de bilhetes</span>
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
      <div className="rdp-checkout-row">
        <span><small>Total de cotas</small><strong>{tickets}</strong></span>
        <span><small>Valor da cota</small><strong>{formatCurrency(unitPrice)}</strong></span>
        <span><small>Total a pagar</small><strong>{formatCurrency(totalValue)}</strong></span>
        <button type="button" onClick={onParticipate} disabled={isSubmitting}>
          <Lock /> Continuar para pagamento
          <small><Lock /> Ambiente 100% seguro</small>
        </button>
      </div>
    </section>
  );
}

function TrustStack({ unitPrice }: { unitPrice: number }) {
  return (
    <section className="rdp-card rdp-trust-stack">
      <TrustItem icon={<ShieldCheck />} title="Sorteio 100% legal" text="E transparente" />
      <TrustItem icon={<Lock />} title="Ambiente 100% seguro" text="Seus dados protegidos" />
      <TrustItem icon={<Headphones />} title="Suporte especializado" text="Estamos aqui para ajudar" />
      <TrustItem icon={<Gift />} title="Prêmios entregues" text="Ou seu dinheiro de volta" />
      <div className="rdp-unit-price"><small>Valor da cota</small><strong>{formatCurrency(unitPrice)}</strong></div>
    </section>
  );
}

function TrustFooter() {
  return (
    <section className="rdp-card rdp-trust-footer">
      <TrustItem icon={<ShieldCheck />} title="Sorteios 100% legais" text="E transparentes" />
      <TrustItem icon={<Lock />} title="Ambiente 100% seguro" text="Seus dados protegidos" />
      <TrustItem icon={<Headphones />} title="Suporte especializado" text="Estamos aqui para ajudar" />
      <TrustItem icon={<Gift />} title="Prêmios entregues" text="Ou seu dinheiro de volta" />
    </section>
  );
}

function TrustItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rdp-trust-item"><span>{icon}</span><p><strong>{title}</strong><small>{text}</small></p></div>;
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
          shellClassName="checkout-screen checkout-modal-shell cp-checkout-shell"
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
  return (
    <form onSubmit={props.onSubmit} className="cp-checkout-form">
      <section className="cp-stepper" aria-label="Etapas do checkout">
        {["Escolha", "Dados", "Pagamento"].map((label, index) => (
          <span key={label} className={index === 0 ? "is-active" : ""}>
            <strong>{index + 1}</strong>
            <small>{label}</small>
          </span>
        ))}
      </section>

      <section className="cp-panel cp-order-card">
        <div className="cp-panel-head">
          <span className="cp-icon-bubble"><Ticket /></span>
          <div>
            <p>Resumo da compra</p>
            <h3>{props.raffle.title}</h3>
          </div>
        </div>
        <div className="cp-order-lines">
          <InfoCard label="Quantidade" value={props.tickets.toLocaleString("pt-BR")} />
          <InfoCard label="Valor unitario" value={formatCurrency(props.raffle.price)} />
          <InfoCard label="Total" value={formatCurrency(props.totalValue)} />
        </div>
        <p className="cp-safe-line"><ShieldCheck /> Ambiente seguro</p>
      </section>

      <section className="cp-panel">
        <div className="cp-panel-head">
          <span className="cp-icon-bubble"><WalletCards /></span>
          <div>
            <p>Dados do comprador</p>
            <h3>{props.customer && !props.requireIdentity ? "Cliente identificado" : "Informe seus dados"}</h3>
          </div>
        </div>

      {props.customer && !props.requireIdentity ? (
        <div className="cp-identified">
          <CheckCircle2 />
          <span>Olá, {(props.customer.name || "cliente").split(/\s+/)[0]}. Seus dados estão protegidos.</span>
        </div>
      ) : (
        <>
          <div className="cp-segmented">
            <button type="button" onClick={() => props.setCustomerMode("register")} className={props.customerMode === "register" ? "is-active" : ""}>Novo</button>
            <button type="button" onClick={() => props.setCustomerMode("login")} className={props.customerMode === "login" ? "is-active" : ""}>Já tenho</button>
          </div>
          {props.customerMode === "register" && (
            <>
              <Field label="Nome completo" value={props.customerForm.name} onChange={value => props.setCustomerForm((current: any) => ({ ...current, name: value }))} required />
              <Field label="CPF" value={props.customerForm.cpf} onChange={value => props.setCustomerForm((current: any) => ({ ...current, cpf: value }))} required />
              <div className="cp-field-grid">
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
      </section>

      <section className="cp-panel">
        <div className="cp-panel-head">
          <span className="cp-icon-bubble"><QrCode /></span>
          <div>
            <p>Pagamento</p>
            <h3>PIX Instantâneo</h3>
          </div>
        </div>
        <div className="cp-payment-option is-active">
          <span>PIX</span>
          <small>Aprovação automática</small>
          <CheckCircle2 />
        </div>
        <div className="cp-coupon-row">
          <input value={props.couponCode} onChange={e => props.setCouponCode(e.target.value.toUpperCase())} placeholder="Cupom" />
          <button type="button" onClick={props.validateCoupon}>Aplicar</button>
        </div>
        {props.couponPreview && <p className="cp-safe-line"><CheckCircle2 /> Cupom aplicado no resumo.</p>}
      </section>

      {props.addonSuggestion && (
        <ToggleCard checked={props.acceptAddon} onChange={props.setAcceptAddon} title={`Adicionar ${props.addonSuggestion.tickets} cotas extras`} description={`${props.addonSuggestion.raffle.title} por + ${formatCurrency(props.addonSuggestion.amount)}`} />
      )}

      <GamificationPanel data={props.gamification} onOrderBumpChange={props.setAcceptOrderBump} orderBumpAccepted={props.acceptOrderBump} />

      {props.canUseBalance && (
        <ToggleCard checked={props.useBalance} onChange={props.setUseBalance} title="Usar saldo afiliado" description="Abater valor com saldo disponivel." />
      )}

      <CheckoutPrimaryActionButton type="submit" disabled={props.isSubmitting} className="cp-main-cta disabled:opacity-60">
        <WalletCards className="h-5 w-5" /> {props.isSubmitting ? "Calculando resumo..." : "Continuar"}
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
    <div className="cp-pix-screen text-center">
      <div className="cp-pix-icon mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-primary)]">
        <QrCode className="h-8 w-8" />
      </div>
      <div className="cp-pix-title">
        <h3 className="text-3xl font-black">Pague com PIX</h3>
        <p className="mt-2 text-sm text-slate-400">Confirmacao automatica em tempo real. Pedido #{props.purchase?.purchaseId}</p>
      </div>
      <div className="cp-pix-meta checkout-info-grid grid gap-2 rounded-3xl border border-white/10 bg-white/[0.045] p-3 text-left sm:grid-cols-3">
        <InfoCard label="Status" value={props.purchase?.status === "paid" ? "Pago" : "Aguardando"} />
        <InfoCard label="Gateway" value={String(gateway).toUpperCase()} />
        <InfoCard label="Total" value={formatCurrency(props.totalValue)} />
      </div>
      {props.purchase?.pixPayload ? (
        <div className="cp-qr-wrap mx-auto w-full max-w-[min(18rem,calc(100vw-3rem))] rounded-[1.35rem] bg-white p-3 shadow-[0_0_42px_rgba(34,211,238,0.18)] sm:w-fit sm:max-w-none sm:rounded-[1.75rem] sm:p-5">
          <QRCodeSVG value={props.purchase.pixPayload} className="h-auto w-full sm:h-[250px] sm:w-[250px]" bgColor="#ffffff" fgColor="#0f172a" level="M" />
        </div>
      ) : (
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">Pagamento indisponível no momento. Tente novamente em instantes.</div>
      )}
      <div className="cp-pix-expiry rounded-3xl border border-white/10 bg-white/[0.045] p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Tempo para pagar</p>
        <p className="mt-1 text-2xl font-black text-[var(--theme-primary)]">{String(expiresIn.minutes).padStart(2, "0")}:{String(expiresIn.seconds).padStart(2, "0")}</p>
        <p className="mt-2 text-xs text-slate-400">A tela atualiza sozinha quando o pagamento for confirmado.</p>
      </div>
      {props.purchase?.pixPayload && (
        <div className="cp-pix-code">
          <p>Ou copie o codigo PIX</p>
          <code>{props.purchase.pixPayload}</code>
        </div>
      )}
      <button type="button" onClick={props.onCopyPix} className={cn("cp-copy-pix-button checkout-primary-button flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl font-black transition", props.copied ? "premium-button" : "border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)]")}>
        <Copy className="h-5 w-5" /> {props.copied ? "PIX copiado" : "Copiar PIX copia e cola"}
      </button>
      <div className="cp-actions-row checkout-actions grid gap-2 sm:grid-cols-2">
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
    <div className="cp-success-screen">
      <div className="cp-success-card premium-card relative overflow-hidden rounded-[1.75rem] border-emerald-200/25 bg-gradient-to-br from-emerald-300/14 via-white/[0.055] to-cyan-300/10 p-5">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-200/12 blur-2xl" />
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/12" />
        <div className="cp-success-hero flex items-start justify-between gap-4">
          <div>
            <span className="cp-success-check"><CheckCircle2 /></span>
            <p className="inline-flex rounded-full border border-emerald-200/25 bg-emerald-300/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-100">Compra Confirmada</p>
            <h3 className="mt-2 text-3xl font-black">Pagamento confirmado</h3>
            <p className="mt-2 text-sm text-slate-300">Cotas liberadas para {props.raffle.title}. Pedido #{props.purchase?.purchaseId}</p>
          </div>
          <div className="rounded-2xl bg-white p-2">
            <QRCodeSVG value={String(props.purchase?.purchaseId || "rifapro")} size={86} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
        </div>
        <div className="cp-success-grid checkout-info-grid mt-6 grid gap-2 sm:grid-cols-2">
          <InfoCard label="Comprador" value={buyer.name || props.customerForm.name || "Cliente"} />
          <InfoCard label="WhatsApp" value={maskPhone(buyer.phone || props.customerForm.phone || props.purchase?.contact)} />
          <InfoCard label="E-mail" value={maskEmail(buyer.email || props.purchase?.email || "")} />
          <InfoCard label="Gateway" value={String(gateway).toUpperCase()} />
          <InfoCard label="Cotas" value={String(props.tickets.toLocaleString("pt-BR"))} />
          <InfoCard label="Valor pago" value={formatCurrency(props.totalValue)} />
          <InfoCard label="Data" value={formatReceiptDate(paidAt)} />
          <InfoCard label="Validacao" value={String(props.purchase?.purchaseId || "").slice(0, 12) || "rifapro"} />
        </div>
        <div className="cp-ticket-list mt-5 flex flex-wrap gap-2">
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
      <div className="cp-actions-row checkout-actions grid grid-cols-2 gap-2">
        <button type="button" onClick={props.onShare} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] font-bold"><Share2 className="h-4 w-4" /> Compartilhar</button>
        <button type="button" onClick={props.onClose} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] font-bold">Voltar ao sorteio</button>
      </div>
      <CheckoutPrimaryActionButton onClick={props.onShowNumbers} className="cp-main-cta flex min-h-14 w-full items-center justify-center gap-2">
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

function formatReceiptDate(value?: string) {
  if (!value) return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Agora";
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function captureGeoLocation() {
  return GeoPrefillService.captureCoordinates();
}
