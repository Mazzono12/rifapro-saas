import React, { useEffect, useState } from "react";
import { Settings, Save, Layout, Package, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { useTheme } from "../../context/theme/ThemeContext";
import { themes, type ThemeId } from "../../themes";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { defaultVideoConfig, VideoSettingsEditor } from "../../components/admin/VideoSettingsEditor";
import { BrandingSettingsForm } from "../../components/branding/BrandingSettingsForm";
import { ThemeBuilder } from "../../components/branding/ThemeBuilder";
import { useTenantBranding } from "../../context/tenant-branding/TenantBrandingContext";

const paletteFields = [
  ["--theme-primary", "Primária", "#9bdcff"],
  ["--theme-secondary", "Secundária", "#b8b7ff"],
  ["--theme-accent", "Acento", "#78f7df"],
  ["--theme-bg", "Fundo", "#05070d"],
  ["--theme-bg-soft", "Fundo suave", "#111827"],
  ["--theme-surface", "Superfície", "#111827"],
  ["--theme-text", "Texto", "#f8fbff"],
  ["--theme-button-text", "Texto botão", "#030712"],
] as const;

export function AdminConfig({ initialTab = "settings" }: { initialTab?: "settings" | "branding" }) {
  const { themeId, setThemeId, previewTheme, clearPreview, applyPaletteOverrides } = useTheme();
  const { refresh: refreshTenantBranding } = useTenantBranding();
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<any>(null);
  const [builder, setBuilder] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    branding: {
      companyName: "NexusDraw",
      logoUrl: "",
      logoAlt: "NexusDraw"
    },
    theme: {
      defaultTheme: "vimeu_dark",
      paletteOverrides: {}
    },
    footer: {
      companyName: "NexusDraw",
      cnpj: "",
      email: "",
      mission: "",
      terms: "",
      faq: "",
      ownerName: "CIFHER",
      ownerLogoUrl: "",
      ownerContact: "",
      ownerSocial: ""
    },
    storiesPosition: "bottom",
    storiesPlacements: ["home-bottom"],
    lootboxEconomy: {
       ticketsPerBox: 3,
       globalTicketsCounter: 0,
       boxRules: [],
       milestones: [],
       effects: {
          autoOpen: false,
          sfx: true,
          vfx: true,
          confetti: true
       }
    },
    affiliateProgram: {
      commissionRate: 10,
      minTicketsToJoin: 5,
      minWithdrawAmount: 50,
      allowBalancePayments: true
    },
    mainVideoPlayer: defaultVideoConfig,
    affiliateInstructionVideo: {
      enabled: true,
      title: "Como divulgar seu link",
      description: "",
      mediaUrl: "",
      mediaType: "video",
      videoConfig: { ...defaultVideoConfig, showControls: false, tapToUnmute: false }
    },
    socialLinks: {
      whatsapp: "",
      instagram: "",
      group: ""
    }
  });

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/admin/branding")
      .then(res => res.json())
      .then(setBranding)
      .catch(() => null);
  }, []);

  useEffect(() => {
    fetch("/api/admin/theme-builder")
      .then(res => res.json())
      .then(setBuilder)
      .catch(() => null);
  }, []);

  const saveBranding = async () => {
    const res = await fetch("/api/admin/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding)
    });
    if (!res.ok) throw new Error("Nao foi possivel salvar aparencia");
    setBranding(await res.json());
    await refreshTenantBranding();
    toast.success("Aparencia salva");
  };

  const resetBranding = async () => {
    const res = await fetch("/api/admin/branding/reset", { method: "POST" });
    if (!res.ok) throw new Error("Nao foi possivel resetar aparencia");
    setBranding(await res.json());
    await refreshTenantBranding();
    toast.success("Aparencia resetada");
  };

  const saveThemeBuilder = async () => {
    const res = await fetch("/api/admin/theme-builder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(builder?.template || {})
    });
    if (!res.ok) throw new Error("Nao foi possivel salvar construtor");
    const template = await res.json();
    setBuilder({ ...builder, template });
    await refreshTenantBranding();
    toast.success("Construtor salvo");
  };

  const publishThemeBuilder = async () => {
    const res = await fetch("/api/admin/theme-builder/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: builder?.template?.id })
    });
    if (!res.ok) throw new Error("Nao foi possivel publicar tema");
    const template = await res.json();
    setBuilder({ ...builder, template });
    await refreshTenantBranding();
    toast.success("Tema publicado");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar configurações");
      setThemeId(settings.theme?.defaultTheme || themeId);
      applyPaletteOverrides(settings.theme?.paletteOverrides || {});
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configurações", {
        description: error instanceof Error ? error.message : "Verifique sua sessão e tente novamente."
      });
    }
  };

  const updateMilestone = (index: number, field: string, value: any) => {
    const newMilestones = [...settings.lootboxEconomy.milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    setSettings({ ...settings, lootboxEconomy: { ...settings.lootboxEconomy, milestones: newMilestones }});
  };

  const addMilestone = () => {
    setSettings({
      ...settings,
      lootboxEconomy: {
         ...settings.lootboxEconomy,
         milestones: [...settings.lootboxEconomy.milestones, { tier: "mini", everyXTickets: 500, name: "R$ 10", type: "pix", value: 10, currentCounter: 0 }]
      }
    });
  };

  const removeMilestone = (index: number) => {
    const newMilestones = settings.lootboxEconomy.milestones.filter((_: any, i: number) => i !== index);
    setSettings({ ...settings, lootboxEconomy: { ...settings.lootboxEconomy, milestones: newMilestones }});
  };

  const updateBoxRule = (index: number, field: string, value: number) => {
    const boxRules = [...(settings.lootboxEconomy.boxRules || [])];
    boxRules[index] = { ...boxRules[index], [field]: value };
    setSettings({ ...settings, lootboxEconomy: { ...settings.lootboxEconomy, boxRules }});
  };

  const addBoxRule = () => {
    const boxRules = [...(settings.lootboxEconomy.boxRules || []), { tickets: 3, boxes: 1 }];
    setSettings({ ...settings, lootboxEconomy: { ...settings.lootboxEconomy, boxRules }});
  };

  const removeBoxRule = (index: number) => {
    const boxRules = (settings.lootboxEconomy.boxRules || []).filter((_: any, i: number) => i !== index);
    setSettings({ ...settings, lootboxEconomy: { ...settings.lootboxEconomy, boxRules }});
  };

  const toggleStoryPlacement = (placement: string) => {
    const current = settings.storiesPlacements || [];
    const storiesPlacements = current.includes(placement)
      ? current.filter((item: string) => item !== placement)
      : [...current, placement];
    setSettings({ ...settings, storiesPlacements });
  };

  const chooseDefaultTheme = (nextThemeId: ThemeId) => {
    setThemeId(nextThemeId);
    setSettings({
      ...settings,
      theme: {
        ...(settings.theme || {}),
        defaultTheme: nextThemeId
      }
    });
  };

  const updatePaletteToken = (token: string, value: string) => {
    const paletteOverrides = {
      ...(settings.theme?.paletteOverrides || {}),
      [token]: value
    };
    applyPaletteOverrides(paletteOverrides);
    setSettings({
      ...settings,
      theme: {
        ...(settings.theme || {}),
        paletteOverrides
      }
    });
  };

  const resetPalette = () => {
    applyPaletteOverrides({});
    setSettings({
      ...settings,
      theme: {
        ...(settings.theme || {}),
        paletteOverrides: {}
      }
    });
  };

  const updateMainVideoConfig = (patch: Record<string, any>) => {
    setSettings({
      ...settings,
      mainVideoPlayer: {
        ...defaultVideoConfig,
        ...(settings.mainVideoPlayer || {}),
        ...patch
      }
    });
  };

  const updateMainVideoLabel = (field: string, value: string) => {
    const config = { ...defaultVideoConfig, ...(settings.mainVideoPlayer || {}) };
    updateMainVideoConfig({
      labels: {
        ...(defaultVideoConfig.labels || {}),
        ...(config.labels || {}),
        [field]: value
      }
    });
  };

  const updateAffiliateVideo = (patch: Record<string, any>) => {
    setSettings({
      ...settings,
      affiliateInstructionVideo: {
        enabled: true,
        title: "Como divulgar seu link",
        description: "",
        mediaUrl: "",
        mediaType: "video",
        videoConfig: { ...defaultVideoConfig, showControls: false, tapToUnmute: false },
        ...(settings.affiliateInstructionVideo || {}),
        ...patch
      }
    });
  };

  const updateAffiliateVideoConfig = (patch: Record<string, any>) => {
    const current = settings.affiliateInstructionVideo || {};
    updateAffiliateVideo({
      videoConfig: {
        ...defaultVideoConfig,
        ...(current.videoConfig || {}),
        ...patch,
        showControls: false,
        tapToUnmute: false
      }
    });
  };

  const updateAffiliateVideoLabel = (field: string, value: string) => {
    const currentConfig = settings.affiliateInstructionVideo?.videoConfig || {};
    updateAffiliateVideoConfig({
      labels: {
        ...(defaultVideoConfig.labels || {}),
        ...(currentConfig.labels || {}),
        [field]: value
      }
    });
  };

  if (initialTab === "branding") {
    return (
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-3xl font-display font-medium text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-emerald-300" /> Configuracoes de Aparencia
          </h1>
          <p className="mt-2 text-sm text-slate-400">Nome, logo, GIF animado, favicon, cores, slogan, WhatsApp e rodape do tenant.</p>
        </div>
        {branding ? (
          <BrandingSettingsForm
            value={branding}
            onChange={setBranding}
            onSave={() => saveBranding().catch(error => toast.error(error.message))}
            onReset={() => resetBranding().catch(error => toast.error(error.message))}
            logoEndpoint="/api/admin/branding/logo"
            faviconEndpoint="/api/admin/branding/favicon"
          />
        ) : (
          <div className="glass-card rounded-3xl p-8 text-slate-400">Carregando aparencia...</div>
        )}
        {builder ? (
          <ThemeBuilder
            data={builder}
            onChange={setBuilder}
            onSave={() => saveThemeBuilder().catch(error => toast.error(error.message))}
            onPublish={() => publishThemeBuilder().catch(error => toast.error(error.message))}
          />
        ) : (
          <div className="glass-card rounded-3xl p-8 text-slate-400">Carregando construtor visual...</div>
        )}
      </div>
    );
  }

  if (loading) return null;

  return (
    <div className="space-y-8 fade-in">
       <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-display font-medium text-white flex items-center gap-3">
               <Settings className="w-8 h-8 text-slate-400" /> Configurações Globais
            </h1>
         </div>
       </div>

       <form onSubmit={handleSave} className="space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* UI Settings */}
            <div className="glass-card p-6 border border-white/5 rounded-3xl space-y-6">
               <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                  <Layout className="w-5 h-5 text-neon-cyan" />
                  <h2 className="text-xl font-display font-medium text-white">Interface (UI)</h2>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <label className="space-y-2 md:col-span-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Nome da empresa</span>
                   <input value={settings.branding?.companyName || ""} onChange={e => setSettings({...settings, branding: {...settings.branding, companyName: e.target.value}})} className="w-full p-3" />
                 </label>
                 <div className="md:col-span-2">
                   <MediaPicker
                     label="Logo da empresa"
                     value={settings.branding?.logoUrl || ""}
                     mediaType="image"
                      onChange={mediaUrl => setSettings({...settings, branding: {...settings.branding, logoUrl: mediaUrl}})}
                      accept=".jpg,.jpeg,.png,.gif,.webp"
                      allowExternalVideo={false}
                   />
                 </div>
                 <label className="space-y-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Texto alternativo</span>
                   <input value={settings.branding?.logoAlt || ""} onChange={e => setSettings({...settings, branding: {...settings.branding, logoAlt: e.target.value}})} className="w-full p-3" />
                 </label>
               </div>

               <div className="space-y-4">
                 <div className="flex items-center justify-between gap-4">
                   <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Templates premium</label>
                   <span className="text-[10px] font-mono text-slate-500 uppercase">Preview em tempo real</span>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {themes.map((theme) => {
                     const active = (settings.theme?.defaultTheme || themeId) === theme.id;
                     return (
                       <button
                         key={theme.id}
                         type="button"
                         onMouseEnter={() => previewTheme(theme.id)}
                         onFocus={() => previewTheme(theme.id)}
                         onMouseLeave={clearPreview}
                         onBlur={clearPreview}
                         onClick={() => chooseDefaultTheme(theme.id)}
                         className={cn(
                           "group text-left rounded-2xl border p-3 transition-all duration-300 hover:-translate-y-0.5",
                           active
                             ? "border-white/25 bg-white/[0.08] shadow-[0_0_34px_var(--theme-glow)]"
                             : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.055]"
                         )}
                       >
                         <span className="mb-3 block h-16 rounded-xl border border-white/10 shadow-inner" style={{ background: theme.preview }} />
                         <span className="block text-sm font-display text-white">{theme.name}</span>
                         <span className="mt-1 block text-[11px] text-slate-400">{theme.description}</span>
                       </button>
                     );
                   })}
                 </div>
               </div>

               <div className="space-y-4">
                 <div className="flex items-center justify-between gap-4">
                   <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Paleta dos componentes</label>
                   <button type="button" onClick={resetPalette} className="text-[10px] font-mono uppercase text-slate-400 hover:text-white">
                     Restaurar
                   </button>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {paletteFields.map(([token, label, fallback]) => (
                     <label key={token} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.025] p-3">
                       <span>
                         <span className="block text-xs text-slate-200">{label}</span>
                         <span className="block text-[10px] font-mono text-slate-500">{token}</span>
                       </span>
                       <input
                         type="color"
                         value={settings.theme?.paletteOverrides?.[token] || fallback}
                         onChange={(e) => updatePaletteToken(token, e.target.value)}
                         className="h-10 w-12 rounded-xl border border-white/10 bg-transparent p-1"
                         aria-label={`Alterar ${label}`}
                       />
                     </label>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-widest">Posição dos Stories</label>
                 <select 
                    value={settings.storiesPosition}
                    onChange={(e) => setSettings({...settings, storiesPosition: e.target.value})}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-white/20 transition-all font-mono text-sm"
                 >
                    <option value="top">Topo da página</option>
                    <option value="bottom">Rodapé (Fixado)</option>
                    <option value="floating-left">Flutuante Esquerda</option>
                    <option value="floating-right">Flutuante Direita</option>
                    <option value="hidden">Ocultar Stories</option>
                 </select>
               </div>

               <div>
                 <label className="block text-xs font-mono text-slate-400 mb-3 uppercase tracking-widest">Onde mostrar Stories</label>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {[
                     ["home-top", "Home topo"],
                     ["home-bottom", "Home rodapé"],
                     ["floating-left", "Flutuante esquerda"],
                     ["floating-right", "Flutuante direita"],
                     ["raffle-top", "Página da compra"],
                   ].map(([value, label]) => (
                     <label key={value} className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                       <input type="checkbox" checked={(settings.storiesPlacements || []).includes(value)} onChange={() => toggleStoryPlacement(value)} />
                       {label}
                     </label>
                   ))}
                 </div>
               </div>
            </div>

            <div className="glass-card p-6 border border-white/5 rounded-3xl space-y-6">
               <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                  <Layout className="w-5 h-5 text-cyan-300" />
                  <h2 className="text-xl font-display font-medium text-white">Player de Vídeo</h2>
               </div>
               <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                 <h3 className="font-display text-lg font-bold text-white">Vídeo principal dos sorteios</h3>
                 <p className="mt-1 text-xs text-slate-500">Controla autoplay, som, botões e nomes dos controles nos vídeos da landing e checkout.</p>
                 <VideoSettingsEditor
                   config={{ ...defaultVideoConfig, ...(settings.mainVideoPlayer || {}) }}
                   onChange={updateMainVideoConfig}
                   onLabelChange={updateMainVideoLabel}
                 />
               </div>

               <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 space-y-4">
                 <div className="flex items-center justify-between gap-3">
                   <div>
                     <h3 className="font-display text-lg font-bold text-white">Vídeo de instrução do afiliado</h3>
                     <p className="mt-1 text-xs text-slate-500">Aparece dentro do painel de afiliado do usuário.</p>
                   </div>
                   <label className="flex items-center gap-2 text-xs font-mono uppercase text-slate-300">
                     <input
                       type="checkbox"
                       checked={Boolean(settings.affiliateInstructionVideo?.enabled ?? true)}
                       onChange={e => updateAffiliateVideo({ enabled: e.target.checked })}
                     />
                     Ativo
                   </label>
                 </div>
                 <div className="grid gap-3 md:grid-cols-2">
                   <label className="space-y-2">
                     <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Título</span>
                     <input
                       value={settings.affiliateInstructionVideo?.title || ""}
                       onChange={e => updateAffiliateVideo({ title: e.target.value })}
                       className="w-full p-3"
                     />
                   </label>
                   <label className="space-y-2">
                     <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Descrição</span>
                     <input
                       value={settings.affiliateInstructionVideo?.description || ""}
                       onChange={e => updateAffiliateVideo({ description: e.target.value })}
                       className="w-full p-3"
                     />
                   </label>
                 </div>
                 <MediaPicker
                   label="Mídia do vídeo de instrução"
                   value={settings.affiliateInstructionVideo?.mediaUrl || ""}
                   mediaType={settings.affiliateInstructionVideo?.mediaType || "video"}
                   onChange={(mediaUrl, mediaType) => updateAffiliateVideo({ mediaUrl, mediaType })}
                 />
                 <VideoSettingsEditor
                   config={{ ...defaultVideoConfig, ...(settings.affiliateInstructionVideo?.videoConfig || {}), showControls: false, tapToUnmute: false }}
                   onChange={updateAffiliateVideoConfig}
                   onLabelChange={updateAffiliateVideoLabel}
                   lockHiddenControls
                 />
               </div>
            </div>

            <div className="glass-card p-6 border border-white/5 rounded-3xl space-y-6">
               <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                  <Settings className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-xl font-display font-medium text-white">Afiliados & Social</h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <label className="space-y-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Comissão (%)</span>
                   <input type="number" min="0" value={settings.affiliateProgram?.commissionRate || 0} onChange={e => setSettings({...settings, affiliateProgram: {...settings.affiliateProgram, commissionRate: Number(e.target.value)}})} className="w-full p-3" />
                 </label>
                 <label className="space-y-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Cotas mínimas</span>
                   <input type="number" min="0" value={settings.affiliateProgram?.minTicketsToJoin || 0} onChange={e => setSettings({...settings, affiliateProgram: {...settings.affiliateProgram, minTicketsToJoin: Number(e.target.value)}})} className="w-full p-3" />
                 </label>
                 <label className="space-y-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Saque mínimo</span>
                   <input type="number" min="0" value={settings.affiliateProgram?.minWithdrawAmount || 0} onChange={e => setSettings({...settings, affiliateProgram: {...settings.affiliateProgram, minWithdrawAmount: Number(e.target.value)}})} className="w-full p-3" />
                 </label>
               </div>
               <label className="flex items-center gap-2 text-xs font-mono text-slate-300">
                 <input type="checkbox" checked={Boolean(settings.affiliateProgram?.allowBalancePayments)} onChange={e => setSettings({...settings, affiliateProgram: {...settings.affiliateProgram, allowBalancePayments: e.target.checked}})} />
                 Permitir usar saldo de afiliado para comprar cotas
               </label>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <input value={settings.socialLinks?.whatsapp || ""} onChange={e => setSettings({...settings, socialLinks: {...settings.socialLinks, whatsapp: e.target.value}})} placeholder="Link WhatsApp" className="w-full p-3" />
                 <input value={settings.socialLinks?.instagram || ""} onChange={e => setSettings({...settings, socialLinks: {...settings.socialLinks, instagram: e.target.value}})} placeholder="Link Instagram" className="w-full p-3" />
                 <label className="space-y-2 md:col-span-2">
                   <span className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-widest">
                     <Users className="h-4 w-4" /> Link do grupo para compradores
                   </span>
                   <input
                     value={settings.socialLinks?.group || ""}
                     onChange={e => setSettings({...settings, socialLinks: {...settings.socialLinks, group: e.target.value}})}
                     placeholder="https://chat.whatsapp.com/seu-grupo"
                     className="w-full p-3"
                   />
                   <span className="block text-[11px] text-slate-500">Este link alimenta o botão público “Participar do grupo” no cabeçalho/flutuante das páginas de compra.</span>
                 </label>
               </div>
            </div>

            <div className="glass-card p-6 border border-white/5 rounded-3xl space-y-6">
               <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                  <Layout className="w-5 h-5 text-neon-purple" />
                  <h2 className="text-xl font-display font-medium text-white">Rodapé & Institucional</h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                   ["companyName", "Nome da empresa"],
                   ["cnpj", "CNPJ"],
                   ["email", "E-mail"],
                   ["ownerName", "Dona do sistema"],
                   ["ownerContact", "Contato da dona do sistema"],
                   ["ownerSocial", "Rede social da dona do sistema"],
                 ].map(([field, label]) => (
                   <label key={field} className="space-y-2">
                     <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</span>
                     <input value={settings.footer?.[field] || ""} onChange={e => setSettings({...settings, footer: {...settings.footer, [field]: e.target.value}})} className="w-full p-3" />
                   </label>
                 ))}
               </div>
               <MediaPicker
                 label="Logo da dona do sistema"
                 value={settings.footer?.ownerLogoUrl || ""}
                 mediaType="image"
                  onChange={mediaUrl => setSettings({...settings, footer: {...settings.footer, ownerLogoUrl: mediaUrl}})}
                  accept=".jpg,.jpeg,.png,.gif,.webp"
                  allowExternalVideo={false}
               />
               <div className="grid grid-cols-1 gap-4">
                 {[
                   ["mission", "Missão"],
                   ["terms", "Termos de uso"],
                   ["faq", "FAQ"],
                 ].map(([field, label]) => (
                   <label key={field} className="space-y-2">
                     <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</span>
                     <textarea value={settings.footer?.[field] || ""} onChange={e => setSettings({...settings, footer: {...settings.footer, [field]: e.target.value}})} className="w-full min-h-24 p-3" />
                   </label>
                 ))}
               </div>
            </div>

            {/* Lootbox Economy Configuration */}
            <div className="glass-card p-6 border border-white/5 rounded-3xl space-y-6">
               <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                  <Package className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-display font-medium text-white">Economia Caixinha Oculta</h2>
               </div>
               
               <div>
                 <div className="flex items-center justify-between mb-4">
                   <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Caixinhas por cotas compradas</label>
                   <button type="button" onClick={addBoxRule} className="text-xs text-amber-400 hover:text-white transition-colors bg-amber-400/10 px-2 py-1 rounded">+ Regra</button>
                 </div>
                 <div className="space-y-3">
                   {(settings.lootboxEconomy.boxRules || [{ tickets: settings.lootboxEconomy.ticketsPerBox, boxes: 1 }]).map((rule: any, idx: number) => (
                     <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                       <label className="text-[10px] font-mono text-slate-500 uppercase">
                         A cada cotas
                         <input type="number" min="1" value={rule.tickets} onChange={e => updateBoxRule(idx, "tickets", Number(e.target.value))} className="mt-1 w-full bg-black/50 border border-white/10 rounded text-white text-xs p-2 outline-none" />
                       </label>
                       <label className="text-[10px] font-mono text-slate-500 uppercase">
                         Ganha aberturas
                         <input type="number" min="1" value={rule.boxes} onChange={e => updateBoxRule(idx, "boxes", Number(e.target.value))} className="mt-1 w-full bg-black/50 border border-white/10 rounded text-white text-xs p-2 outline-none" />
                       </label>
                       <button type="button" onClick={() => removeBoxRule(idx)} className="self-end p-2 hover:text-red-500 text-slate-500">X</button>
                     </div>
                   ))}
                 </div>
                 <p className="text-[10px] text-slate-500 mt-2 font-mono">A melhor regra proporcional é aplicada. A roleta só aparece após pagamento confirmado.</p>
               </div>

               <div>
                 <div className="flex items-center justify-between mb-4 mt-6">
                    <label className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Milestones de Premiação</label>
                    <button type="button" onClick={addMilestone} className="text-xs text-amber-400 hover:text-white transition-colors bg-amber-400/10 px-2 py-1 rounded">
                      + Adicionar
                    </button>
                 </div>
                 
                 <div className="space-y-3">
                    {settings.lootboxEconomy.milestones.map((milestone: any, idx: number) => (
                       <div key={idx} className="flex flex-col gap-2 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <select value={milestone.tier || 'mini'} onChange={(e) => updateMilestone(idx, 'tier', e.target.value)} className="bg-black/50 border border-white/10 rounded text-white text-xs p-1 outline-none">
                              <option value="mini">Mini</option>
                              <option value="medio">Médio</option>
                              <option value="alto">Alto</option>
                            </select>
                            <span className="text-xs font-mono text-slate-500 uppercase">A CADA</span>
                            <input 
                               type="number" 
                               value={milestone.everyXTickets} 
                               onChange={(e) => updateMilestone(idx, 'everyXTickets', Number(e.target.value))}
                               className="w-20 bg-black/50 border border-white/10 rounded text-white text-xs p-1 outline-none text-center"
                               placeholder="Cotas"
                               title="Cotas Global Vendidas"
                            />
                            <span className="text-xs font-mono text-slate-500 uppercase">COTAS</span>
                            <button type="button" onClick={() => removeMilestone(idx)} className="p-1 hover:text-red-500 text-slate-500 ml-auto">X</button>
                          </div>
                          
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={milestone.name} 
                                onChange={(e) => updateMilestone(idx, 'name', e.target.value)}
                                className="flex-1 bg-black/50 border border-white/10 text-white rounded text-xs p-2 outline-none"
                                placeholder="Nome do Prêmio (ex: 50ão)"
                             />
                             <input 
                                type="text"
                                value={milestone.type}
                                onChange={(e) => updateMilestone(idx, 'type', e.target.value)}
                                className="w-28 bg-black/50 border border-white/10 text-white rounded text-xs p-2 outline-none"
                                placeholder="pix/free_ticket"
                             />
                             <input 
                                type="number" 
                                value={milestone.value} 
                                onChange={(e) => updateMilestone(idx, 'value', Number(e.target.value))}
                                className="w-20 bg-black/50 border border-white/10 text-white rounded text-xs p-2 outline-none text-center"
                                placeholder="R$"
                             />
                          </div>
                       </div>
                    ))}
                 </div>

                 <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                     <label className="flex items-center gap-2 text-xs font-mono text-slate-300">
                        <input type="checkbox" checked={settings.lootboxEconomy.effects.vfx} onChange={(e) => setSettings({...settings, lootboxEconomy: { ...settings.lootboxEconomy, effects: { ...settings.lootboxEconomy.effects, vfx: e.target.checked } }})} className="rounded bg-black/50 border border-white/10" />
                        Efeitos Visuais Premium
                     </label>
                     <label className="flex items-center gap-2 text-xs font-mono text-slate-300">
                        <input type="checkbox" checked={settings.lootboxEconomy.effects.confetti} onChange={(e) => setSettings({...settings, lootboxEconomy: { ...settings.lootboxEconomy, effects: { ...settings.lootboxEconomy.effects, confetti: e.target.checked } }})} className="rounded bg-black/50 border border-white/10" />
                        Confete na Vitória
                     </label>
                 </div>
               </div>
            </div>
         </div>
         
         <div className="flex justify-end pt-4">
           <button type="submit" className="neon-button px-8 py-4 rounded-xl flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
              <Save className="w-4 h-4" /> Salvar Configurações
           </button>
         </div>
       </form>
    </div>
  );
}
