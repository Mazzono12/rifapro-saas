import React, { useEffect, useState } from "react";
import { Camera, Copy, DollarSign, Link2, Save, Send, ToggleLeft, ToggleRight, TrendingUp, UploadCloud, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCustomerStore } from "../store/useCustomerStore";
import type { AffiliateStats } from "../types";
import { MessageVideoPlayer } from "../components/MessageVideoPlayer";
import { uploadCustomerProfilePhoto } from "../utils/customerMedia";

export function Affiliates() {
  const { customer, setCustomer } = useCustomerStore();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [pixKey, setPixKey] = useState("");
  const [useBalance, setUseBalance] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!customer) return;
    fetch(`/api/affiliates/${customer.affiliateRefCode}`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setPixKey(data.pixKey || "");
        setUseBalance(Boolean(data.useBalanceForPurchases));
        const balance = Number(data.commissionBalance ?? data.commission ?? 0) + Number(data.prizeBalance || 0);
        setWithdrawAmount(balance ? balance.toFixed(2) : "");
        setCustomer({ ...customer, affiliate: data });
      })
      .catch(() => null);
  }, [customer?.affiliateRefCode]);

  useEffect(() => {
    fetch("/api/settings").then(res => res.json()).then(setSettings).catch(() => null);
  }, []);

  const copyLink = () => {
    if (!customer) return;
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${customer.affiliateRefCode}`);
    toast.success("Link de afiliado copiado");
  };

  const saveAffiliate = async () => {
    if (!customer) return;
    const res = await fetch(`/api/affiliates/${customer.affiliateRefCode}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixKey, useBalanceForPurchases: useBalance }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao salvar afiliado");
      return;
    }
    setStats(data);
    setCustomer({ ...customer, affiliate: data });
    toast.success("Preferências de afiliado salvas");
  };

  const uploadAffiliatePhoto = async (file?: File) => {
    if (!customer || !file) return;
    setUploadingPhoto(true);
    try {
      const updatedCustomer = await uploadCustomerProfilePhoto(customer.id, file);
      if (!updatedCustomer) return;
      setCustomer({ ...updatedCustomer, affiliate: stats || updatedCustomer.affiliate });
      toast.success("Foto compartilhada atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao subir foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const requestWithdrawal = async () => {
    if (!customer || !stats) return;
    if (!pixKey.trim()) {
      toast.error("Configure sua chave PIX antes de solicitar saque");
      return;
    }
    setIsWithdrawing(true);
    try {
      const res = await fetch(`/api/affiliates/${customer.affiliateRefCode}/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixKey, amount: Number(withdrawAmount || 0) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao solicitar saque");
      setStats(data.affiliate);
      setCustomer({ ...customer, affiliate: data.affiliate });
      toast.success("Solicitação de saque enviada", {
        description: "O admin foi notificado para fazer a transferência manual no banco."
      });
    } catch (error: any) {
      toast.error("Saque não solicitado", { description: error.message });
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!customer) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">
        <div className="glass-card p-10 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <h1 className="text-3xl font-display font-bold">Programa de Afiliados</h1>
          <p className="text-slate-400 mt-3">Seu link único será criado automaticamente quando você fizer seu primeiro cadastro no checkout.</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const rules = stats.rules;
  const eligible = stats.enabled;
  const commissionBalance = stats.commissionBalance ?? stats.commission ?? 0;
  const prizeBalance = stats.prizeBalance ?? 0;
  const totalBalance = commissionBalance + prizeBalance;
  const canWithdraw = totalBalance >= (rules?.minWithdrawAmount || 0);
  const chartData = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((name, i) => ({
    name,
    ganhos: Math.max(0, commissionBalance * ((i + 1) / 8)),
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 pt-4">
      <div className="flex flex-col justify-between gap-4 border-b border-white/[0.05] pb-5 pt-0 md:flex-row">
        <div>
          <h1 className="text-4xl font-display font-medium text-white">Painel de Afiliado</h1>
          <p className="text-slate-400 text-sm mt-2">
            Comissão fixa de {rules?.commissionRate}% por compra indicada. Mínimo para participar: {rules?.minTicketsToJoin} cotas compradas.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/[0.03] p-2 rounded-2xl border border-white/5 pr-4">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
            {customer.photoUrl ? (
              <img src={customer.photoUrl} alt={customer.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-slate-500">
                <Camera className="h-5 w-5" />
              </div>
            )}
          </div>
          <Link2 className="w-5 h-5 text-white ml-2" />
          <span className="text-sm font-mono text-white truncate max-w-[180px]">?ref={customer.affiliateRefCode}</span>
          <button onClick={copyLink} className="neon-button px-4 py-2 rounded-xl text-xs flex items-center gap-2"><Copy className="w-3 h-3" /> Copiar</button>
        </div>
      </div>

      {!eligible && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">
          Compre mais {Math.max(0, (rules?.minTicketsToJoin || 0) - customer.totalTickets)} cota(s) para liberar o cadastro ativo no programa de afiliados.
        </div>
      )}

      {settings?.affiliateInstructionVideo?.enabled && settings.affiliateInstructionVideo?.mediaUrl && (
        <section className="glass-card overflow-hidden p-4 md:p-6">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-xs font-mono uppercase tracking-[0.24em] text-neon-cyan">Treinamento do afiliado</p>
            <h2 className="font-display text-2xl font-bold text-white">
              {settings.affiliateInstructionVideo.title || "Como divulgar seu link"}
            </h2>
            {settings.affiliateInstructionVideo.description && (
              <p className="text-sm text-slate-400">{settings.affiliateInstructionVideo.description}</p>
            )}
          </div>
          <div className="aspect-video overflow-hidden rounded-3xl border border-white/10 bg-black">
            <MessageVideoPlayer
              mediaUrl={settings.affiliateInstructionVideo.mediaUrl}
              mediaType={settings.affiliateInstructionVideo.mediaType}
              config={{ ...(settings.affiliateInstructionVideo.videoConfig || {}), showControls: false, tapToUnmute: false }}
              className="h-full w-full"
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Metric icon={DollarSign} label="Comissões" value={`R$ ${commissionBalance.toFixed(2)}`} />
        <Metric icon={TrophyIcon} label="Saldo de prêmios" value={`R$ ${prizeBalance.toFixed(2)}`} />
        <Metric icon={Users} label="Afiliados" value={String(stats.referredCustomers)} />
        <Metric icon={TrendingUp} label="Receita gerada" value={`R$ ${stats.revenue.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 glass-card p-8">
          <h3 className="text-xl font-display font-medium text-white mb-8">Receita por indicação</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="name" stroke="#ffffff30" axisLine={false} tickLine={false} />
                <YAxis stroke="#ffffff30" axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.85)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <Area type="monotone" dataKey="ganhos" stroke="#ffffff" fill="#ffffff18" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-cyber-900">
                {customer.photoUrl ? (
                  <img src={customer.photoUrl} alt={customer.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-slate-500">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-white">{customer.name}</p>
                <p className="text-xs text-slate-500">Mesma foto do perfil do cliente</p>
              </div>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-3 text-sm font-bold text-neon-cyan transition hover:bg-neon-cyan/15">
              <UploadCloud className="h-4 w-4" /> {uploadingPhoto ? "Enviando..." : "Escolher foto ou GIF da galeria"}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp"
                disabled={uploadingPhoto}
                onChange={event => {
                  uploadAffiliatePhoto(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
                className="sr-only"
              />
            </label>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">Chave PIX para saque</label>
            <input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="CPF, telefone, e-mail ou aleatória" className="w-full px-4 py-3" />
          </div>
          <button type="button" onClick={() => setUseBalance(!useBalance)} className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
            <span className="text-sm text-white">Usar saldo para comprar cotas</span>
            {useBalance ? <ToggleRight className="w-7 h-7 text-emerald-400" /> : <ToggleLeft className="w-7 h-7 text-slate-500" />}
          </button>
          <button onClick={saveAffiliate} className="w-full neon-button py-3 rounded-xl flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
          {canWithdraw && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
              <label className="block text-xs font-mono uppercase tracking-widest text-emerald-200">Valor sacável</label>
              <input
                type="number"
                min={rules?.minWithdrawAmount || 0}
                max={totalBalance}
                step="0.01"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                className="w-full px-4 py-3"
              />
              <button
                type="button"
                onClick={requestWithdrawal}
                disabled={isWithdrawing}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> {isWithdrawing ? "Enviando..." : "Solicitar saque"}
              </button>
            </div>
          )}
          {!canWithdraw && (
            <button disabled className="w-full py-3 rounded-xl border border-emerald-500/30 text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed">
              Solicitar saque PIX • R$ {totalBalance.toFixed(2)}
            </button>
          )}
          <p className="text-[11px] text-slate-500 font-mono">
            Saque mínimo: R$ {(rules?.minWithdrawAmount || 0).toFixed(2)}. Premios de caixinha e cotas premiadas entram no saldo de premios.
          </p>
        </div>
      </div>
    </div>
  );
}

function TrophyIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Wallet {...props} />;
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="glass-card p-6">
      <Icon className="w-6 h-6 text-neon-cyan mb-4" />
      <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-display text-white mt-2">{value}</p>
    </div>
  );
}
