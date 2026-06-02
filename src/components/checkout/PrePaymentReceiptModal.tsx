import type React from "react";
import { CreditCard, Gift, ShieldCheck, UserRound } from "lucide-react";
import { CheckoutModalShell, CheckoutPrimaryButton } from "../premium/PremiumUI";
import { CheckoutCampaignMedia } from "./CheckoutCampaignMedia";
import { FazendinhaCheckoutMedia } from "../FazendinhaCheckoutMedia";
import { cn } from "../../lib/utils";
import type { FazendinhaMediaSlotSettings, PromotionSummary, Raffle } from "../../types";

export type CheckoutPreview = {
  quantity?: number;
  total?: number;
  subtotal?: number;
  pixAmount?: number;
  gateway?: string;
  packageLabel?: string;
  bonuses?: {
    bonusTickets?: number;
    doubleTickets?: { applied: boolean; bonusTickets: number; minTickets?: number; label?: string };
    doubleChance?: boolean;
    roulettes?: number;
    lootboxes?: number;
    scratchcards?: number;
    description?: string;
  };
  walletUsage?: {
    enabled?: boolean;
    amount?: number;
  };
  affiliateInfo?: {
    refCode?: string;
    name?: string;
  };
  promotionSummary?: PromotionSummary;
  upsellOffer?: PromotionSummary["upsellOffer"];
  warnings?: string[];
};

type CustomerData = {
  name?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  city?: string;
  state?: string;
};

type Props = {
  open: boolean;
  campaign?: string;
  raffle?: string;
  raffleData?: Partial<Raffle>;
  mediaUrl?: string;
  mediaType?: Raffle["mediaType"] | Raffle["checkoutMediaType"] | string;
  fazendinhaCheckoutMedia?: Partial<FazendinhaMediaSlotSettings>;
  selectedQuantity?: number;
  selectedPackage?: string;
  calculatedPrice?: number;
  customerData?: CustomerData;
  bonuses?: CheckoutPreview["bonuses"];
  affiliateInfo?: CheckoutPreview["affiliateInfo"];
  walletUsage?: CheckoutPreview["walletUsage"];
  gatewayInfo?: string;
  preview?: CheckoutPreview | null;
  hideMedia?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PrePaymentReceiptModal({
  open,
  campaign,
  raffle,
  raffleData,
  mediaUrl,
  mediaType,
  fazendinhaCheckoutMedia,
  selectedQuantity,
  selectedPackage,
  calculatedPrice,
  customerData,
  bonuses,
  affiliateInfo,
  walletUsage,
  gatewayInfo,
  preview,
  hideMedia = false,
  loading,
  onConfirm,
  onEdit,
  onClose
}: Props) {
  if (!open) return null;
  const mergedBonuses = { ...(bonuses || {}), ...(preview?.bonuses || {}) };
  const mergedWallet = preview?.walletUsage || walletUsage;
  const mergedAffiliate = preview?.affiliateInfo || affiliateInfo;
  const quantity = preview?.quantity ?? selectedQuantity ?? 0;
  const total = preview?.total ?? calculatedPrice ?? 0;
  const pixAmount = preview?.pixAmount ?? Math.max(0, total - Number(mergedWallet?.amount || 0));
  const gateway = preview?.gateway || gatewayInfo || "PIX";
  const hasCheckoutMedia = Boolean(
    (fazendinhaCheckoutMedia?.enabled && fazendinhaCheckoutMedia.mediaUrl) ||
    (!hideMedia && (mediaUrl || raffleData?.checkoutMediaUrl || raffleData?.mediaUrl || raffleData?.image))
  );

  return (
    // checkout-receipt-overlay is rendered by CheckoutModalShell for receipt variant.
    <CheckoutModalShell
      open={open}
      variant="receipt"
      title="Confirme seus dados"
      eyebrow="Recibo pre-pagamento"
      onClose={onClose}
      compact={!hasCheckoutMedia}
      mediaAware={hasCheckoutMedia ? "with-media" : "compact-no-media"}
      contentClassName={cn("checkout-receipt-body space-y-4 p-3 sm:p-5", !hasCheckoutMedia && "pt-3 sm:pt-4")}
    >
      <div className="max-h-[100dvh] space-y-4 overflow-y-auto" data-media-aware={hasCheckoutMedia ? "with-media" : "compact-no-media"}>
          {fazendinhaCheckoutMedia?.enabled ? (
            <FazendinhaCheckoutMedia {...fazendinhaCheckoutMedia} />
          ) : !hideMedia && (
            <CheckoutCampaignMedia
              campaign={campaign || raffle}
              raffle={raffleData}
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              fallbackTitle={campaign || raffle}
              compact
              showStatus
              showPrice
              priceLabel={`${quantity.toLocaleString("pt-BR")} cotas - ${currency.format(total)}`}
            />
          )}

          <CheckoutReceiptSummary
            campaign={campaign}
            raffle={raffle}
            quantity={quantity}
            total={total}
            selectedPackage={preview?.packageLabel || selectedPackage}
            pixAmount={pixAmount}
            gateway={gateway}
            walletUsage={mergedWallet}
            affiliateInfo={mergedAffiliate}
          />

          <PurchaseBonusesSummary bonuses={mergedBonuses} promotionSummary={preview?.promotionSummary} warnings={preview?.warnings || []} />

          <CustomerDataSummary customerData={customerData} />

          <div className="checkout-actions grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={onEdit} className="checkout-action-button min-h-14 rounded-2xl border border-white/10 bg-white/10 px-5 text-base font-black text-slate-100 transition hover:bg-white/15">
              Alterar Dados
            </button>
            <CheckoutPrimaryButton onClick={onConfirm} disabled={loading} className="checkout-action-button min-h-14 rounded-2xl px-5 text-base font-black disabled:opacity-60">
              {loading ? "Concluindo..." : "Concluir Compra"}
            </CheckoutPrimaryButton>
          </div>

          <p className="flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            O pedido e o PIX so serao gerados apos esta confirmacao.
          </p>
      </div>
    </CheckoutModalShell>
  );
}

export function CheckoutReceiptSummary({
  campaign,
  raffle,
  quantity,
  total,
  selectedPackage,
  pixAmount,
  gateway,
  walletUsage,
  affiliateInfo
}: {
  campaign?: string;
  raffle?: string;
  quantity: number;
  total: number;
  selectedPackage?: string;
  pixAmount: number;
  gateway?: string;
  walletUsage?: CheckoutPreview["walletUsage"];
  affiliateInfo?: CheckoutPreview["affiliateInfo"];
}) {
  return (
    <CheckoutCard>
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <CreditCard className="h-4 w-4 text-emerald-300" />
        <h3 className="font-black">Resumo da Compra</h3>
      </div>
      <SummaryRow label="Campanha" value={campaign || "Campanha"} />
      <SummaryRow label="Sorteio" value={raffle || campaign || "Sorteio"} />
      <SummaryRow label="Cotas" value={quantity.toLocaleString("pt-BR")} />
      {selectedPackage && <SummaryRow label="Pacote escolhido" value={selectedPackage} />}
      {affiliateInfo?.refCode && <SummaryRow label="Afiliado aplicado" value={affiliateInfo.name || affiliateInfo.refCode} />}
      {walletUsage?.enabled && <SummaryRow label="Saldo usado" value={currency.format(Number(walletUsage.amount || 0))} />}
      <SummaryRow label="Gateway" value={String(gateway || "PIX").toUpperCase()} />
      <SummaryRow label="Valor restante no PIX" value={currency.format(pixAmount)} strong />
      <SummaryRow label="Valor" value={currency.format(total)} strong />
    </CheckoutCard>
  );
}

export function CustomerDataSummary({ customerData }: { customerData?: CustomerData }) {
  const now = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <CheckoutCard tone="customer">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <UserRound className="h-4 w-4 text-emerald-200" />
        <h3 className="font-black">Seus Dados</h3>
      </div>
      <SummaryRow label="Nome" value={customerData?.name || "Nao informado"} />
      <SummaryRow label="Telefone" value={customerData?.phone || "Nao informado"} />
      <SummaryRow label="E-mail" value={customerData?.email || "Nao informado"} />
      <SummaryRow label="CPF" value={customerData?.cpf || "Nao informado"} />
      <SummaryRow label="Cidade" value={[customerData?.city, customerData?.state].filter(Boolean).join(" - ") || "Nao informado"} />
      <SummaryRow label="Data/hora da confirmação" value={now} />
    </CheckoutCard>
  );
}

