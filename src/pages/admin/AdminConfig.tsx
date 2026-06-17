import React, { useEffect, useState } from "react";
import { Settings, Save, Layout, Package, Users, Banknote, BadgeHelp, CheckCircle2, Clock3, Gift, HandCoins, Link2, Medal, Percent, Plus, ShieldCheck, Trash2, Trophy, Wallet } from "lucide-react";
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

const defaultAffiliateLevelConfig = [
  { id: "BRONZE", label: "Bronze", emoji: "🥉", threshold: 0, commissionRate: 0, enabled: true },
  { id: "PRATA", label: "Prata", emoji: "🥈", threshold: 10000, commissionRate: 0, enabled: true },
  { id: "OURO", label: "Ouro", emoji: "🥇", threshold: 50000, commissionRate: 0, enabled: true },
  { id: "DIAMANTE", label: "Diamante", emoji: "💎", threshold: 200000, commissionRate: 0, enabled: true },
  { id: "IMPERADOR", label: "Imperador", emoji: "👑", threshold: 1000000, commissionRate: 0, enabled: true },
  { id: "LENDARIO", label: "Lendário", emoji: "🔥", threshold: 5000000, commissionRate: 0, enabled: true }
];

function normalizeAffiliateLevelConfig(config: any[] = []) {
  return defaultAffiliateLevelConfig.map(defaultLevel => {
    const saved = Array.isArray(config) ? config.find(item => String(item?.id || "").toUpperCase() === defaultLevel.id) : undefined;
    return {
      ...defaultLevel,
      ...(saved || {}),
      label: String(saved?.label || defaultLevel.label),
      threshold: Math.max(0, Number(saved?.threshold ?? defaultLevel.threshold)),
      commissionRate: Math.min(100, Math.max(0, Number(saved?.commissionRate ?? defaultLevel.commissionRate))),
      enabled: saved?.enabled === undefined ? defaultLevel.enabled : Boolean(saved.enabled)
    };
  });
}

