import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Search, ShieldCheck, ShoppingCart, Trophy } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomerStore } from "../store/useCustomerStore";
import { useNumberMode } from "../hooks/useRaffles";
import { checkoutService, modalidadesService } from "../services/api";
import { PostPurchaseLootboxModal } from "../components/PostPurchaseLootboxModal";
import type { NumberModeId } from "../types";
import { cn } from "../lib/utils";
import {
  FloatingCTA,
  PixPaymentCard,
  PremiumCheckoutModal,
  PremiumHero,
  PremiumPageLayout,
  PremiumTicketReceipt,
  SectionTitle,
  TrustBadges
} from "../components/premium/PremiumUI";
import { NotFoundPage } from "./SystemStatus";
import { PrePaymentReceiptModal, type CheckoutPreview } from "../components/checkout/PrePaymentReceiptModal";
import { useCityDetection } from "../hooks/useCityDetection";
import { GeoPrefillService } from "../services/GeoPrefillService";

const modeTitles: Record<NumberModeId, string> = {
  dezena: "Dezena",
  centena: "Centena",
  milhar: "Milhar"
};

export function NumberModePage() {
  const params = useParams();
  const requestedMode = (params.mode || "dezena") as NumberModeId;
  const isValidMode = Object.prototype.hasOwnProperty.call(modeTitles, requestedMode);
  const mode = isValidMode ? requestedMode : "dezena";
  const { customer, setCustomer } = useCustomerStore();
  const { data, isLoading } = useNumberMode(mode, customer?.id);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", cpf: "", city: "", state: "", accessPassword: "" });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [checkoutPreview, setCheckoutPreview] = useState<CheckoutPreview | null>(null);
  const [requireIdentity, setRequireIdentity] = useState(false);
  const [buying, setBuying] = useState(false);
  const [pendingPix, setPendingPix] = useState<{ purchase: any; pixPayload: string } | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] = useState<{ purchase: any; numbers: string[] } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [lootboxReward, setLootboxReward] = useState({ open: false, count: 0, contact: "" });
  const firstName = (customer?.name || form.name || "").trim().split(/\s+/)[0] || "cliente";
  const { detectedCity } = useCityDetection();

  useEffect(() => {
    if (customer) setForm(current => ({
      name: customer.name,
      phone: customer.phone,
      cpf: customer.cpf,
      city: customer.city || current.city || "",
      state: customer.state || current.state || "",
      accessPassword: customer.accessPassword || ""
    }));
    setRequireIdentity(false);
  }, [customer]);

  useEffect(() => {
    if (!detectedCity?.city) return;
    setForm(current => current.city ? current : { ...current, city: detectedCity.city, state: current.state || detectedCity.state });
  }, [detectedCity]);

  const visibleNumbers = useMemo(() => {
    if (!data) return [];
    return data.numbers
      .filter(item => !search || item.number.includes(search.replace(/\D/g, "")))
      .slice(0, mode === "milhar" && !search ? 500 : 1000);
  }, [data, search, mode]);

  const toggleNumber = (number: string) => {
    setConfirmedReceipt(null);
    setCheckoutPreview(null);
    setSelected(current => current.includes(number) ? current.filter(item => item !== number) : [...current, number]);
  };

  const checkoutCustomerPayload = () => customer
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

  const validateBeforeReceipt = () => {
    if (!selected.length) return toast.error("Selecione ao menos um número");
    if ((!customer || requireIdentity) && !/^\d{6}$/.test(form.accessPassword)) return toast.error("Informe uma senha de acesso com 6 dígitos");
    return true;
  };

  const openPrePaymentReceipt = async () => {
    if (!validateBeforeReceipt()) return;
    setBuying(true);
    try {
      const preview = await checkoutService.preview({
        type: "modalidade",
        mode,
        numbers: selected,
        customer: checkoutCustomerPayload(),
        refCode: localStorage.getItem("refCode") || undefined
      });
      setCheckoutPreview(preview);
      setReceiptOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel calcular o resumo");
    } finally {
      setBuying(false);
    }
  };

  const buy = async () => {
    if (!validateBeforeReceipt()) return;
    setBuying(true);
    try {
      const checkoutCustomer = checkoutCustomerPayload();
      GeoPrefillService.saveManual(checkoutCustomer.city, checkoutCustomer.state);
      const result = await modalidadesService.buyMode(mode, selected, checkoutCustomer, false);
      if (result.purchase?.customer) setCustomer(result.purchase.customer);
      setRequireIdentity(false);
      setReceiptOpen(false);
      setConfirmedReceipt(null);
      setPendingPix({ purchase: result.purchase, pixPayload: result.pixPayload });
      setCopiedPix(false);
      toast.success("PIX gerado", { description: `${selected.length} número(s) em ${data?.config.name}` });
      queryClient.invalidateQueries({ queryKey: ["number-mode", mode] });
      queryClient.invalidateQueries({ queryKey: ["modalidades"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao comprar";
      if (/senha/i.test(message)) {
        setRequireIdentity(true);
        setCheckoutOpen(true);
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
      toast.success("Pagamento confirmado", { description: `${paidPurchase.numbers?.length || selected.length} numero(s) confirmados.` });
      confetti({ particleCount: 100, spread: 65, origin: { y: 0.75 } });
      setConfirmedReceipt({ purchase: paidPurchase, numbers: paidPurchase?.numbers || pendingPix.purchase?.numbers || selected });
      setSelected([]);
      setPendingPix(null);
      if (Number(paidPurchase.earnedLootboxes || 0) > 0) {
        setLootboxReward({
          open: true,
          count: Number(paidPurchase.earnedLootboxes || 0),
          contact: paidPurchase.customer.phone
        });
      }
      queryClient.invalidateQueries({ queryKey: ["number-mode", mode] });
      queryClient.invalidateQueries({ queryKey: ["modalidades"] });
    } catch (error) {
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
    const title = data?.config.name || modeTitles[mode];
    const text = `Compra confirmada em ${title}. Pedido #${confirmedReceipt.purchase.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
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

  if (!["dezena", "centena", "milhar"].includes(mode)) {
    return <div className="container mx-auto px-4 py-24 text-red-300">Modalidade inválida.</div>;
  }

  if (!isValidMode) return <NotFoundPage />;

  if (isLoading || !data) {
    return <div className="container mx-auto px-4 py-24"><div className="h-96 rounded-3xl skeleton" /></div>;
  }

  const total = selected.length * data.config.price;
  const receiptNumbers = confirmedReceipt?.numbers.map(number => Number(number)).filter(Number.isFinite) || [];
  const modalTitle = confirmedReceipt ? "Bilhete confirmado" : pendingPix ? "Pagamento PIX" : "Confirmar participação";
  const checkoutTotal = total || pendingPix?.purchase?.valorPago || confirmedReceipt?.purchase?.valorPago || 0;

  return (
    <PremiumPageLayout className="pb-28">
      <PremiumHero
        eyebrow="Compra rápida"
        title={data.config.name || modeTitles[mode]}
        subtitle={data.config.description || `Escolha seus números na modalidade ${modeTitles[mode]} e pague via PIX automático.`}
        image={data.config.mediaUrl}
        cta={<button type="button" onClick={() => setCheckoutOpen(true)} disabled={!selected.length} className="premium-button px-7 py-4 disabled:opacity-50">Finalizar compra</button>}
      >
        <TrustBadges />
      </PremiumHero>

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="premium-card p-5">
            <SectionTitle eyebrow="Escolha individual" title="Selecione seus números" description={`${data.config.digits} dígitos com zeros preservados.`} compact />
            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Buscar ${"0".repeat(data.config.digits)}`} className="w-full p-3 pl-10" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Prêmio</p>
                <p className="font-black text-white">{data.config.prize}</p>
              </div>
            </div>
            <div className="mt-5 grid max-h-[680px] grid-cols-5 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12">
              {visibleNumbers.map(item => {
                const active = selected.includes(item.number);
                const sold = item.status === "sold";
                return (
                  <button
                    key={item.number}
                    type="button"
                    onClick={() => !sold && toggleNumber(item.number)}
                    disabled={sold}
                    className={cn(
                      "min-h-14 rounded-2xl border px-2 py-3 font-mono text-sm font-black transition active:scale-95",
                      sold ? "border-slate-500/20 bg-slate-500/10 text-slate-500" : active ? "border-lime-200 bg-lime-300 text-slate-950 shadow-[0_0_24px_rgba(190,242,100,0.28)]" : "border-white/10 bg-white/[0.04] text-white hover:border-emerald-200/40"
                    )}
                  >
                    {item.number}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="premium-card p-5">
              <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><ShoppingCart className="h-5 w-5 text-emerald-200" /> Carrinho</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.length === 0 ? <p className="text-sm text-slate-500">Nenhum número selecionado.</p> : selected.map(number => (
                  <button key={number} type="button" onClick={() => toggleNumber(number)} className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 font-mono text-sm font-black text-emerald-100">{number}</button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-mono uppercase text-slate-500">Total</p>
                <p className="font-display text-3xl font-bold text-white">R$ {total.toFixed(2)}</p>
                <p className="text-xs text-slate-500">{selected.length} cota(s)</p>
              </div>
              {customer && (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                  <p className="text-xs font-mono uppercase tracking-widest text-emerald-200">Cliente identificado</p>
                  <p className="mt-1 font-display text-xl font-black text-white">Olá, {(customer.name || "cliente").split(/\s+/)[0]}</p>
                </div>
              )}
              <button type="button" onClick={() => setCheckoutOpen(true)} disabled={!selected.length} className="premium-button mt-4 w-full px-6 py-4 disabled:opacity-50">
                Finalizar compra
              </button>
            </div>

            <div className="premium-card p-5">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Trophy className="h-5 w-5 text-amber-300" /> Top compradores</h2>
              <div className="mt-4 space-y-3">
                {data.ranking.length === 0 ? <p className="text-sm text-slate-500">Ranking em formação.</p> : data.ranking.map((buyer, index) => (
                  <div key={`${buyer.phone}-${index}`} className="flex justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">
                    <span className="text-white">{index + 1}. {buyer.name}</span>
                    <span className="font-mono text-emerald-200">{buyer.tickets}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>

      <PremiumCheckoutModal open={checkoutOpen} title={modalTitle} onClose={() => setCheckoutOpen(false)}>
        <div className="space-y-5 p-4 sm:p-5">
          {confirmedReceipt ? (
            <>
              <PremiumTicketReceipt
                title={data.config.name || modeTitles[mode]}
                purchaseId={confirmedReceipt.purchase.id}
                numbers={receiptNumbers}
                onShare={shareConfirmedReceipt}
              />
              <button type="button" onClick={() => setCheckoutOpen(false)} className="premium-button w-full">
                Voltar para campanha
              </button>
            </>
          ) : pendingPix ? (
            <>
              <div className="premium-card border-emerald-300/20 bg-emerald-300/[0.07] text-center">
                <p className="premium-eyebrow text-emerald-100">PIX gerado</p>
                <h3 className="mt-2 text-2xl font-black text-white">R$ {checkoutTotal.toFixed(2)}</h3>
                <p className="mt-2 text-sm text-slate-300">Escaneie o QR Code ou copie o código PIX.</p>
              </div>
              <PixPaymentCard payload={pendingPix.pixPayload} copied={copiedPix} onCopy={copyPixPayload} />
              <button type="button" onClick={checkPixPayment} disabled={buying} className="premium-button min-h-14 w-full disabled:opacity-50">
                {buying ? "Consultando status..." : "Confirmar PIX"}
              </button>
            </>
          ) : (
            <>
              <div className="premium-card border-emerald-300/20 bg-emerald-300/[0.07]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="premium-eyebrow text-emerald-100">Resumo da compra</p>
                    <h3 className="mt-2 text-3xl font-black text-white">{selected.length} cota(s)</h3>
                    <p className="mt-2 text-sm text-slate-300">{data.config.name || modeTitles[mode]}</p>
                  </div>
                  <div className="rounded-2xl bg-black/25 px-4 py-3 text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Total</p>
                    <p className="text-2xl font-black text-emerald-100">R$ {total.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 max-h-36 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3 font-mono text-sm text-slate-200">
                  {selected.join(", ")}
                </div>
              </div>

              {customer && !requireIdentity ? (
                <div className="premium-card border-emerald-300/20 bg-emerald-300/[0.08]">
                  <p className="premium-eyebrow text-emerald-100">Cliente identificado</p>
                  <p className="mt-2 text-xl font-black text-white">Olá, {firstName}. Boa sorte!</p>
                </div>
              ) : customer && requireIdentity ? (
                <div className="premium-card grid gap-3 border-emerald-300/20 bg-emerald-300/[0.08]">
                  <p className="premium-eyebrow text-emerald-100">Cliente identificado</p>
                  <p className="text-sm font-semibold text-emerald-100">Confirme apenas sua senha de acesso para concluir a compra.</p>
                  <input value={form.accessPassword} onChange={event => setForm({ ...form, accessPassword: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="Senha de acesso com 6 dígitos" className="p-4" />
                </div>
              ) : (
                <div className="premium-card grid gap-3">
                  <p className="premium-eyebrow">Dados do comprador</p>
                  <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Nome completo" className="p-4" />
                  <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="WhatsApp" className="p-4" />
                  <input value={form.cpf} onChange={event => setForm({ ...form, cpf: event.target.value })} placeholder="CPF" className="p-4" />
                  <div className="grid gap-3 sm:grid-cols-[1fr_92px]">
                    <input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} placeholder="Cidade" className="p-4" />
                    <input value={form.state} onChange={event => setForm({ ...form, state: event.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" className="p-4 uppercase" />
                  </div>
                  <button type="button" onClick={useMyLocation} className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-left text-sm font-semibold text-emerald-100">
                    Preencher cidade por geolocalização
                  </button>
                  <input value={form.accessPassword} onChange={event => setForm({ ...form, accessPassword: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="Senha de acesso com 6 dígitos" className="p-4" />
                </div>
              )}

              <button type="button" onClick={openPrePaymentReceipt} disabled={buying || !selected.length} className="premium-button min-h-14 w-full disabled:opacity-50">
                <CheckCircle2 className="h-5 w-5" /> {buying ? "Calculando resumo..." : `Revisar compra - R$ ${total.toFixed(2)}`}
              </button>
              <p className="flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-200" /> Compra segura, PIX automático e bilhete liberado após confirmação.
              </p>
            </>
          )}
        </div>
      </PremiumCheckoutModal>

      <PrePaymentReceiptModal
        open={receiptOpen}
        campaign={data.config.name || modeTitles[mode]}
        raffle={modeTitles[mode]}
        selectedQuantity={selected.length}
        selectedPackage={`${selected.length} numero(s)`}
        calculatedPrice={total}
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
        onConfirm={buy}
        onEdit={() => setReceiptOpen(false)}
        onClose={() => setReceiptOpen(false)}
      />

      <FloatingCTA
        label="Finalizar compra"
        meta={selected.length ? `${selected.length} cotas - R$ ${total.toFixed(2)}` : "Escolha seus números"}
        onClick={() => setCheckoutOpen(true)}
      />

      <PostPurchaseLootboxModal
        isOpen={lootboxReward.open}
        onClose={() => setLootboxReward(current => ({ ...current, open: false }))}
        earnedCount={lootboxReward.count}
        contact={lootboxReward.contact}
        config={data.config.lootboxConfig}
      />
    </PremiumPageLayout>
  );
}

async function captureGeoLocation() {
  return GeoPrefillService.captureCoordinates();
}
