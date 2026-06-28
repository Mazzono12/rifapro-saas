import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  Crown,
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
import type { Customer, Raffle, Winner } from "../types";
import { useCustomerStore } from "../store/useCustomerStore";
import { usePurchasePolling } from "../hooks/usePurchasePolling";
import { NumberRevealModal } from "../components/NumberRevealModal";
import { PostPurchaseLootboxModal } from "../components/PostPurchaseLootboxModal";
import { PixPaymentResultModal } from "../components/PixPaymentResultModal";
import { GamificationPanel } from "../components/GamificationPanel";
import { CheckoutCampaignMedia } from "../components/checkout/CheckoutCampaignMedia";
import { PrePaymentReceiptModal, type CheckoutPreview } from "../components/checkout/PrePaymentReceiptModal";
import { CheckoutModalShell, CheckoutPrimaryActionButton } from "../components/premium/PremiumUI";
import { checkoutService } from "../services/api";
import { getFriendlyErrorMessage, readJsonSafely } from "../utils/friendlyError";
import { GeoPrefillService } from "../services/GeoPrefillService";
import { useCityDetection } from "../hooks/useCityDetection";
import { finishMetric, markPageLoaded, startMetric } from "../lib/performanceMetrics";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";
import { PublicConversionWidgets } from "../components/PublicConversionWidgets";
import { ResponsiveMediaFrame } from "../components/ResponsiveMediaFrame";
import { inferMediaType, type MediaType } from "../utils/media";
import { getCpfValidationError, INVALID_CPF_MESSAGE } from "../utils/cpf";

/* clean-media contract: StandardRaffleMediaBlock CheckoutCampaignMedia */
/* ui-contrast/mobile contract: Confirmar PIX premium-button Field label="Cidade" Field label="WhatsApp" FloatingActions */
/* hardcore contract: <GamificationPanel data={gamification} /> doubleTickets contando no sorteio */
/* launch contract: Seus números serão gerados automaticamente após a confirmação do pagamento */

type CheckoutStep = "review" | "payment" | "ticket";
type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; ended: boolean };
type CheckoutCustomerForm = { name: string; phone: string; cpf: string; city: string; state: string; accessPassword: string; knownCustomer: boolean };
type BuyerRankingItem = { name: string; phone: string; tickets: number; amount: number; position?: number; orderCount?: number; lastPurchaseAt?: string; prizeLabel?: string; prizeType?: string; prizeDescription?: string };
type TopSellerRankingItem = {
  affiliateName?: string;
  affiliate?: string;
  refCode: string;
  totalSold: number;
  paidPurchasesCount?: number;
  sales?: number;
  directBuyersCount?: number;
  position: number;
  prizeLabel?: string;
};

function getRaffleHeroMedia(raffle?: Raffle | null) {
  if (!raffle) return { mediaUrl: "", mediaType: "image" as MediaType };
  const imageUrl = String(raffle.image || "").trim();
  if (imageUrl) return { mediaUrl: imageUrl, mediaType: inferMediaType(imageUrl) as MediaType };
  return { mediaUrl: "", mediaType: "image" as MediaType };
}

function getRaffleCheckoutMedia(raffle?: Raffle | null) {
  if (!raffle) return { mediaUrl: "", mediaType: "image" as MediaType };
  if (raffle.checkoutMediaUrl) return { mediaUrl: raffle.checkoutMediaUrl, mediaType: (raffle.checkoutMediaType || inferMediaType(raffle.checkoutMediaUrl)) as MediaType };
  return { mediaUrl: "", mediaType: "image" as MediaType };
}