function AffiliateHelp({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <BadgeHelp className="h-4 w-4 text-slate-500 transition-colors group-hover:text-emerald-200" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950 p-3 text-xs normal-case leading-5 tracking-normal text-slate-200 shadow-2xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

function AffiliateField({
  label,
  help,
  children
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300">
        {label}
        <AffiliateHelp text={help} />
      </span>
      {children}
      <span className="block text-[11px] leading-5 text-slate-500">{help}</span>
    </label>
  );
}

function AffiliateSection({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10">
          <Icon className="h-5 w-5 text-emerald-200" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function AdminConfig({ initialTab = "settings" }: { initialTab?: "settings" | "branding" }) {
  const { themeId, setThemeId, previewTheme, clearPreview, applyPaletteOverrides } = useTheme();
  const { refresh: refreshTenantBranding } = useTenantBranding();
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<any>(null);
  const [builder, setBuilder] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    branding: {
      companyName: "CIFHER Prime",
      logoUrl: "",
      logoAlt: "CIFHER Prime"
    },
    theme: {
      defaultTheme: "vimeu_dark",
      paletteOverrides: {}
    },
    footer: {
      companyName: "CIFHER Prime",
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
    reservationSettings: {
      raffleMinutes: 15,
      numberModeMinutes: 5,
      fazendinhaMinutes: 5
    },
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
      monthlyActivationAmount: 0,
      minWithdrawAmount: 50,
      allowBalancePayments: true
    },
    publicModules: {
      affiliates: true
    },
    affiliateLevelConfig: defaultAffiliateLevelConfig,
    affiliatePerformanceRewards: {
      enabled: false,
      rules: []
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
    if (!res.ok) throw new Error("Não foi possível salvar aparência");
    setBranding(await res.json());
    await refreshTenantBranding(true);
    toast.success("Aparência salva");
  };

  const resetBranding = async () => {
    const res = await fetch("/api/admin/branding/reset", { method: "POST" });
    if (!res.ok) throw new Error("Não foi possível resetar aparência");
    setBranding(await res.json());
    await refreshTenantBranding(true);
    toast.success("Aparência resetada");
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

  const updateAffiliateProgram = (patch: Record<string, any>) => {
    setSettings({
      ...settings,
      affiliateProgram: {
        ...(settings.affiliateProgram || {}),
        ...patch
      }
    });
  };

  const updatePublicModules = (patch: Record<string, any>) => {
    setSettings({
      ...settings,
      publicModules: {
        affiliates: true,
        ...(settings.publicModules || {}),
        ...patch
      }
    });
  };

  const updateAffiliateLevelConfig = (levelId: string, patch: Record<string, any>) => {
    setSettings({
      ...settings,
      affiliateLevelConfig: normalizeAffiliateLevelConfig(settings.affiliateLevelConfig).map(level =>
        level.id === levelId ? { ...level, ...patch } : level
      )
    });
  };

  const updateReservationSettings = (patch: Record<string, number>) => {
    setSettings({
      ...settings,
      reservationSettings: {
        raffleMinutes: 15,
        numberModeMinutes: 5,
        fazendinhaMinutes: 5,
        ...(settings.reservationSettings || {}),
        ...patch
      }
    });
  };

  const updateAffiliatePerformanceRewards = (patch: Record<string, any>) => {
    setSettings({
      ...settings,
      affiliatePerformanceRewards: {
        ...(settings.affiliatePerformanceRewards || { enabled: false, rules: [] }),
        ...patch
      }
    });
  };

  const addAffiliateRewardRule = () => {
    const current = settings.affiliatePerformanceRewards || { enabled: false, rules: [] };
    const rules = Array.isArray(current.rules) ? current.rules : [];
    updateAffiliatePerformanceRewards({
      rules: [
        ...rules,
        {
          id: `AFR_${Date.now()}`,
          name: `Regra ${rules.length + 1}`,
          enabled: true,
          goalType: "sales_count",
          threshold: 5,
          rewardType: "scratchcard",
          rewardQuantity: 1,
          createdAt: new Date().toISOString()
        }
      ]
    });
  };

  const updateAffiliateRewardRule = (index: number, patch: Record<string, any>) => {
    const current = settings.affiliatePerformanceRewards || { enabled: false, rules: [] };
    const rules = Array.isArray(current.rules) ? [...current.rules] : [];
    rules[index] = { ...rules[index], ...patch };
    updateAffiliatePerformanceRewards({ rules });
  };

  const removeAffiliateRewardRule = (index: number) => {
    const current = settings.affiliatePerformanceRewards || { enabled: false, rules: [] };
    const rules = Array.isArray(current.rules) ? current.rules.filter((_: any, itemIndex: number) => itemIndex !== index) : [];
    updateAffiliatePerformanceRewards({ rules });
  };

  if (initialTab === "branding") {
    return (
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-3xl font-display font-medium text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-emerald-300" /> Configurações de Aparência
          </h1>
          <p className="mt-2 text-sm text-slate-400">Nome, logo, GIF animado, favicon, cores, frase institucional, WhatsApp e rodape da empresa.</p>
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

  const affiliateProgram = settings.affiliateProgram || {};
  const commissionRate = Math.max(0, Number(affiliateProgram.commissionRate || 0));
  const minTicketsToJoin = Math.max(0, Number(affiliateProgram.minTicketsToJoin || 0));
  const minWithdrawAmount = Math.max(0, Number(affiliateProgram.minWithdrawAmount || 0));
  const monthlyActivationAmount = Math.max(0, Number(affiliateProgram.monthlyActivationAmount || 0));
  const affiliateLevelConfig = normalizeAffiliateLevelConfig(settings.affiliateLevelConfig);
  const performanceRewards = settings.affiliatePerformanceRewards || { enabled: false, rules: [] };
  const performanceRewardRules = Array.isArray(performanceRewards.rules) ? performanceRewards.rules : [];
  const rewardGoalOptions = [
    ["sales_count", "Quantidade de vendas"],
    ["customers_count", "Quantidade de clientes"],
    ["revenue_amount", "Valor vendido"],
    ["commission_amount", "Valor comissionado"]
  ];
  const rewardTypeOptions = [
    ["scratchcard", "Raspadinha"],
    ["wheel_spin", "Giro na roleta"],
    ["super_quota", "Super cota"],
    ["bonus_number", "Número bônus"],
    ["future_reward", "Recompensa futura"]
  ];
  const previewTicketValue = 100;
  const previewCommission = Number((previewTicketValue * (commissionRate / 100)).toFixed(2));

  return (
    <div className="space-y-8 fade-in">
       <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-display font-medium text-white flex items-center gap-3">
               <Settings className="w-8 h-8 text-slate-400" /> Configurações do Ambiente
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
                  <Clock3 className="w-5 h-5 text-emerald-300" />
                  <h2 className="text-xl font-display font-medium text-white">Reservas</h2>
               </div>
               <p className="text-sm leading-6 text-slate-400">
                 Configure por quanto tempo compras pendentes mantem cotas, numeros ou bichos reservados antes de expirarem automaticamente.
               </p>
               <div className="grid gap-4 md:grid-cols-3">
                 <label className="space-y-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Rifa tradicional</span>
                   <input
                     type="number"
                     min="1"
                     max="1440"
                     value={settings.reservationSettings?.raffleMinutes ?? 15}
                     onChange={e => updateReservationSettings({ raffleMinutes: Math.max(1, Number(e.target.value) || 15) })}
                     className="w-full p-3"
                   />
                   <small className="text-[11px] text-slate-500">Padrao: 15 minutos</small>
                 </label>
                 <label className="space-y-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Dezena/Centena/Milhar</span>
                   <input
                     type="number"
                     min="1"
                     max="1440"
                     value={settings.reservationSettings?.numberModeMinutes ?? 5}
                     onChange={e => updateReservationSettings({ numberModeMinutes: Math.max(1, Number(e.target.value) || 5) })}
                     className="w-full p-3"
                   />
                   <small className="text-[11px] text-slate-500">Padrao: 5 minutos</small>
                 </label>
                 <label className="space-y-2">
                   <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">Fazendinha</span>
                   <input
                     type="number"
                     min="1"
                     max="1440"
                     value={settings.reservationSettings?.fazendinhaMinutes ?? 5}
                     onChange={e => updateReservationSettings({ fazendinhaMinutes: Math.max(1, Number(e.target.value) || 5) })}
                     className="w-full p-3"
                   />
                   <small className="text-[11px] text-slate-500">Padrao: 5 minutos</small>
                 </label>
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

            <div className="glass-card p-6 border border-white/5 rounded-3xl space-y-6 md:col-span-2">
               <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                  <HandCoins className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-xl font-display font-medium text-white">Programa de Afiliados</h2>
                    <p className="mt-1 text-xs text-slate-500">Configure comissões, prêmios, saques e indicação sem mexer em campos técnicos.</p>
                  </div>
               </div>
               <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
                 <label className="flex items-start gap-3 text-sm text-slate-300">
                   <input
                     type="checkbox"
                     checked={settings.publicModules?.affiliates !== false}
                     onChange={e => updatePublicModules({ affiliates: e.target.checked })}
                     className="mt-1"
                   />
                   <span>
                     <strong className="flex items-center gap-2 text-white">
                       <Users className="h-4 w-4 text-emerald-200" />
                       Exibir Área de Afiliados na página pública
                     </strong>
                     <span className="mt-1 block text-xs leading-5 text-slate-500">
                       Quando desativado, a Home e o menu público deixam de exibir chamadas para afiliados. A rota continua disponível.
                     </span>
                   </span>
                 </label>
               </div>
               <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                 <div className="grid gap-4">
                   <AffiliateSection icon={Percent} title="Comissão" description="Defina quanto o afiliado recebe por cada venda aprovada.">
                     <div className="grid gap-4 md:grid-cols-3">
                       <AffiliateField label="Comissão padrão do programa (%)" help="Percentual usado nas novas compras pagas dos indicados diretos, salvo quando o afiliado tiver comissão especial.">
                         <input type="number" min="0" max="100" step="0.01" value={commissionRate} onChange={e => updateAffiliateProgram({ commissionRate: Math.min(100, Math.max(0, Number(e.target.value))) })} placeholder="Ex.: 10" className="w-full p-3" />
                       </AffiliateField>
                       <AffiliateField label="Comissão vitalícia" help="As indicações continuam vinculadas ao afiliado pelo código de convite.">
                         <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-3 text-sm font-bold text-emerald-100">Ativa pelo código de indicação</div>
                       </AffiliateField>
                       <AffiliateField label="Comissão recorrente" help="Quando houver pagamentos recorrentes, a regra comercial segue a comissão padrão.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-bold text-slate-200">Preparada para recorrência</div>
                       </AffiliateField>
                     </div>
                   </AffiliateSection>

                   <AffiliateSection icon={Trophy} title="Rankings da campanha" description="Top Vendedores e Top Compradores são calculados por campanha, usando apenas compras pagas do tenant atual.">
                     <div className="grid gap-3 md:grid-cols-2">
                       <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                         <p className="text-sm font-black text-white">Top Vendedores</p>
                         <p className="mt-2 text-xs leading-5 text-slate-400">Considera vendas pagas geradas por indicados diretos do afiliado na campanha selecionada.</p>
                       </div>
                       <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                         <p className="text-sm font-black text-white">Top Compradores</p>
                         <p className="mt-2 text-xs leading-5 text-slate-400">Considera compradores reais da campanha, sem misturar outros tenants ou outras campanhas.</p>
                       </div>
                     </div>
                   </AffiliateSection>

                   <AffiliateSection icon={Medal} title="Status visual do afiliado" description="Configure nomes e metas visuais. Estes status não alteram a comissão.">
                     <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-semibold text-amber-100">
                       A comissão é definida apenas pela comissão padrão do programa ou pela comissão especial do afiliado.
                     </div>
                     <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                       {affiliateLevelConfig.map(level => (
                         <div key={level.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                           <div className="mb-4 flex items-center justify-between gap-3">
                             <div className="min-w-0">
                               <p className="text-sm font-black text-white">{level.emoji} {level.label}</p>
                               <p className="mt-1 text-xs text-slate-500">{level.threshold.toLocaleString("pt-BR")} pontos mínimos</p>
                             </div>
                             <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300">
                               <input
                                 type="checkbox"
                                 checked={Boolean(level.enabled)}
                                 onChange={e => updateAffiliateLevelConfig(level.id, { enabled: e.target.checked })}
                               />
                               Ativo
                             </label>
                           </div>
                           <div className="grid gap-3">
                             <AffiliateField label="Pontos mínimos" help="Pontuação mínima para o afiliado atingir este nível.">
                               <input
                                 type="number"
                                 min="0"
                                 step="1"
                                 value={level.threshold}
                                 onChange={e => updateAffiliateLevelConfig(level.id, { threshold: Math.max(0, Number(e.target.value)) })}
                                 className="w-full p-3"
                               />
                             </AffiliateField>
                             <AffiliateField label="Nome exibido" help="Nome apresentado nos cards e rankings.">
                               <input
                                 value={level.label}
                                 onChange={e => updateAffiliateLevelConfig(level.id, { label: e.target.value })}
                                 className="w-full p-3"
                               />
                             </AffiliateField>
                           </div>
                         </div>
                       ))}
                     </div>
                   </AffiliateSection>

                   <AffiliateSection icon={Gift} title="Premiações" description="Use metas simples para explicar quando o afiliado ganha bônus.">
                     <div className="grid gap-4 md:grid-cols-2">
                       <AffiliateField label="Bônus por cadastro" help="O cadastro manual habilita o afiliado no programa; valores extras podem ser adicionados na carteira.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">Cadastro habilitado no painel operacional</div>
                       </AffiliateField>
                       <AffiliateField label="Bônus por venda" help="A comissão padrão funciona como bônus por venda aprovada.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">{commissionRate.toFixed(2)}% por venda paga</div>
                       </AffiliateField>
                       <AffiliateField label="Compra mínima mensal para ativação do afiliado" help="Defina o valor mínimo mensal em cotas para liberar comissões pendentes. Use 0 para desativar a exigência.">
                         <input type="number" min="0" step="0.01" value={monthlyActivationAmount} onChange={e => updateAffiliateProgram({ monthlyActivationAmount: Math.max(0, Number(e.target.value)) })} className="w-full p-3" placeholder="Ex.: 50.00" />
                       </AffiliateField>
                       <AffiliateField label="Meta anual" help="Acompanhe a meta anual pelos relatórios de ranking e receita do afiliado.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">Acompanhamento no ranking anual</div>
                       </AffiliateField>
                     </div>
                   </AffiliateSection>

                   <AffiliateSection icon={Trophy} title="Premiações para Afiliados" description="Crie bônus automáticos para afiliados que batem metas de vendas e indicações.">
                     <div className="space-y-4">
                       <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
                         <div>
                           <p className="text-sm font-bold text-white">Premiações automáticas</p>
                           <p className="mt-1 text-xs leading-5 text-slate-400">Este sistema complementa as comissões e vale apenas para novas vendas válidas.</p>
                         </div>
                         <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-200">
                           <input
                             type="checkbox"
                             checked={Boolean(performanceRewards.enabled)}
                             onChange={e => updateAffiliatePerformanceRewards({ enabled: e.target.checked })}
                           />
                           {performanceRewards.enabled ? "ON" : "OFF"}
                         </label>
                       </div>

                       <div className="space-y-3">
                         {performanceRewardRules.map((rule: any, index: number) => (
                           <div key={rule.id || index} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                             <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                               <div>
                                 <p className="text-sm font-bold text-white">Regra {index + 1}</p>
                                 <p className="mt-1 text-xs text-slate-500">A recompensa é gerada quando a venda indicada está paga, com comissão válida e afiliado liberado para a campanha.</p>
                               </div>
                               <div className="flex items-center gap-3">
                                 <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300">
                                   <input
                                     type="checkbox"
                                     checked={Boolean(rule.enabled)}
                                     onChange={e => updateAffiliateRewardRule(index, { enabled: e.target.checked })}
                                   />
                                   Ativa
                                 </label>
                                 <button type="button" onClick={() => removeAffiliateRewardRule(index)} className="rounded-xl border border-red-300/20 bg-red-400/10 p-2 text-red-200">
                                   <Trash2 className="h-4 w-4" />
                                 </button>
                               </div>
                             </div>
                             <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                               <AffiliateField label="Nome da regra" help="Nome comercial exibido para identificar a meta.">
                                 <input value={rule.name || ""} onChange={e => updateAffiliateRewardRule(index, { name: e.target.value })} className="w-full p-3" />
                               </AffiliateField>
                               <AffiliateField label="Meta por" help="Escolha o indicador que libera a recompensa.">
                                 <select value={rule.goalType || "sales_count"} onChange={e => updateAffiliateRewardRule(index, { goalType: e.target.value })} className="w-full p-3">
                                   {rewardGoalOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                 </select>
                               </AffiliateField>
                               <AffiliateField label="A cada" help="Quantidade, valor vendido ou valor comissionado necessário para liberar a recompensa.">
                                 <input type="number" min="1" step="0.01" value={Math.max(1, Number(rule.threshold || 1))} onChange={e => updateAffiliateRewardRule(index, { threshold: Math.max(1, Number(e.target.value)) })} className="w-full p-3" />
                               </AffiliateField>
                               <AffiliateField label="Recompensa" help="Tipo de bônus entregue quando a meta for alcançada.">
                                 <select value={rule.rewardType || "scratchcard"} onChange={e => updateAffiliateRewardRule(index, { rewardType: e.target.value })} className="w-full p-3">
                                   {rewardTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                 </select>
                               </AffiliateField>
                               <AffiliateField label="Quantidade" help="Quantidade de recompensas entregues a cada meta concluída.">
                                 <input type="number" min="1" step="1" value={Math.max(1, Number(rule.rewardQuantity || 1))} onChange={e => updateAffiliateRewardRule(index, { rewardQuantity: Math.max(1, Math.floor(Number(e.target.value))) })} className="w-full p-3" />
                               </AffiliateField>
                             </div>
                           </div>
                         ))}
                         {!performanceRewardRules.length && (
                           <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
                             Nenhuma regra criada. Adicione uma meta para liberar bônus automaticamente.
                           </div>
                         )}
                       </div>

                       <button type="button" onClick={addAffiliateRewardRule} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">
                         <Plus className="h-4 w-4" />
                         Criar regra
                       </button>
                     </div>
                   </AffiliateSection>

                   <AffiliateSection icon={Banknote} title="Saques" description="Controle quanto pode ser sacado e como a carteira aparece para o afiliado.">
                     <div className="grid gap-4 md:grid-cols-3">
                       <AffiliateField label="Valor mínimo" help="Menor saldo permitido para o afiliado solicitar transferência PIX.">
                         <input type="number" min="0" step="0.01" value={minWithdrawAmount} onChange={e => updateAffiliateProgram({ minWithdrawAmount: Math.max(0, Number(e.target.value)) })} className="w-full p-3" placeholder="Ex.: 50.00" />
                       </AffiliateField>
                       <AffiliateField label="Aprovação automática" help="Saques continuam com aprovação manual para reduzir risco financeiro.">
                         <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-sm font-bold text-amber-100">Manual e auditável</div>
                       </AffiliateField>
                       <AffiliateField label="Prazo para pagamento" help="O painel do afiliado mostra a próxima data útil prevista para pagamento.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">Próximo dia útil configurado pela operação</div>
                       </AffiliateField>
                     </div>
                   </AffiliateSection>
                 </div>

                 <div className="grid gap-4">
                   <AffiliateSection icon={Medal} title="Níveis" description="Modelo comercial pronto para segmentar afiliados por desempenho.">
                     <div className="grid gap-2">
                       {[
                         ["Bronze", "Entrada no programa"],
                         ["Prata", "Afiliado em crescimento"],
                         ["Ouro", "Alta conversão"],
                         ["Diamante", "Parceiro estratégico"]
                       ].map(([name, description]) => (
                         <div key={name} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                           <span className="text-sm font-bold text-white">{name}</span>
                           <span className="text-xs text-slate-500">{description}</span>
                         </div>
                       ))}
                     </div>
                   </AffiliateSection>

                   <AffiliateSection icon={Link2} title="Programa de Indicação" description="Configure as regras que o afiliado entende no painel dele.">
                     <div className="grid gap-4">
                       <AffiliateField label="Código de indicação" help="Cada afiliado recebe um código comercial para divulgar. IDs internos nunca aparecem nesta configuração.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">Gerado automaticamente</div>
                       </AffiliateField>
                       <AffiliateField label="Link de indicação" help="O link público é criado a partir do código do afiliado e pode ser copiado pelo painel.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">Disponível para o afiliado</div>
                       </AffiliateField>
                       <AffiliateField label="Cotas para entrar" help="Quantidade mínima de cotas compradas para liberar o afiliado no programa. Use zero para liberar todos.">
                         <input type="number" min="0" value={minTicketsToJoin} onChange={e => updateAffiliateProgram({ minTicketsToJoin: Math.max(0, Number(e.target.value)) })} className="w-full p-3" placeholder="Ex.: 5" />
                       </AffiliateField>
                       <AffiliateField label="Validade da indicação" help="A indicação fica vinculada ao código usado na compra ou no cadastro do cliente.">
                         <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">Vínculo pelo código de convite</div>
                       </AffiliateField>
                     </div>
                   </AffiliateSection>
                 </div>
               </div>

               <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
                 <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                   <div>
                     <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-200">
                       <ShieldCheck className="h-4 w-4" />
                       Resumo comercial
                     </p>
                     <p className="mt-1 text-xs leading-5 text-slate-400">Prévia das regras como o administrador entende, sem IDs, enums ou JSON.</p>
                   </div>
                   <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:min-w-[560px]">
                     <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
                       <span>Venda de R$ {previewTicketValue.toFixed(2)}</span>
                       <strong className="text-white">Comissão R$ {previewCommission.toFixed(2)}</strong>
                     </div>
                     <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
                       <span>Entrada no programa</span>
                       <strong className="text-white">{minTicketsToJoin || "liberada"}</strong>
                     </div>
                     <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
                       <span>Meta mensal</span>
                       <strong className="text-white">{monthlyActivationAmount > 0 ? `R$ ${monthlyActivationAmount.toFixed(2)}` : "sem exigência"}</strong>
                     </div>
                     <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
                       <span>Carteira em compras</span>
                       <strong className={Boolean(affiliateProgram.allowBalancePayments) ? "text-emerald-200" : "text-slate-400"}>
                         {Boolean(affiliateProgram.allowBalancePayments) ? "permitida" : "bloqueada"}
                       </strong>
                     </div>
                   </div>
                 </div>
               </div>

               <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                 <label className="flex items-start gap-3 text-sm text-slate-300">
                   <input type="checkbox" checked={Boolean(affiliateProgram.allowBalancePayments)} onChange={e => updateAffiliateProgram({ allowBalancePayments: e.target.checked })} className="mt-1" />
                   <span>
                     <strong className="flex items-center gap-2 text-white">
                       <Wallet className="h-4 w-4 text-emerald-200" />
                       Permitir compra com saldo disponível
                     </strong>
                     <span className="mt-1 block text-xs leading-5 text-slate-500">Quando ativo, o afiliado pode usar saldo liberado para participar de novas campanhas.</span>
                   </span>
                 </label>
                 <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
                   <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                   Somente administradores e superadministradores acessam esta configuração. O painel do afiliado mostra apenas regras comerciais e saldo, sem estruturas internas.
                 </p>
               </div>
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
                   ["ownerName", "Marca responsável"],
                   ["ownerContact", "Contato institucional"],
                   ["ownerSocial", "Rede social institucional"],
                 ].map(([field, label]) => (
                   <label key={field} className="space-y-2">
                     <span className="block text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</span>
                     <input value={settings.footer?.[field] || ""} onChange={e => setSettings({...settings, footer: {...settings.footer, [field]: e.target.value}})} className="w-full p-3" />
                   </label>
                 ))}
               </div>
               <MediaPicker
                 label="Logo institucional"
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
                  <h2 className="text-xl font-display font-medium text-white">Regras de Experiência Premiada</h2>
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