export function PurchaseBonusesSummary({ bonuses, promotionSummary, warnings }: { bonuses?: CheckoutPreview["bonuses"]; promotionSummary?: PromotionSummary; warnings?: string[] }) {
  const items = [
    bonuses?.bonusTickets ? [`Bônus`, `${bonuses.bonusTickets} cotas extras`] : null,
    bonuses?.doubleTickets?.applied ? [bonuses.doubleTickets.label || "Cotas em dobro", `+${bonuses.doubleTickets.bonusTickets} cotas extras reais`] : null,
    bonuses?.doubleChance ? ["Chance em dobro", "Ativa"] : null,
    bonuses?.roulettes ? ["Roletas recebidas", String(bonuses.roulettes)] : null,
    bonuses?.lootboxes ? ["Caixinhas recebidas", String(bonuses.lootboxes)] : null,
    bonuses?.scratchcards ? ["Raspadinhas recebidas", String(bonuses.scratchcards)] : null,
    bonuses?.description ? ["Benefício", bonuses.description] : null,
    promotionSummary?.luckyHour?.applied ? ["Hora Premiada", promotionSummary.luckyHour.label] : null,
    promotionSummary?.upsellOffer ? ["Oferta antes do PIX", `${promotionSummary.upsellOffer.extraTickets} cotas por ${currency.format(promotionSummary.upsellOffer.extraAmount)}`] : null,
    ...(promotionSummary?.rewards || []).map(reward => [reward.label, `${reward.quantity} ${reward.type}`] as [string, string])
  ].filter(Boolean) as Array<[string, string]>;

  if (!items.length && !warnings?.length) return null;

  return (
    <CheckoutCard tone="bonus">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <Gift className="h-4 w-4 text-amber-200" />
        <h3 className="font-black">Bônus e Avisos</h3>
      </div>
      {items.map(([label, value]) => (
        <div key={label}>
          <SummaryRow label={label} value={value} />
        </div>
      ))}
      {warnings?.map(warning => (
        <p key={warning} className="mt-2 rounded-xl bg-black/25 px-3 py-2 text-sm font-semibold text-amber-100">{warning}</p>
      ))}
    </CheckoutCard>
  );
}

function CheckoutCard({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "customer" | "bonus" }) {
  return (
    <div className={cn(
      "checkout-card rounded-[1.35rem] border p-4 text-white",
      tone === "default" && "border-white/10 bg-white/[0.045]",
      tone === "customer" && "border-emerald-300/22 bg-emerald-300/[0.085]",
      tone === "bonus" && "border-amber-200/24 bg-amber-300/[0.105]"
    )}>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="checkout-summary-row flex items-start justify-between gap-4 border-t border-white/10 py-2 first:border-t-0">
      <span className="checkout-summary-label text-sm text-slate-300">{label}</span>
      <strong className={cn("checkout-summary-value text-right text-sm text-white", strong && "text-base")}>{value}</strong>
    </div>
  );
}
