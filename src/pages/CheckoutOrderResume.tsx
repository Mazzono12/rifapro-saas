import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Clock3, Coins, Copy, FileText, MessageCircle, RefreshCw, ShieldCheck, Ticket, User, Users, WalletCards, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PixPaymentCard, PremiumPageLayout } from "../components/premium/PremiumUI";
import { PublicBrandMark } from "../components/branding/PublicBrandMark";
import { useTenantBranding } from "../context/tenant-branding/TenantBrandingContext";

type ResumeStatus = {
  orderId: string;
  type?: "raffle" | "fazendinha" | "modalidade";
  status?: "pending" | "paid" | "cancelled" | "expired" | "reserved";
  paymentStatus?: "pending" | "paid" | "cancelled" | "expired";
  paid?: boolean;
  expired?: boolean;
  pixPayload?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiresAt?: string;
  reservedUntil?: string;
  purchase?: Record<string, any>;
  ticketUrl?: string;
  message?: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CheckoutOrderResume() {
  const { orderId = "" } = useParams();
  const { branding } = useTenantBranding();
  const [status, setStatus] = useState<ResumeStatus | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [affiliateCopied, setAffiliateCopied] = useState(false);
  const [error, setError] = useState("");

  const supportUrl = normalizeWhatsAppUrl(String(settings?.socialLinks?.whatsapp || branding.support_whatsapp || "").trim());
  const purchase = status?.purchase || {};
  const campaignName = getCampaignName(status);
  const amount = Number(purchase.amount || purchase.valorPago || status?.purchase?.total || 0);
  const expiresAt = status?.pixExpiresAt || status?.reservedUntil || purchase.pixExpiresAt || purchase.reservedUntil || "";
  const remaining = useRemainingTime(expiresAt);
  const campaignPath = getCampaignPath(status);
  const purchasedNumbers = getPurchasedNumbers(status);
  const receiptUrl = String(purchase.receiptUrl || purchase.receipt_url || purchase.comprovanteUrl || purchase.comprovante_url || purchase.invoiceUrl || purchase.invoice_url || "").trim();
  const paidAt = String(purchase.paidAt || purchase.paid_at || purchase.updatedAt || purchase.updated_at || purchase.createdAt || purchase.created_at || "");
  const affiliateCode = String(purchase.affiliateRefCode || purchase.affiliate_ref_code || purchase.refCode || purchase.ref_code || purchase.customer?.affiliateRefCode || purchase.customer?.affiliate_ref_code || purchase.customer?.refCode || purchase.customer?.ref_code || "").trim();
  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const affiliateLink = affiliateCode && publicOrigin ? `${publicOrigin}/?r=${affiliateCode}` : "";
  const affiliateStats = getAffiliateStats(purchase);
  const whatsappShareUrl = affiliateLink ? `https://wa.me/?text=${encodeURIComponent(buildReceiptWhatsAppMessage(affiliateLink))}` : "";
  const pending = Boolean(status && !status.paid && !status.expired && (status.paymentStatus === "pending" || status.status === "pending" || status.status === "reserved"));
  const pixPayload = pending ? String(status?.pixPayload || purchase.pixPayload || purchase.pix_payload || purchase.pixCopyPaste || purchase.pix_copy_paste || purchase.copyPaste || purchase.paymentCode || "") : "";
  const pixQrCode = pending ? String(status?.pixQrCode || status?.pixQrCodeBase64 || purchase.pixQrCode || purchase.qrCode || purchase.pixQrCodeBase64 || purchase.qrCodeBase64 || purchase.qr_code_base64 || purchase.encodedImage || "") : "";

  const loadStatus = async (quiet = false) => {
    if (!orderId) return;
    if (quiet) setChecking(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/checkout/orders/${orderId}/status`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || "Pedido nao encontrado");
      setStatus(data);
      if (quiet) toast.success(data.paid ? "Pagamento confirmado" : data.expired ? "Reserva expirada" : "Pagamento ainda pendente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o pedido");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [orderId]);

  useEffect(() => {
    fetch("/api/settings")
      .then(response => response.ok ? response.json() : null)
      .then(payload => setSettings(payload && typeof payload === "object" ? payload : null))
      .catch(() => null);
  }, []);

  const copyPix = async () => {
    if (!pixPayload) return;
    const copiedOk = await copyTextToClipboard(pixPayload);
    if (!copiedOk) {
      toast.error("Nao foi possivel copiar o PIX", { description: "Toque e segure no codigo copia e cola para selecionar manualmente." });
      return;
    }
    setCopied(true);
    toast.success("Codigo PIX copiado");
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyAffiliateLink = async () => {
    if (!affiliateLink) {
      toast.info("Ative seu cadastro de afiliado para gerar seu link.");
      return;
    }
    const copiedOk = await copyTextToClipboard(affiliateLink);
    if (!copiedOk) {
      toast.error("Não foi possível copiar o link");
      return;
    }
    setAffiliateCopied(true);
    toast.success("Link copiado com sucesso!");
    window.setTimeout(() => setAffiliateCopied(false), 2200);
  };

  if (!loading && !error && status?.paid) {
    return (
      <PremiumPageLayout className="checkout-paid-page">
        <main className="checkout-paid-main">
          <section className="checkout-paid-receipt">
            <header className="checkout-paid-header">
              <Link to="/" className="checkout-paid-brand" aria-label="Ir para início">
                <PublicBrandMark eager inline logoClassName="checkout-paid-logo" nameClassName="checkout-paid-brand-name" />
              </Link>
              <Link to="/perfil" className="checkout-paid-profile" aria-label="Abrir perfil"><User /></Link>
            </header>

            <section className="checkout-paid-hero">
              <div className="checkout-paid-check"><CheckCircle2 /></div>
              <h1><span>🎉 Parabéns!</span> Pagamento confirmado</h1>
              <p>Suas cotas foram registradas e já estão participando do sorteio.</p>
              <p className="checkout-paid-hero-highlight"><strong>🚀 Aproveite para aumentar seus ganhos:</strong><br />Indique amigos através do seu link exclusivo e receba recompensas sobre as compras realizadas pelos seus convidados.</p>
            </section>

            <section className="checkout-paid-share">
              <h2><span>✦</span> Ganhe indicando amigos <span>✦</span></h2>
              <p>Seu link exclusivo:</p>
              {affiliateLink ? (
                <>
                  <div className="checkout-paid-linkbox">
                    <span>{affiliateLink}</span>
                    <button type="button" onClick={copyAffiliateLink} aria-label="Copiar link"><Copy /></button>
                  </div>
                  <a href={whatsappShareUrl} target="_blank" rel="noreferrer" className="checkout-paid-whatsapp">
                    <MessageCircle /> <span><strong>Compartilhar no WhatsApp</strong><small>Compartilhe e convide seus amigos</small></span>
                  </a>
                  <button type="button" onClick={copyAffiliateLink} className="checkout-paid-copy">
                    <Copy /> <span><strong>Copiar meu link</strong><small>Copie seu link de afiliado</small></span>
                  </button>
                  {affiliateCopied && <p className="checkout-paid-copy-success"><CheckCircle2 /> Link copiado com sucesso!</p>}
                </>
              ) : (
                <div className="checkout-paid-affiliate-cta">
                  <p>Ative seu cadastro de afiliado para gerar seu link.</p>
                  <Link to="/afiliados">Ativar cadastro</Link>
                </div>
              )}
            </section>

            <section className="checkout-paid-affiliate-stats">
              <article><Users /><strong>{affiliateStats.indicated.toLocaleString("pt-BR")}</strong><span>Indicados</span></article>
              <article><Coins /><strong>{money.format(affiliateStats.commissions)}</strong><span>Comissões Geradas</span></article>
              <article><WalletCards /><strong>{money.format(affiliateStats.balance)}</strong><span>Saldo Disponível</span></article>
            </section>

            <section className="checkout-paid-details">
              <h2><FileText /> Detalhes do pedido</h2>
              <dl>
                <div><dt>Pedido</dt><dd>{status.orderId || orderId}</dd></div>
                <div><dt>Status</dt><dd><span>Pago</span></dd></div>
                <div><dt>Valor</dt><dd>{amount > 0 ? money.format(amount) : "Confirmado"}</dd></div>
                <div><dt>Campanha</dt><dd>{campaignName}</dd></div>
                <div><dt>Data</dt><dd>{formatReceiptDate(paidAt)}</dd></div>
              </dl>
            </section>

            <section className="checkout-paid-numbers">
              <h2><Ticket /> Suas cotas / números</h2>
              {purchasedNumbers.length ? (
                <div>
                  {purchasedNumbers.map((number, index) => <span key={`${number}-${index}`}>{number}</span>)}
                </div>
              ) : (
                <p>Cotas confirmadas. Atualize a página caso os números ainda não apareçam.</p>
              )}
            </section>

            {receiptUrl && <a href={receiptUrl} target="_blank" rel="noreferrer" className="checkout-paid-outline"><FileText /> Ver comprovante</a>}
            <Link to="/meus-bilhetes" className="checkout-paid-outline"><FileText /> Ir para minhas cotas</Link>
          </section>
        </main>
      </PremiumPageLayout>
    );
  }

  return (
    <PremiumPageLayout className="checkout-resume-page">
      <main className="checkout-resume-shell mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-8 pt-5 sm:pb-12 sm:pt-8">
        {loading ? (
          <StateCard icon={<RefreshCw className="h-7 w-7 animate-spin" />} title="Carregando pedido" description="Estamos buscando o PIX salvo para este pedido." />
        ) : error ? (
          <StateCard icon={<XCircle className="h-7 w-7" />} title="Pedido nao encontrado" description={error} action={<Link to="/" className="checkout-return-campaign-button mt-4 w-full">Voltar para campanhas</Link>} />
        ) : status?.expired ? (
          <StateCard
            icon={<XCircle className="h-8 w-8" />}
            title="Reserva expirada"
            description="O prazo desse PIX terminou. Para participar, volte para a campanha e faça uma nova compra."
            action={<Link to={campaignPath} className="checkout-return-campaign-button mt-4 w-full">Voltar a campanha</Link>}
            tone="danger"
          />
        ) : (
          <section className="grid gap-4">
            <div className="checkout-resume-summary-card rounded-2xl border" style={{ background: "#000", backgroundColor: "#000", backgroundImage: "none" }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="premium-eyebrow">Finalize seu PIX</p>
                  <h2 className="mt-2 break-words text-2xl font-black text-white sm:text-3xl">{campaignName}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-300">Sua reserva ainda está ativa. Copie o código PIX abaixo.</p>
                </div>
              </div>
              <div className="checkout-resume-meta-grid mt-4 grid gap-2 sm:grid-cols-3">
                <Info label="Status" value="Pendente" />
                <Info label="Valor" value={amount > 0 ? money.format(amount) : "Aguardando"} />
                <Info label="Pedido" value={status?.orderId || orderId} />
              </div>
            </div>

            {expiresAt && (
              <div className="checkout-resume-timer-card flex items-center gap-3 rounded-2xl border" style={{ background: "#000", backgroundColor: "#000", backgroundImage: "none" }}>
                <Clock3 className="h-6 w-6 shrink-0" />
                <div>
                  <p className="text-sm font-black">Tempo restante da reserva</p>
                  <p className="text-2xl font-black text-white">{remaining}</p>
                </div>
              </div>
            )}

            {pixPayload || pixQrCode ? (
              <div className="checkout-resume-pix-wrap">
                <PixPaymentCard payload={pixPayload} qrImage={pixQrCode} copied={copied} onCopy={copyPix} />
              </div>
            ) : (
              <StateCard icon={<XCircle className="h-7 w-7" />} title="PIX indisponível" description="Não foi possível gerar o PIX. Tente novamente ou fale com o suporte." />
            )}

            <button type="button" onClick={() => loadStatus(true)} disabled={checking} className="premium-button w-full disabled:opacity-60">
              <RefreshCw className={`h-5 w-5 ${checking ? "animate-spin" : ""}`} /> {checking ? "Verificando..." : "Já paguei, verificar"}
            </button>

            {supportUrl && (
              <a href={supportUrl} target="_blank" rel="noreferrer" className="premium-button premium-button-secondary w-full">
                <MessageCircle className="h-5 w-5" /> Falar com suporte
              </a>
            )}

            <div className="checkout-resume-note rounded-2xl border border-white/10 p-4 text-sm font-semibold leading-6 text-slate-300" style={{ background: "#000", backgroundColor: "#000", backgroundImage: "none" }}>
              <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" /> Nao alteramos sua compra, cotas ou pagamento nesta tela.</p>
              <p className="mt-2 flex items-start gap-2"><Ticket className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" /> Ao confirmar o PIX, suas cotas serao liberadas automaticamente.</p>
            </div>
          </section>
        )}
      </main>
    </PremiumPageLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="checkout-resume-info-card rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="checkout-resume-info-label text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="checkout-resume-info-value mt-1 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}

function StateCard({ icon, title, description, action, tone = "default" }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode; tone?: "default" | "success" | "danger" }) {
  const color = tone === "success" ? "text-emerald-200 border-emerald-300/20 bg-emerald-300/[0.08]" : tone === "danger" ? "text-rose-200 border-rose-300/20 bg-rose-300/[0.08]" : "text-cyan-100 border-cyan-300/20 bg-cyan-300/[0.08]";
  return (
    <section className={`premium-card text-center ${color}`}>
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-black/20">{icon}</div>
      <h2 className="text-3xl font-black text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-300">{description}</p>
      {action}
    </section>
  );
}

function getCampaignName(status: ResumeStatus | null) {
  const purchase = status?.purchase || {};
  return String(purchase.raffleTitle || purchase.raffleName || purchase.campaign || purchase.campaignName || purchase.raffle?.title || purchase.mode || purchase.raffleId || (status?.type === "fazendinha" ? "Fazendinha" : "Campanha"));
}

function getCampaignPath(status: ResumeStatus | null) {
  const purchase = status?.purchase || {};
  if (status?.type === "fazendinha") return "/fazendinha";
  if (status?.type === "modalidade" && purchase.mode) return `/${purchase.mode}`;
  if (purchase.raffleId) return `/rifa/${purchase.raffleId}`;
  return "/";
}

function getPurchasedNumbers(status: ResumeStatus | null) {
  const purchase = status?.purchase || {};
  const candidates = [
    purchase.numeros,
    purchase.numbers,
    purchase.ticketsNumbers,
    purchase.ticketNumbers,
    purchase.cotas,
    purchase.grupoIds,
    purchase.groups
  ];
  const values = candidates.find(item => Array.isArray(item) && item.length) || [];
  return values.map((item: unknown) => String(item).trim()).filter(Boolean);
}

function getAffiliateStats(purchase: Record<string, any>) {
  const stats = purchase.affiliateStats || purchase.affiliate_stats || purchase.affiliate || {};
  return {
    indicated: Math.max(0, Number(stats.indicated || stats.customers || stats.referrals || stats.clicks || 0)),
    commissions: Math.max(0, Number(stats.commissions || stats.commissionsTotal || stats.commission || stats.commissionBalance || 0)),
    balance: Math.max(0, Number(stats.balance || stats.availableBalance || stats.availableToWithdraw || stats.commissionBalance || 0))
  };
}

function formatReceiptDate(value?: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data não informada";
  return `${date.toLocaleDateString("pt-BR")} - ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function buildReceiptWhatsAppMessage(link: string) {
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

function useRemainingTime(expiresAt?: string) {
  const target = useMemo(() => expiresAt ? new Date(expiresAt).getTime() : 0, [expiresAt]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!target) return "--:--";
  const remaining = Math.max(0, target - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeWhatsAppUrl(value: string) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

async function copyTextToClipboard(text: string) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback abaixo cobre mobile/WebView em HTTP local.
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