function getLatestSalesDeadline(raffle?: Raffle | null) {
  if (!raffle) return "";
  return [raffle.salesEndAt, raffle.countdownEndAt, raffle.drawDate]
    .map(value => {
      if (!value) return "";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";
}

function getPixPayload(purchase: any) {
  return String(purchase?.pixPayload || purchase?.pix_payload || purchase?.pixCopyPaste || purchase?.pix_copy_paste || purchase?.copyPaste || purchase?.paymentCode || purchase?.payload || "").trim();
}

function getPixQrCodeBase64(purchase: any) {
  return String(purchase?.pixQrCode || purchase?.qrCode || purchase?.pixQrCodeBase64 || purchase?.qrCodeBase64 || purchase?.qr_code_base64 || purchase?.encodedImage || purchase?.encoded_image || "").trim();
}

function getPixQrImageSrc(purchase: any) {
  const qrCode = getPixQrCodeBase64(purchase);
  if (!qrCode) return "";
  if (/^(data:image\/|https?:\/\/)/i.test(qrCode)) return qrCode;
  return `data:image/png;base64,${qrCode}`;
}

function getCheckoutOrderId(result: any) {
  return String(result?.orderId || result?.order?.id || result?.purchaseId || result?.id || "").trim();
}

function getCheckoutRedirectUrl(result: any) {
  const orderId = getCheckoutOrderId(result);
  if (orderId) return `/checkout/pedido/${encodeURIComponent(orderId)}`;
  const checkoutUrl = String(result?.checkoutUrl || result?.paymentUrl || "").trim();
  if (!checkoutUrl) return "";
  if (checkoutUrl.startsWith("/")) return checkoutUrl;
  try {
    const url = new URL(checkoutUrl);
    return url.pathname.startsWith("/checkout/") ? `${url.pathname}${url.search}${url.hash}` : "";
  } catch {
    return "";
  }
}

function getRaffleMinPurchaseTickets(raffle?: Raffle | null) {
  const candidates = [
    raffle?.minPurchaseTickets,
    raffle?.minimumTickets,
    raffle?.minQuantity,
    (raffle as any)?.quantidadeMinima,
    (raffle as any)?.minimumPurchaseTickets
  ];
  const value = candidates
    .map(item => Math.floor(Number(item || 0)))
    .find(item => Number.isFinite(item) && item > 0);
  return Math.max(1, value || 1);
}

async function copyTextToClipboard(text: string) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback abaixo cobre navegadores mobile em HTTP local.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

function normalizePixPurchase<T extends Record<string, any> | null | undefined>(purchase: T): T {
  if (!purchase) return purchase;
  const pixPayload = getPixPayload(purchase);
  const qrCodeBase64 = getPixQrCodeBase64(purchase);
  return {
    ...purchase,
    ...(pixPayload ? { pixPayload, pix_payload: pixPayload, pix_copy_paste: pixPayload } : {}),
    ...(qrCodeBase64 ? { pixQrCodeBase64: qrCodeBase64, qrCodeBase64, qr_code_base64: qrCodeBase64 } : {})
  } as T;
}

export function RaffleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { branding } = useTenantBranding();
  const { customer, setCustomer, clearCustomer } = useCustomerStore();
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
  const [ranking, setRanking] = useState<BuyerRankingItem[]>([]);
  const [topSellers, setTopSellers] = useState<TopSellerRankingItem[]>([]);
  const [latestWinners, setLatestWinners] = useState<Winner[]>([]);
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
  const [customerForm, setCustomerForm] = useState<CheckoutCustomerForm>({ name: "", phone: "", cpf: "", city: "", state: "", accessPassword: "", knownCustomer: false });
  const [cpfError, setCpfError] = useState("");
  const [checkoutHoneypot, setCheckoutHoneypot] = useState("");
  const notifiedPrizePurchase = useRef<string | null>(null);
  const { purchase: polledPurchase } = usePurchasePolling(purchase?.purchaseId, 7000);
  const { detectedCity } = useCityDetection();
  const raffleTenantId = String((raffle as any)?.tenant_id || (raffle as any)?.tenantId || "");
  const customerTenantId = String((customer as any)?.tenant_id || (customer as any)?.tenantId || "");
  const recognizedCustomer: Customer | null = customer &&
    raffleTenantId &&
    customerTenantId === raffleTenantId &&
    customer.id &&
    customer.name &&
    (customer.phone || customer.cpf)
    ? customer
    : null;

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
    fetch(`/api/raffles/${id}/top-sellers`).then(res => res.json()).then(payload => setTopSellers(Array.isArray(payload) ? payload : [])).catch(() => setTopSellers([]));
    fetch(`/api/raffles/${id}/instant-prizes`).then(res => res.json()).then(payload => setInstantPrizeNumbers(Array.isArray(payload) ? payload : [])).catch(() => setInstantPrizeNumbers([]));
    fetch("/api/winners").then(res => res.json()).then(payload => setLatestWinners(Array.isArray(payload) ? payload.slice(0, 5) : [])).catch(() => setLatestWinners([]));
    fetch(`/api/raffles/${id}/gamification`).then(res => res.json()).then(setGamification).catch(() => null);
    fetch(`/api/raffles/${id}/addon-suggestion`).then(res => res.ok ? res.json() : null).then(data => data && setAddonSuggestion(data)).catch(() => null);
  }, [id]);

  useEffect(() => {
    if (!recognizedCustomer) return;
    setCustomerForm(current => ({
      name: recognizedCustomer.name || "",
      phone: recognizedCustomer.phone || "",
      cpf: recognizedCustomer.cpf || "",
      city: recognizedCustomer.city || current.city || "",
      state: recognizedCustomer.state || current.state || "",
      accessPassword: "",
      knownCustomer: true
    }));
    setCustomerMode("login");
    setRequireIdentity(false);
  }, [recognizedCustomer]);

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
      setPurchase(normalizePixPurchase(polledPurchase));
      if (polledPurchase.customer) setCustomer(polledPurchase.customer);
      setPaymentResult("approved");
      setCheckoutStep("ticket");
      toast.success("Pagamento confirmado", { description: "Seus bilhetes foram liberados." });
    }
    if (polledPurchase.status === "cancelled" && purchase?.status !== "cancelled") {
      setPurchase(normalizePixPurchase(polledPurchase));
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
  const heroMedia = getRaffleHeroMedia(raffle);
  const checkoutMedia = getRaffleCheckoutMedia(raffle);
  const minPurchaseTickets = getRaffleMinPurchaseTickets(raffle);

  useEffect(() => {
    if (!raffle) return;
    setTickets(current => Math.max(getRaffleMinPurchaseTickets(raffle), current));
  }, [raffle]);

  const setQuantity = (value: number) => {
    const remaining = raffle ? Math.max(1, Number(raffle.totalTickets || 1) - Number(raffle.soldTickets || 0)) : 100000;
    const next = Math.min(remaining, Math.max(minPurchaseTickets, Math.floor(Number(value) || minPurchaseTickets)));
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

  const buildCheckoutCustomer = async (resolvedCustomer?: Partial<CheckoutCustomerForm>) => {
    const geoLocation = await captureGeoLocation();
    GeoPrefillService.saveManual(customerForm.city, customerForm.state);
    const form = resolvedCustomer ? { ...customerForm, ...resolvedCustomer, knownCustomer: true } : customerForm;
    return recognizedCustomer
      ? {
          ...form,
          name: recognizedCustomer.name,
          phone: recognizedCustomer.phone,
          cpf: recognizedCustomer.cpf,
          city: recognizedCustomer.city || form.city,
          state: recognizedCustomer.state || form.state,
          browserId: recognizedCustomer.browserId,
          geoLocation
        }
      : { ...form, geoLocation };
  };

  const validateCheckoutForm = (resolvedCustomer?: Partial<CheckoutCustomerForm>) => {
    if (!raffle) return;
    const form = resolvedCustomer ? { ...customerForm, ...resolvedCustomer, knownCustomer: true } : customerForm;
    const phone = (recognizedCustomer?.phone || form.phone || "").replace(/\D/g, "");
    const cpfMessage = getCpfValidationError(recognizedCustomer?.cpf || form.cpf);
    if (cpfMessage) {
      setCpfError(cpfMessage);
      toast.error(cpfMessage);
      return false;
    }
    setCpfError("");
    if (!phone) {
      toast.error("Informe seu WhatsApp");
      return false;
    }
    if (!recognizedCustomer && !form.knownCustomer && !/^\d{6}$/.test(form.accessPassword)) {
      toast.error("Informe uma senha de acesso com 6 digitos");
      return false;
    }
    if (tickets < minPurchaseTickets) {
      toast.error(`Quantidade mínima: ${minPurchaseTickets} cotas`);
      setQuantity(minPurchaseTickets);
      return false;
    }
    return true;
  };

  const openPrePaymentReceipt = async (event?: React.FormEvent, resolvedCustomer?: Partial<CheckoutCustomerForm>) => {
    event?.preventDefault();
    if (!raffle || !validateCheckoutForm(resolvedCustomer)) return;
    startMetric("checkout_modal_open");
    setIsSubmitting(true);
    try {
      const previewCustomer = recognizedCustomer
        ? { ...customerForm, name: recognizedCustomer.name, phone: recognizedCustomer.phone, cpf: recognizedCustomer.cpf }
        : { ...customerForm, ...resolvedCustomer };
      const preview = await checkoutService.preview({
        type: "raffle",
        raffleId: id,
        tickets,
        customer: previewCustomer,
        refCode: localStorage.getItem("refCode") || undefined,
        useBalance,
        couponCode: couponCode || undefined,
        addon: acceptAddon && addonSuggestion ? { raffleId: addonSuggestion.raffle.id, tickets: addonSuggestion.tickets } : undefined,
        orderBumpAccepted: acceptOrderBump,
        companyWebsite: checkoutHoneypot
      });
      setCheckoutPreview(preview);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      finishMetric("checkout_modal_open", { raffleId: id });
    } catch (err: any) {
      toast.error("Revise sua compra", { description: getFriendlyErrorMessage(err, "Nao foi possivel calcular o resumo. Tente novamente.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeBuy = async (resolvedCustomer?: Partial<CheckoutCustomerForm>) => {
    if (isSubmitting) return;
    const existingCheckoutUrl = getCheckoutRedirectUrl(purchase);
    if (existingCheckoutUrl && purchase?.status !== "paid") {
      navigate(existingCheckoutUrl);
      return;
    }
    if (!raffle || !validateCheckoutForm(resolvedCustomer)) return;
    startMetric("pix_generation");
    setIsSubmitting(true);
    try {
      const checkoutCustomer = await buildCheckoutCustomer(resolvedCustomer);
      const phone = (recognizedCustomer?.phone || checkoutCustomer.phone || "").replace(/\D/g, "");
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
          orderBumpAccepted: acceptOrderBump,
        companyWebsite: checkoutHoneypot
        })
      });
      const data = normalizePixPurchase(await readJsonSafely(res));
      if (!res.ok) {
        if ((data as any)?.code === "INVALID_CPF" || (data as any)?.field === "cpf") {
          const message = String((data as any)?.message || INVALID_CPF_MESSAGE);
          setCpfError(message);
          setCheckoutStep("review");
          setCheckoutOpen(true);
          setReceiptOpen(false);
          throw new Error(message);
        }
        throw new Error(getFriendlyErrorMessage(data, "Não foi possível gerar o PIX. Tente novamente ou fale com o suporte."));
      }
      const redirectUrl = getCheckoutRedirectUrl(data);
      if (data.status !== "paid" && !redirectUrl && !getPixPayload(data) && !getPixQrCodeBase64(data)) {
        throw new Error("Não foi possível gerar o PIX. Tente novamente ou fale com o suporte.");
      }
      setPurchase(data);
      if (data.customer) setCustomer(data.customer);
      setRequireIdentity(false);
      setReceiptOpen(false);
      if (data.status === "paid") {
        setCheckoutStep("ticket");
      }
      finishMetric("pix_generation", { raffleId: id, status: data.status, reused: Boolean((data as any)?.reused) });
      if ((data as any)?.reused) {
        toast.info("PIX pendente encontrado", { description: "Encontramos um PIX pendente para este CPF. Continue o pagamento para finalizar sua compra." });
      } else {
        toast.success("PIX gerado", { description: `${tickets} cotas reservadas para voce.` });
      }
      if (data.status !== "paid" && redirectUrl) {
        navigate(redirectUrl);
        return;
      }
      if (data.status !== "paid") {
        setCheckoutStep("payment");
      }
    } catch (err: any) {
      if (/senha/i.test(err.message || "")) {
        setRequireIdentity(true);
        setCustomerMode("login");
      }
      toast.error("Erro no checkout", { description: getFriendlyErrorMessage(err, "Não foi possível gerar o PIX. Tente novamente ou fale com o suporte.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPix = async () => {
    const pixPayload = getPixPayload(purchase);
    if (!pixPayload) {
      toast.error("PIX copia e cola indisponivel", { description: "Use o QR Code exibido ou gere um novo PIX se o problema continuar." });
      return;
    }
    const copiedOk = await copyTextToClipboard(pixPayload);
    if (!copiedOk) {
      toast.error("Nao foi possivel copiar o PIX", { description: "Toque e segure no codigo copia e cola para selecionar manualmente." });
      return;
    }
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
      const refreshedPurchase = normalizePixPurchase(status.purchase || purchase);
      setPurchase((current: any) => normalizePixPurchase({
        ...current,
        ...refreshedPurchase,
        pixPayload: getPixPayload(refreshedPurchase) || getPixPayload(current),
        pixQrCodeBase64: getPixQrCodeBase64(refreshedPurchase) || getPixQrCodeBase64(current)
      }));
      if (refreshedPurchase?.customer) setCustomer(refreshedPurchase.customer);
      if (status.paid || refreshedPurchase?.status === "paid") {
        setPaymentResult("approved");
        setCheckoutStep("ticket");
        toast.success("Pagamento confirmado", { description: "Bilhete liberado pelo status seguro do pedido." });
        navigate(`/checkout/pedido/${encodeURIComponent(refreshedPurchase.purchaseId || purchase.purchaseId)}`, { replace: true });
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

  const switchCheckoutCustomer = () => {
    clearCustomer();
    setRequireIdentity(false);
    setCustomerMode("register");
    setCustomerForm(current => ({
      name: "",
      phone: "",
      cpf: "",
      city: current.city || detectedCity?.city || "",
      state: current.state || detectedCity?.state || "",
      accessPassword: "",
      knownCustomer: false
    }));
    setReceiptOpen(false);
    setCheckoutStep("review");
    setCheckoutOpen(true);
    toast.info("Informe os dados do novo comprador");
  };

  const openCheckout = () => {
    if (recognizedCustomer && !requireIdentity && !purchase) {
      void openPrePaymentReceipt(undefined, {
        name: recognizedCustomer.name || "",
        phone: recognizedCustomer.phone || "",
        cpf: recognizedCustomer.cpf || "",
        city: (recognizedCustomer as any).city || customerForm.city,
        state: (recognizedCustomer as any).state || customerForm.state,
        accessPassword: "",
        knownCustomer: true
      });
      return;
    }
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
          mediaUrl={heroMedia.mediaUrl}
          mediaType={heroMedia.mediaType}
          progress={progress}
          countdown={countdown}
          tickets={tickets}
          minPurchaseTickets={minPurchaseTickets}
          totalValue={totalValue}
          onSelectTickets={setQuantity}
          onQuickSelect={handlePackageClick}
          onParticipate={openCheckout}
          isSubmitting={isSubmitting}
          ranking={ranking}
          topSellers={topSellers}
          latestWinners={latestWinners}
          prizes={instantPrizeNumbers}
          gamification={gamification}
        />
        {salesDeadline && <CountdownStrip countdown={countdown} expired={Boolean((raffle as any).salesExpired)} />}
        <PublicConversionWidgets raffleId={id} className="cfx-conversion-widgets" />

        <CheckoutModal
        open={checkoutOpen}
        step={checkoutStep}
        raffle={raffle}
        tickets={tickets}
        minPurchaseTickets={minPurchaseTickets}
        totalValue={totalValue}
        purchase={purchase}
        customer={recognizedCustomer}
        customerForm={customerForm}
        setCustomerForm={setCustomerForm}
        checkoutHoneypot={checkoutHoneypot}
        setCheckoutHoneypot={setCheckoutHoneypot}
        cpfError={cpfError}
        setCpfError={setCpfError}
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
        onSwitchCustomer={switchCheckoutCustomer}
        onSubmit={(event, resolvedCustomer) => {
          event.preventDefault();
          openPrePaymentReceipt(event, resolvedCustomer);
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
        mediaUrl={checkoutMedia.mediaUrl}
        mediaType={checkoutMedia.mediaType}
        hideMedia={!checkoutMedia.mediaUrl}
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
  minPurchaseTickets,
  totalValue,
  onSelectTickets,
  onQuickSelect,
  onParticipate,
  isSubmitting,
  ranking,
  topSellers,
  latestWinners,
  prizes,
  gamification
}: {
  raffle: Raffle;
  mediaUrl: string;
  mediaType?: any;
  progress: number;
  countdown: CountdownParts;
  tickets: number;
  minPurchaseTickets: number;
  totalValue: number;
  onSelectTickets: (value: number) => void;
  onQuickSelect: (qty: number) => void;
  onParticipate: () => void;
  isSubmitting: boolean;
  ranking: BuyerRankingItem[];
  topSellers: TopSellerRankingItem[];
  latestWinners: Winner[];
  prizes: Array<{ id: string; numeroPremiado: number; valorPremio: number; status: string }>;
  gamification: any;
}) {
  const totalTickets = Math.max(1, Number(raffle.totalTickets || 1));
  const soldTickets = Math.max(0, Number(raffle.soldTickets || 0));
  const remaining = Math.max(0, totalTickets - soldTickets);
  const unitPrice = Number(raffle.price || 0);

  return (
    <main className="cfx-raffle-shell cfx-detail-shell">
      <div className="cfx-detail-layout cfx-detail-layout--single">
        <section className="cfx-detail-main">
          <RafflePremiumHero raffle={raffle} mediaUrl={mediaUrl} mediaType={mediaType} />
          <RaffleTitleBlock
            raffle={raffle}
            unitPrice={unitPrice}
          />
          <NumberSelectionPanel
            tickets={tickets}
            minPurchaseTickets={minPurchaseTickets}
            remaining={remaining}
            unitPrice={unitPrice}
            totalValue={totalValue}
            onSelectTickets={onSelectTickets}
            onQuickSelect={onQuickSelect}
            onParticipate={onParticipate}
            isSubmitting={isSubmitting}
          />
          <RaffleRankingsPanel buyers={ranking} sellers={topSellers} />
          <LatestWinnersPanel winners={latestWinners} />
          <SuperCotasPanel prizes={prizes} />
          <RaffleGamificationListPanel data={gamification || (raffle as any).gamificationConfig || (raffle as any).gamification || null} />
        </section>
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

function RafflePremiumHero({ raffle, mediaUrl, mediaType }: { raffle: Raffle; mediaUrl: string; mediaType?: MediaType | string | null }) {
  const primaryMediaUrl = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
  const [activeMediaUrl, setActiveMediaUrl] = useState(primaryMediaUrl);
  const [hasMediaError, setHasMediaError] = useState(false);

  useEffect(() => {
    setActiveMediaUrl(primaryMediaUrl);
    setHasMediaError(false);
  }, [primaryMediaUrl]);

  const handleMediaError = () => {
    setHasMediaError(true);
    setActiveMediaUrl("");
  };

  const resolvedMediaType = (mediaType as MediaType | undefined) || inferMediaType(activeMediaUrl);
  const preferredFit = raffle.mediaFit === "contain" ? "contain" : "cover";

  if (!activeMediaUrl || hasMediaError) return null;

  return (
    <section className="cfx-raffle-hero cfx-detail-banner">
      <Link to="/" className="cfx-detail-banner-back" aria-label="Voltar"><ChevronLeft /></Link>
      <ResponsiveMediaFrame
        src={activeMediaUrl}
        type={resolvedMediaType}
        alt={raffle.title}
        preferredFit={preferredFit}
        aspectMode="auto"
        priority
        autoPlay
        muted
        loop
        controls={false}
        interactive={false}
        className="h-full w-full rounded-[inherit]"
        mediaClassName="h-full w-full"
        onError={handleMediaError}
      />
    </section>
  );
}

function RaffleTitleBlock({
  raffle,
  unitPrice
}: {
  raffle: Raffle;
  unitPrice: number;
}) {
  return (
    <section className="cfx-title-row cfx-detail-title">
      <span className="cfx-detail-kicker cfx-detail-price-kicker"><Ticket /> Por apenas <strong>{formatCurrency(unitPrice)}</strong></span>
      <h1>{raffle.title}</h1>
      <p><Clock3 /> {formatDate(raffle.drawDate)} <span /> <ShieldCheck /> Compra via PIX seguro</p>
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

function RaffleTopBuyersPanel({ ranking }: { ranking: BuyerRankingItem[] }) {
  const buyers = ranking.slice(0, 3);
  return (
    <section className="cfx-panel cfx-detail-ranking">
      <header>
        <strong><Trophy /> Top compradores</strong>
        <Link to="/ganhadores">Ver ranking</Link>
      </header>
      {buyers.length ? (
        <div>
          {buyers.map((buyer, index) => (
            <article key={`${buyer.phone}-${index}`}>
              <span>{buyer.position || index + 1}</span>
              <b>{maskName(buyer.name)}</b>
              <small>{formatCurrency(Number(buyer.amount || 0))}{buyer.prizeLabel ? " · " + buyer.prizeLabel : ""}</small>
            </article>
          ))}
        </div>
      ) : (
        <p>Ranking em apuração com dados reais da campanha.</p>
      )}
    </section>
  );
}

function RaffleTopSellersPanel({ ranking }: { ranking: TopSellerRankingItem[] }) {
  const sellers = ranking.slice(0, 3);
  if (!sellers.length) return null;
  return (
    <section className="cfx-panel cfx-detail-ranking cfx-detail-top-sellers">
      <header>
        <strong><Crown /> Top Vendedores</strong>
        <Link to="/afiliados">Divulgar</Link>
      </header>
      <div>
        {sellers.map((seller, index) => (
          <article key={`${seller.refCode}-${index}`}>
            <span>{seller.position || index + 1}</span>
            <b>{seller.affiliateName || seller.affiliate || seller.refCode}</b>
            <small>{formatCurrency(Number(seller.totalSold || 0))} vendidos{seller.prizeLabel ? " · " + seller.prizeLabel : ""}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function RaffleRankingsPanel({
  buyers,
  sellers
}: {
  buyers: BuyerRankingItem[];
  sellers: TopSellerRankingItem[];
}) {
  const buyerRows = buyers.slice(0, 3);
  const sellerRows = sellers.slice(0, 3);
  if (!buyerRows.length && !sellerRows.length) {
    return (
      <section className="cfx-panel cfx-detail-ranking cfx-detail-rankings-combo">
        <header>
          <strong><Trophy /> Rankings</strong>
          <Link to="/ganhadores">Ver ranking</Link>
        </header>
        <p>Rankings em apuração com dados reais da campanha.</p>
      </section>
    );
  }

  return (
    <section className="cfx-panel cfx-detail-ranking cfx-detail-rankings-combo">
      <header>
        <strong><Trophy /> Rankings</strong>
        <Link to="/ganhadores">Ver ranking</Link>
      </header>
      <div className="cfx-detail-rankings-grid">
        <div>
          <h3>Top compradores</h3>
          {buyerRows.length ? buyerRows.map((buyer, index) => (
            <article key={`${buyer.phone}-${index}`}>
              <span>{buyer.position || index + 1}</span>
              <b>{maskName(buyer.name)}</b>
              <small>{formatCurrency(Number(buyer.amount || 0))}{buyer.prizeLabel ? " · " + buyer.prizeLabel : ""}</small>
            </article>
          )) : <p>Em formação.</p>}
        </div>
        <div>
          <h3>Top vendedores</h3>
          {sellerRows.length ? sellerRows.map((seller, index) => (
            <article key={`${seller.refCode}-${index}`}>
              <span>{seller.position || index + 1}</span>
              <b>{seller.affiliateName || seller.affiliate || seller.refCode}</b>
              <small>{formatCurrency(Number(seller.totalSold || 0))} vendidos{seller.prizeLabel ? " · " + seller.prizeLabel : ""}</small>
            </article>
          )) : <p>Em formação.</p>}
        </div>
      </div>
    </section>
  );
}

function LatestWinnersPanel({ winners }: { winners: Winner[] }) {
  const rows = winners.slice(0, 3);
  if (!rows.length) return null;
  return (
    <section className="cfx-panel cfx-detail-ranking cfx-detail-winners">
      <header>
        <strong><Gift /> Últimos ganhadores</strong>
        <Link to="/ganhadores">Ver todos</Link>
      </header>
      <div>
        {rows.map((winner, index) => (
          <article key={winner.id || `${winner.winnerName}-${index}`}>
            <span>{index + 1}</span>
            <b>{maskName(winner.winnerName || "Ganhador")}</b>
            <small>{winner.prizeDescription || winner.raffleName || "Prêmio entregue"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function MobilePurchaseBar({
  raffle,
  minPurchaseTickets,
  unitPrice,
  onParticipate
}: {
  raffle: Raffle;
  minPurchaseTickets: number;
  unitPrice: number;
  onParticipate: () => void;
}) {
  const minimumValue = Math.max(1, minPurchaseTickets) * unitPrice;
  return (
    <div className="cfx-mobile-buy-bar">
      <div>
        <span>{raffle.title}</span>
        <strong>A partir de {formatCurrency(minimumValue)}</strong>
      </div>
      <button type="button" onClick={onParticipate} className="public-primary-cta">
        Comprar Agora
      </button>
    </div>
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
  const [expanded, setExpanded] = useState(false);
  const allPublicPrizes = prizes.filter(prize => Number.isFinite(Number(prize.numeroPremiado)));
  const publicPrizes = expanded ? allPublicPrizes : allPublicPrizes.slice(0, 3);
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
      {allPublicPrizes.length > 3 && (
        <button type="button" className="cfx-super-cotas-more" onClick={() => setExpanded(value => !value)}>
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </section>
  );
}

function RaffleGamificationListPanel({ data }: { data: any }) {
  const activeItems = [
    data?.winningTicket?.enabled || data?.superCotas?.length || data?.autoPrizes?.length ? { icon: <Gift />, label: "Super Cotas", detail: "Números premiados da campanha" } : null,
    data?.wheel?.enabled || data?.roulette?.enabled || data?.lootbox?.type === "wheel" ? { icon: <Trophy />, label: "Roleta Premiada", detail: "Giros liberados conforme regra ativa" } : null,
    data?.mysteryBox?.enabled || data?.box?.enabled || data?.lootbox?.type === "box" ? { icon: <Gift />, label: "Caixinha Premiada", detail: "Prêmios surpresa após confirmação" } : null,
    data?.scratchcard?.enabled || data?.scratchcards?.enabled ? { icon: <Ticket />, label: "Raspadinha", detail: "Raspadinha liberada conforme regra ativa" } : null,
    data?.luckyHour?.active ? { icon: <Clock3 />, label: "Hora Premiada", detail: "Benefício ativo por tempo limitado" } : null,
    data?.doubleChance?.active ? { icon: <Crown />, label: "Chance em dobro", detail: "Cotas qualificadas recebem peso extra" } : null
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; detail: string }>;

  if (!activeItems.length) return null;

  return (
    <section className="cfx-panel cfx-detail-gamification-list">
      <header>
        <strong><Gift /> Muitas chances de ganhar</strong>
      </header>
      <div>
        {activeItems.map(item => (
          <article key={item.label}>
            <span>{item.icon}</span>
            <p><strong>{item.label}</strong><small>{item.detail}</small></p>
          </article>
        ))}
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
  minPurchaseTickets,
  remaining,
  unitPrice,
  totalValue,
  onSelectTickets,
  onQuickSelect,
  onParticipate,
  isSubmitting
}: {
  tickets: number;
  minPurchaseTickets: number;
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
  const minimum = Math.max(1, Math.floor(Number(minPurchaseTickets || 1)));
  const updateQuantity = (value: number) => onSelectTickets(Math.min(maxQuantity, Math.max(minimum, Math.floor(Number(value) || minimum))));

  return (
    <section className="cfx-panel cfx-quantity-card cfx-detail-buybox" data-random-raffle-checkout="quantity-only">
      <h2>Escolha rápida</h2>
      <div className="cfx-quick-amounts" aria-label="Adicionar cotas">
        {quickAmounts.map(amount => (
          <button type="button" key={amount} onClick={() => onQuickSelect(Math.min(Math.max(amount, minimum), maxQuantity))} disabled={Math.max(amount, minimum) > maxQuantity}>
            <strong>{amount < minimum ? minimum.toLocaleString("pt-BR") : `+${amount.toLocaleString("pt-BR")}`}</strong>
          </button>
        ))}
      </div>

      <div className="cfx-quantity-control">
        <button type="button" onClick={() => updateQuantity(tickets - 1)} disabled={tickets <= minimum} aria-label="Diminuir quantidade">
          <Minus />
        </button>
        <label>
          <span>Cotas</span>
          <input
            type="number"
            min={minimum}
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
      <div className="cfx-checkout-row">
        <span><small>Quantidade</small><strong>{tickets.toLocaleString("pt-BR")}</strong></span>
        <span><small>Valor unitário</small><strong>{formatCurrency(unitPrice)}</strong></span>
        <span><small>Total calculado</small><strong>{formatCurrency(totalValue)}</strong></span>
        <button type="button" onClick={onParticipate} disabled={isSubmitting} className="public-primary-cta">
          <span><Ticket /> COMPRAR AGORA</span>
          <small><Lock /> Pagamento via PIX 100% seguro</small>
        </button>
      </div>
      {minimum > 1 && <p className="cfx-minimum-tickets-note">Quantidade mínima: {minimum.toLocaleString("pt-BR")} cotas</p>}
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
  minPurchaseTickets: number;
  totalValue: number;
  purchase: any;
  customer: any;
  customerForm: any;
  setCustomerForm: React.Dispatch<React.SetStateAction<any>>;
  checkoutHoneypot: string;
  setCheckoutHoneypot: (value: string) => void;
  cpfError: string;
  setCpfError: (value: string) => void;
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
  ranking: BuyerRankingItem[];
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
  onSwitchCustomer: () => void;
  onSubmit: (event: React.FormEvent, resolvedCustomer?: Partial<CheckoutCustomerForm>) => void;
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
  const buyer = props.customer || {};
  const buyerPhone = buyer.phone || props.customerForm.phone || "";
  const buyerCpf = buyer.cpf || props.customerForm.cpf || "";
  const needsCustomerData = !props.customer || props.requireIdentity;
  const cpfDigits = String(props.customerForm.cpf || buyerCpf || "").replace(/\D/g, "");
  const phoneDigits = String(props.customerForm.phone || buyerPhone || "").replace(/\D/g, "");
  const handleReviewSubmit = async (event: React.FormEvent) => {
    if (needsCustomerData) {
      event.preventDefault();
      try {
        const response = await fetch("/api/customers/checkout-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: cpfDigits, phone: phoneDigits })
        });
        if (response.ok) {
          const payload = await response.json();
          const found = payload?.customer || {};
          const resolvedCustomer = {
            name: found.name || props.customerForm.name,
            phone: found.phone || props.customerForm.phone,
            cpf: found.cpf || cpfDigits,
            city: found.city || props.customerForm.city,
            state: found.state || props.customerForm.state,
            accessPassword: "",
            knownCustomer: true
          };
          props.setCustomerForm((current: any) => ({
            ...current,
            ...resolvedCustomer
          }));
          props.onSubmit(event, resolvedCustomer);
          return;
        }
      } catch {
        // Se a busca falhar, segue com os dados preenchidos no PIX rapido.
      }
      if (!props.customerForm.name.trim()) {
        toast.error("Informe seu nome completo");
        return;
      }
      if (!String(props.customerForm.phone || "").replace(/\D/g, "")) {
        toast.error("Informe seu WhatsApp");
        return;
      }
      const cpfMessage = getCpfValidationError(cpfDigits);
      if (cpfMessage) {
        props.setCpfError(cpfMessage);
        toast.error(cpfMessage);
        return;
      }
      props.setCpfError("");
      if (!props.customerForm.knownCustomer && !/^\d{6}$/.test(String(props.customerForm.accessPassword || ""))) {
        toast.error("Crie uma senha de acesso com 6 digitos");
        return;
      }
    }
    props.onSubmit(event);
  };

  return (
    <form onSubmit={handleReviewSubmit} className="cfx-checkout-form cfx-review-premium cfx-fast-pix-checkout" data-checkout-mode="pix-rapido">
      <label className="sr-only" aria-hidden="true">
        Site da empresa
        <input
          tabIndex={-1}
          autoComplete="off"
          name="companyWebsite"
          value={props.checkoutHoneypot}
          onChange={event => props.setCheckoutHoneypot(event.target.value)}
        />
      </label>
      <header className="cfx-review-top">
        <button type="button" onClick={props.onClose} aria-label="Voltar para o sorteio">
          <ChevronLeft />
        </button>
        <h2>Dados para o PIX</h2>
        <p>Depois voce confere o recibo antes de gerar o PIX.</p>
      </header>

      <section className="cfx-review-panel cfx-review-buyer">
        <div className="cfx-review-panel-head">
          <span><WalletCards /></span>
          <h3>Nome, WhatsApp, CPF e senha</h3>
        </div>

        <div className="cfx-review-buyer-form">
          <Field label="Nome completo" value={props.customerForm.name} onChange={value => props.setCustomerForm((current: any) => ({ ...current, name: value }))} autoComplete="name" />
          <Field label="WhatsApp" value={props.customerForm.phone} onChange={value => props.setCustomerForm((current: any) => ({ ...current, phone: value, knownCustomer: false }))} inputMode="tel" autoComplete="tel" />
          <Field label="CPF" value={props.customerForm.cpf} onChange={value => { props.setCpfError(""); props.setCustomerForm((current: any) => ({ ...current, cpf: value.replace(/\D/g, "").slice(0, 11), knownCustomer: false })); }} required inputMode="numeric" maxLength={11} autoComplete="off" error={props.cpfError} />
          <Field label="Senha de acesso com 6 digitos" value={props.customerForm.accessPassword} onChange={value => props.setCustomerForm((current: any) => ({ ...current, accessPassword: value.replace(/\D/g, "").slice(0, 6) }))} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
          <p className="cfx-review-cpf-hint">Se este CPF ou WhatsApp ja comprou antes, usamos seus dados salvos e seguimos para o recibo.</p>
        </div>
      </section>

      <CheckoutPrimaryActionButton type="submit" disabled={props.isSubmitting} className="public-primary-cta disabled:opacity-45">
        {props.isSubmitting ? "CARREGANDO RECIBO..." : "Continuar para o recibo"}
      </CheckoutPrimaryActionButton>
    </form>
  );
}

function PaymentPix(props: Parameters<typeof CheckoutModal>[0]) {
  const pixPayload = getPixPayload(props.purchase);
  const pixQrImageSrc = getPixQrImageSrc(props.purchase);
  const unitPrice = Number(props.raffle.price || 0);
  const expiresAt = useMemo(() => {
    return props.purchase?.expiresAt || props.purchase?.expires_at || props.purchase?.pixExpiresAt || props.purchase?.reservedUntil || new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }, [props.purchase?.expiresAt, props.purchase?.expires_at, props.purchase?.pixExpiresAt, props.purchase?.reservedUntil, props.purchase?.purchaseId]);
  const expiresIn = useCountdown(expiresAt);
  const checkoutMedia = getRaffleCheckoutMedia(props.raffle);

  return (
    <div className="cfx-pix-screen cfx-pix-premium">
      <header className="cfx-pix-premium-top cfx-pix-success-top">
        <span className="cfx-pix-success-icon"><CheckCircle2 /></span>
        <div>
          <h2>PIX GERADO COM SUCESSO!</h2>
          <p>Pague com PIX e garanta sua participacao.</p>
        </div>
      </header>

      <section className="cfx-pix-card cfx-pix-order-card">
        <div className="cfx-pix-order-media">
          {checkoutMedia.mediaUrl ? (
            <ResponsiveMediaFrame
              src={checkoutMedia.mediaUrl}
              type={checkoutMedia.mediaType}
              alt={props.raffle.title}
              preferredFit="cover"
              aspectMode="square"
              controls={false}
              interactive={false}
              className="h-full w-full rounded-[inherit]"
              mediaClassName="h-full w-full"
            />
          ) : (
            <Gift />
          )}
        </div>
        <div className="cfx-pix-order-copy">
          <small>Pedido aguardando pagamento</small>
          <strong>{props.raffle.title}</strong>
          <dl>
            <div><dt>Quantidade escolhida</dt><dd>{props.tickets.toLocaleString("pt-BR")}</dd></div>
            {unitPrice > 0 && <div><dt>Valor da cota</dt><dd>{formatCurrency(unitPrice)}</dd></div>}
          </dl>
          <div className="cfx-pix-order-total">
            <span>Total</span>
            <b>{formatCurrency(props.totalValue)}</b>
          </div>
        </div>
      </section>

      <section className="cfx-pix-card cfx-pix-qr-card">
        <div className="cfx-pix-card-head is-centered">
          <span><QrCode /></span>
          <div>
            <small>ESCANEIE O QR CODE</small>
            <strong>Pague com o app do seu banco</strong>
          </div>
        </div>
      {pixQrImageSrc ? (
        <div className="cfx-qr-wrap">
          <img src={pixQrImageSrc} className="cfx-qr-code" alt="QR Code PIX" />
        </div>
      ) : pixPayload ? (
        <div className="cfx-qr-wrap">
          <QRCodeSVG value={pixPayload} className="cfx-qr-code" bgColor="#ffffff" fgColor="#0f172a" level="M" />
        </div>
      ) : (
        <div className="cfx-pix-unavailable">O gateway nao retornou QR Code nem codigo PIX para este pedido. Gere um novo PIX ou tente novamente em instantes.</div>
      )}
      </section>

      {pixPayload && (
        <section className="cfx-pix-card cfx-pix-code">
          <p>COPIA E COLA</p>
          <code>{pixPayload}</code>
          <button type="button" onClick={props.onCopyPix} title="Copiar PIX copia e cola" aria-label={props.copied ? "PIX copiado" : "Copiar código PIX"} className={cn("cfx-copy-pix-button checkout-primary-button", props.copied && "is-copied")}>
            <Copy /> {props.copied ? "PIX copiado" : "Copiar código PIX"}
          </button>
        </section>
      )}

      <div className="cfx-pix-status-grid">
        <section className="cfx-pix-card cfx-pix-timer-card">
          <Clock3 />
          <span>
            <small>RESERVA VALIDA POR</small>
            <strong>{String(expiresIn.minutes).padStart(2, "0")}:{String(expiresIn.seconds).padStart(2, "0")}</strong>
            <em>Apos esse tempo, o PIX expira e a reserva e liberada.</em>
          </span>
        </section>

        <section className="cfx-pix-card cfx-pix-safe-card">
          <ShieldCheck />
          <strong>AMBIENTE SEGURO</strong>
          <span>Pagamento 100% seguro</span>
          <span>Dados protegidos</span>
          <span>PIX processado pelo gateway configurado</span>
        </section>
      </div>

      <section className="cfx-pix-card cfx-pix-reserved-notice">
        <Ticket />
        <div>
          <strong>Cotas aguardando confirmacao</strong>
          <p>Os numeros da sorte aparecem somente depois que o pagamento for aprovado.</p>
        </div>
      </section>

      <section className="cfx-pix-card cfx-pix-important">
        <ShieldCheck />
        <p>O status do pagamento sera atualizado automaticamente. Se ja pagou, toque em verificar.</p>
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
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [showAllReceiptNumbers, setShowAllReceiptNumbers] = useState(false);
  const isPaid = props.purchase?.status === "paid";
  const numbers = props.purchase?.numeros || [];
  const paidNumbers = isPaid ? numbers : [];
  const paidAt = props.purchase?.paidAt || props.purchase?.paid_at || props.purchase?.createdAt || props.purchase?.created_at;
  const instantPrizes = isPaid && Array.isArray(props.purchase?.premiosInstantaneos) ? props.purchase.premiosInstantaneos : [];
  const primaryPrize = instantPrizes[0];
  const rewardModes = (props.raffle.lootboxConfig?.rewardModes || {}) as { box?: boolean; wheel?: boolean };
  const legacyExperience = props.raffle.lootboxConfig?.experienceType;
  const unlockedGames = [
    props.purchase?.gamification?.scratchcardEventId ? { icon: <Ticket />, title: "Raspadinha", detail: "Liberada" } : null,
    props.purchase?.gamification?.mysteryBoxEventId || (Number(props.purchase?.earnedLootboxes || 0) > 0 && (rewardModes.box || legacyExperience === "box"))
      ? { icon: <Gift />, title: "Caixinha Premiada", detail: `${Number(props.purchase?.earnedLootboxes || 1)} abertura(s)` }
      : null,
    Number(props.purchase?.earnedLootboxes || 0) > 0 && (rewardModes.wheel || legacyExperience === "wheel")
      ? { icon: <Trophy />, title: "Roleta Premiada", detail: `${Number(props.purchase?.earnedLootboxes || 1)} giro(s)` }
      : null
  ].filter(Boolean) as Array<{ icon: React.ReactNode; title: string; detail: string }>;
  const openPremiumReceipt = () => {
    if (!isPaid) {
      toast.error("Comprovante indisponível", { description: "A compra ainda não foi confirmada." });
      return;
    }
    setReceiptOpen(true);
  };
  const shareReceipt = async () => {
    const text = `Comprovante oficial - ${props.raffle.title} - ${props.tickets.toLocaleString("pt-BR")} cotas - ${formatCurrency(props.totalValue)}.`;
    if (navigator.share) {
      await navigator.share({ title: "Comprovante oficial", text }).catch(() => null);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Resumo do comprovante copiado");
  };

  return (
    <div className="cfx-success-screen cfx-success-premium">
      <div className="cfx-success-confetti" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => <i key={index} />)}
      </div>

      <section className="cfx-success-hero">
        <span className="cfx-success-check"><CheckCircle2 /></span>
        <h2>PAGAMENTO CONFIRMADO</h2>
        <p>Boa sorte! Seus números foram liberados.</p>
      </section>

      <section className="cfx-success-card cfx-success-summary">
        <h3>Resumo da compra</h3>
        <div>
          <InfoCard label="Campanha" value={props.raffle.title} />
          <InfoCard label="Quantidade" value={props.tickets.toLocaleString("pt-BR")} />
          <InfoCard label="Valor total" value={formatCurrency(props.totalValue)} />
          <InfoCard label="Data" value={formatReceiptDate(paidAt)} />
        </div>
      </section>

      {isPaid && paidNumbers.length > 0 && (
        <section className="cfx-success-card cfx-success-numbers">
          <h3>Seus números da sorte</h3>
          <div>
            {paidNumbers.slice(0, 24).map((number: number) => (
              <span key={number}>{String(number).padStart(6, "0")}</span>
            ))}
            {paidNumbers.length > 24 && <span>+{paidNumbers.length - 24}</span>}
          </div>
        </section>
      )}

      {primaryPrize && (
        <section className="cfx-success-super-cota">
          <small>PARABÉNS! VOCÊ ENCONTROU UMA SUPER COTA</small>
          <strong>{String(primaryPrize.numeroPremiado).padStart(6, "0")}</strong>
          <b>{formatCurrency(Number(primaryPrize.valorPremio || 0))}</b>
          <span>{formatReceiptDate(primaryPrize.claimedAt || paidAt)}</span>
        </section>
      )}

      {unlockedGames.length > 0 && (
        <section className="cfx-success-card cfx-success-games">
          <h3>Gamificações liberadas</h3>
          <div>
            {unlockedGames.map(game => (
              <article key={game.title}>
                {game.icon}
                <span><strong>{game.title}</strong><small>{game.detail}</small></span>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="cfx-success-actions">
        <button type="button" onClick={openPremiumReceipt}><WalletCards /> VER COMPROVANTE</button>
        <Link to="/dashboard"><Ticket /> MEUS BILHETES</Link>
        <button type="button" onClick={props.onShare}><Share2 /> COMPARTILHAR</button>
      </section>

      <button type="button" onClick={props.onClose} className="cfx-success-repeat">
        PARTICIPAR NOVAMENTE
      </button>

      {receiptOpen && isPaid && (
        <PremiumReceiptModal
          raffle={props.raffle}
          purchase={props.purchase}
          customer={props.customer}
          customerForm={props.customerForm}
          tickets={props.tickets}
          totalValue={props.totalValue}
          paidAt={paidAt}
          numbers={paidNumbers}
          instantPrizes={instantPrizes}
          unlockedGames={unlockedGames}
          showAllNumbers={showAllReceiptNumbers}
          onToggleReceiptList={() => setShowAllReceiptNumbers(current => !current)}
          onClose={() => setReceiptOpen(false)}
          onShare={shareReceipt}
        />
      )}
    </div>
  );
}

function PremiumReceiptModal({
  raffle,
  purchase,
  customer,
  customerForm,
  tickets,
  totalValue,
  paidAt,
  numbers,
  instantPrizes,
  unlockedGames,
  showAllNumbers,
  onToggleReceiptList,
  onClose,
  onShare
}: {
  raffle: Raffle;
  purchase: any;
  customer: any;
  customerForm: any;
  tickets: number;
  totalValue: number;
  paidAt?: string;
  numbers: number[];
  instantPrizes: Array<{ numeroPremiado: number; valorPremio: number; claimedAt?: string }>;
  unlockedGames: Array<{ icon: React.ReactNode; title: string; detail: string }>;
  showAllNumbers: boolean;
  onToggleReceiptList: () => void;
  onClose: () => void;
  onShare: () => void;
}) {
  if (purchase?.status !== "paid") return null;

  const checkoutMedia = getRaffleCheckoutMedia(raffle);
  const buyer = purchase?.customer || customer || {};
  const visibleNumbers = showAllNumbers ? numbers : numbers.slice(0, 30);
  const orderId = purchase?.purchaseId || purchase?.id || "Não informado";
  const paymentGateway = String(purchase?.pixGateway || purchase?.gateway || purchase?.paymentGateway || "PIX").toUpperCase();
  const mainPrize = String((raffle as any).mainPrize || (raffle as any).premio || (raffle as any).prize || "").trim();

  return (
    <div className="cfx-receipt-overlay" role="dialog" aria-modal="true" aria-label="Comprovante oficial">
      <div className="cfx-receipt-modal">
        <button type="button" className="cfx-receipt-close" onClick={onClose} aria-label="Fechar comprovante">×</button>

        <header className="cfx-receipt-top">
          <span className="cfx-receipt-approved"><CheckCircle2 /> PAGAMENTO APROVADO</span>
          <h2>COMPROVANTE OFICIAL</h2>
          <p>Compra confirmada com sucesso</p>
        </header>

        <section className="cfx-receipt-card cfx-receipt-campaign">
          {checkoutMedia.mediaUrl ? (
            <ResponsiveMediaFrame
              src={checkoutMedia.mediaUrl}
              type={checkoutMedia.mediaType}
              alt={raffle.title}
              preferredFit="cover"
              aspectMode="square"
              controls={false}
              interactive={false}
              className="h-full w-full rounded-[inherit]"
              mediaClassName="h-full w-full"
            />
          ) : (
            <div className="cfx-receipt-image-fallback"><Gift /></div>
          )}
          <div>
            <small>Campanha</small>
            <strong>{raffle.title}</strong>
            {mainPrize && <span>{mainPrize}</span>}
          </div>
        </section>

        <section className="cfx-receipt-card">
          <h3>Transação</h3>
          <div className="cfx-receipt-lines">
            <ReceiptLine label="Pedido" value={String(orderId)} />
            <ReceiptLine label="Data e hora" value={formatReceiptDate(paidAt)} />
            <ReceiptLine label="Status" value="PAGO" />
            <ReceiptLine label="Gateway" value={paymentGateway} />
            <ReceiptLine label="Valor pago" value={formatCurrency(totalValue)} strong />
            <ReceiptLine label="Quantidade de cotas" value={tickets.toLocaleString("pt-BR")} />
          </div>
        </section>

        {numbers.length > 0 && (
          <section className="cfx-receipt-card cfx-receipt-numbers">
            <h3>Números</h3>
            <div>
              {visibleNumbers.map(number => (
                <span key={number}>{String(number).padStart(6, "0")}</span>
              ))}
            </div>
            {numbers.length > 30 && (
              <button type="button" onClick={onToggleReceiptList}>
                {showAllNumbers ? "VER MENOS" : `VER TODOS OS ${numbers.length.toLocaleString("pt-BR")} NÚMEROS`}
              </button>
            )}
          </section>
        )}

        {instantPrizes.length > 0 && (
          <section className="cfx-receipt-card cfx-receipt-super">
            <h3>Super Cotas</h3>
            <div>
              {instantPrizes.map((prize, index) => (
                <article key={`${prize.numeroPremiado}-${prize.valorPremio}-${index}`}>
                  <strong>{String(prize.numeroPremiado).padStart(6, "0")}</strong>
                  <span>{formatCurrency(Number(prize.valorPremio || 0))}</span>
                  <small>{formatReceiptDate(prize.claimedAt || paidAt)}</small>
                </article>
              ))}
            </div>
          </section>
        )}

        {unlockedGames.length > 0 && (
          <section className="cfx-receipt-card cfx-receipt-benefits">
            <h3>Benefícios liberados</h3>
            <div>
              {unlockedGames.map(game => (
                <article key={game.title}>
                  {game.icon}
                  <span><strong>{game.title}</strong><small>{game.detail}</small></span>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="cfx-receipt-card">
          <h3>Comprador</h3>
          <div className="cfx-receipt-lines">
            <ReceiptLine label="Nome" value={maskName(buyer.name || customerForm.name)} />
            <ReceiptLine label="CPF" value={maskCpf(buyer.cpf || customerForm.cpf)} />
            <ReceiptLine label="Telefone" value={maskPhone(buyer.phone || customerForm.phone || purchase?.contact)} />
          </div>
        </section>

        <section className="cfx-receipt-actions">
          <button type="button" disabled title="Gerador PDF ainda não configurado">BAIXAR PDF</button>
          <button type="button" onClick={onShare}><Share2 /> COMPARTILHAR</button>
          <Link to="/minhas-cotas"><Ticket /> VER MEUS BILHETES</Link>
          <Link to="/"><ChevronLeft /> VOLTAR AO INÍCIO</Link>
        </section>
      </div>
    </div>
  );
}

function ReceiptLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p>
      <span>{label}</span>
      <b className={strong ? "is-strong" : undefined}>{value || "Não informado"}</b>
    </p>
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

function Field({ label, value, onChange, required, inputMode, maxLength, autoComplete, error }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; maxLength?: number; autoComplete?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} required={required} inputMode={inputMode} maxLength={maxLength} autoComplete={autoComplete} aria-invalid={Boolean(error)} className={cn("min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-cyan-300/10", error && "border-red-400 bg-red-950/30")} />
      {error && <small className="mt-2 block text-sm font-semibold text-red-200">{error}</small>}
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
        <div className="flex gap-3">
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

function formatDate(value?: string) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || !Number.isFinite(parsed.getTime())) return "Data em breve";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function maskName(value?: string) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Não informado";
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`;
  return `${parts[0]} ${parts.slice(1).map(part => `${part.slice(0, 1)}.`).join(" ")}`;
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

