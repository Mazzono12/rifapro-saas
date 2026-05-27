import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import { Camera, ChevronRight, LockKeyhole, Package, Save, Ticket, UploadCloud, User, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useCustomerStore } from "../store/useCustomerStore";
import { uploadCustomerProfilePhoto } from "../utils/customerMedia";
import { PremiumPageLayout, SectionTitle } from "../components/premium/PremiumUI";

export function Dashboard() {
  const location = useLocation();
  const { customer, setCustomer } = useCustomerStore();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", photoUrl: "", city: "", state: "", accessPassword: "" });
  const [areaPassword, setAreaPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isProfile = location.pathname === "/perfil";

  useEffect(() => {
    if (!customer) return;
    setUnlocked(false);
    setAreaPassword("");
    setForm({
      name: customer.name,
      phone: customer.phone,
      photoUrl: customer.photoUrl || "",
      city: customer.city || "",
      state: customer.state || "",
      accessPassword: ""
    });
    fetch(`/api/customers/${customer.id}/purchases`).then(res => res.json()).then(setPurchases).catch(() => null);
  }, [customer?.id]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        accessPassword: form.accessPassword || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao salvar perfil");
      return;
    }
    setCustomer(data);
    toast.success("Perfil atualizado");
  };

  const uploadProfilePhoto = async (file?: File) => {
    if (!customer || !file) return;
    setUploadingPhoto(true);
    try {
      const updatedCustomer = await uploadCustomerProfilePhoto(customer.id, file);
      if (!updatedCustomer) return;
      setCustomer(updatedCustomer);
      setForm(current => ({ ...current, photoUrl: updatedCustomer.photoUrl || "" }));
      toast.success("Foto do perfil atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao subir foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const unlockArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!/^\d{6}$/.test(areaPassword)) {
      toast.error("A senha deve ter 6 dígitos");
      return;
    }
    if (customer.accessPassword && areaPassword !== customer.accessPassword) {
      toast.error("Senha incorreta");
      return;
    }
    if (!customer.accessPassword) {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessPassword: areaPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao definir senha");
        return;
      }
      setCustomer(data);
      toast.success("Senha de acesso criada");
    }
    setUnlocked(true);
  };

  if (!customer) {
    return (
      <PremiumPageLayout className="px-4 pb-10 pt-6">
      <div className="container mx-auto max-w-xl">
        <div className="glass-card p-8 text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <h1 className="text-2xl font-display font-bold">Acesse suas cotas</h1>
          <p className="text-slate-400 mb-6">Seu cadastro é criado automaticamente na primeira compra, na etapa do PIX.</p>
          <Link to="/" className="neon-button inline-flex px-6 py-3 rounded-xl">Comprar cotas</Link>
        </div>
      </div>
      </PremiumPageLayout>
    );
  }

  if (!unlocked) {
    return (
      <PremiumPageLayout className="px-4 pb-10 pt-6">
      <div className="container mx-auto max-w-xl">
        <form onSubmit={unlockArea} className="glass-card p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-display font-bold">Área do cliente</h1>
          <p className="mt-2 text-slate-400">
            {customer.accessPassword ? "Digite sua senha de 6 dígitos para ver suas informações." : "Crie uma senha simples de 6 dígitos para proteger seus dados."}
          </p>
          <input
            value={areaPassword}
            onChange={e => setAreaPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="mt-6 w-full px-5 py-4 text-center font-mono text-2xl tracking-[0.35em]"
          />
          <button className="neon-button mt-5 w-full rounded-xl py-4">
            {customer.accessPassword ? "Acessar informações" : "Criar senha e acessar"}
          </button>
        </form>
      </div>
      </PremiumPageLayout>
    );
  }

  const tabs = [
    { label: "Minhas Cotas", icon: Ticket, path: "/minhas-cotas" },
    { label: "Meus Afiliados", icon: Users, path: "/afiliados" },
    { label: "Meu Perfil", icon: User, path: "/perfil" },
  ];

  return (
    <PremiumPageLayout className="px-4 pb-8 pt-4">
    <div className="container mx-auto max-w-6xl">
      <div className="mb-6">
        <SectionTitle eyebrow="Área do cliente" title="Meus bilhetes e perfil" description="Comprovantes, histórico e dados protegidos em uma experiência mobile-first." compact />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 lg:col-span-3 space-y-6">
          <div className="glass-card p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple p-1 mx-auto mb-4">
              <div className="w-full h-full bg-cyber-900 rounded-full overflow-hidden flex items-center justify-center">
                {customer.photoUrl ? <img src={customer.photoUrl} alt={customer.name} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-slate-400" />}
              </div>
            </div>
            <h2 className="text-xl font-bold font-display">{customer.name}</h2>
            <p className="text-sm text-slate-400">CPF {customer.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-xs font-semibold">
              {customer.totalTickets} cotas compradas
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <nav className="flex flex-col">
              {tabs.map(tab => {
                const active = location.pathname === tab.path || (!isProfile && tab.path === "/minhas-cotas");
                return (
                  <Link key={tab.path} to={tab.path} className={cn("flex items-center justify-between p-4 text-left transition-colors border-b last:border-0 border-white/5", active ? "bg-white/5 border-l-2 border-l-neon-cyan" : "hover:bg-white/5 text-slate-400 hover:text-white")}>
                    <div className="flex items-center gap-3">
                      <tab.icon className={cn("w-5 h-5", active ? "text-neon-cyan" : "")} />
                      <span className="font-medium">{tab.label}</span>
                    </div>
                    {!active && <ChevronRight className="w-4 h-4 text-slate-500" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="md:col-span-8 lg:col-span-9">
          {isProfile ? (
            <form onSubmit={saveProfile} className="glass-card p-6 md:p-8 space-y-6">
              <h1 className="text-2xl font-display font-bold flex items-center gap-3"><User className="w-6 h-6 text-neon-cyan" /> Meu Perfil</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Nome</span>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Telefone</span>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Cidade</span>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-3" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">UF</span>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} className="w-full px-4 py-3 uppercase" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">CPF bloqueado</span>
                  <input value={customer.cpf} disabled className="w-full px-4 py-3 opacity-60 cursor-not-allowed" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-mono text-slate-400 uppercase flex items-center gap-2"><Camera className="w-4 h-4" /> Foto do perfil</span>
                  <span className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-3 text-sm font-bold text-neon-cyan transition hover:bg-neon-cyan/15">
                    <UploadCloud className="w-4 h-4" /> {uploadingPhoto ? "Enviando..." : "Escolher foto ou GIF da galeria"}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.webp"
                      disabled={uploadingPhoto}
                      onChange={event => {
                        uploadProfilePhoto(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                      className="sr-only"
                    />
                  </span>
                  {form.photoUrl && <p className="break-all text-xs text-slate-500">Foto atual: {form.photoUrl}</p>}
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">Trocar senha de acesso</span>
                  <input
                    value={form.accessPassword}
                    onChange={e => setForm({ ...form, accessPassword: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full px-4 py-3"
                    placeholder="Nova senha com 6 dígitos"
                  />
                </label>
              </div>
              <button className="neon-button px-6 py-3 rounded-xl flex items-center gap-2"><Save className="w-4 h-4" /> Salvar dados</button>
            </form>
          ) : (
            <div className="glass-card p-6 md:p-8 min-h-[500px]">
              <h1 className="text-2xl font-display font-bold mb-6 flex items-center gap-3"><Package className="w-6 h-6 text-neon-cyan" /> Minhas Cotas</h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5"><Wallet className="w-5 h-5 text-emerald-400 mb-3" /><p className="text-xs text-slate-500 font-mono uppercase">Comissões</p><p className="text-2xl text-white">R$ {(customer.affiliate?.commissionBalance ?? customer.affiliate?.commission ?? 0).toFixed(2)}</p></div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5"><Wallet className="w-5 h-5 text-amber-300 mb-3" /><p className="text-xs text-slate-500 font-mono uppercase">Prêmios</p><p className="text-2xl text-white">R$ {(customer.affiliate?.prizeBalance || 0).toFixed(2)}</p></div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5"><Ticket className="w-5 h-5 text-neon-cyan mb-3" /><p className="text-xs text-slate-500 font-mono uppercase">Total cotas</p><p className="text-2xl text-white">{customer.totalTickets}</p></div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5"><Users className="w-5 h-5 text-neon-purple mb-3" /><p className="text-xs text-slate-500 font-mono uppercase">Link afiliado</p><p className="text-sm text-white truncate">?ref={customer.affiliateRefCode}</p></div>
              </div>
              <div className="space-y-4">
                {purchases.length === 0 ? <p className="text-slate-500 text-center py-10">Nenhuma compra encontrada.</p> : purchases.map((item, idx) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={item.purchaseId} className="bg-cyber-900/50 border border-white/5 p-5 rounded-xl">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                      <h3 className="font-bold text-lg">Pedido #{item.purchaseId}</h3>
                        <p className="text-sm text-slate-400">
                          {item.raffleTitle || item.raffleId} • {new Date(item.createdAt).toLocaleDateString("pt-BR")} • {item.tickets} cotas
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedPurchase(expandedPurchase === item.purchaseId ? null : item.purchaseId)}
                          className="rounded-xl border border-neon-cyan/30 px-4 py-2 text-xs font-mono uppercase tracking-widest text-neon-cyan hover:bg-neon-cyan/10"
                        >
                          {expandedPurchase === item.purchaseId ? "Ocultar cotas" : "Ver cotas"}
                        </button>
                        <span className={cn("px-3 py-1 rounded-full text-xs font-semibold border", item.status === "paid" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400")}>{String(item.status).toUpperCase()}</span>
                      </div>
                    </div>
                    {expandedPurchase === item.purchaseId && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        {(item.numeros || []).length ? (
                          <div className="flex flex-wrap gap-2">
                            {(item.numeros || []).map((number: number | string, index: number) => (
                              <span key={`${number}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-sm text-white">
                                {typeof number === "number" ? String(number).padStart(6, "0") : number}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">Cotas aguardando aprovação do PIX.</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </PremiumPageLayout>
  );
}
