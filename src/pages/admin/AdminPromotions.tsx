import { useEffect, useMemo, useState } from "react";
import { Copy, Gift, Plus, Save, Sparkles, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { promotionService, raffleService } from "../../services/api";
import type { PromotionRule, PromotionType, Raffle } from "../../types";

const promotionTypes: Array<{ value: PromotionType; label: string; hint: string }> = [
  { value: "double_tickets", label: "Cotas em Dobro", hint: "Comprou X, recebe cotas extras reais." },
  { value: "buy_and_win", label: "Compre e Ganhe", hint: "Entrega raspadinha, caixinha, roleta, cashback ou cota." },
  { value: "pre_pix_upsell", label: "Upsell antes do PIX", hint: "Oferta aparece na revisão antes de gerar PIX." },
  { value: "lucky_hour", label: "Hora Premiada", hint: "Bônus por janela de horário e dias da semana." },
  { value: "abandoned_pix_recovery", label: "Recuperação de PIX", hint: "Agenda WhatsApp para pedidos pendentes." },
  { value: "buyer_ranking", label: "Ranking/Top compradores", hint: "Exibe ranking mascarado e seguro." },
  { value: "package_bonus", label: "Bônus por pacote", hint: "Benefício atrelado a pacotes específicos." },
  { value: "affiliate_bonus", label: "Bônus por afiliado", hint: "Recompensa compras com indicação." },
  { value: "first_purchase_bonus", label: "Primeira compra", hint: "Bônus para novo cliente." },
  { value: "vip_bonus", label: "Cliente VIP", hint: "Bônus para compradores recorrentes." }
];

const defaultRule = (): Partial<PromotionRule> => ({
  name: "Cotas em Dobro",
  type: "double_tickets",
  enabled: true,
  priority: 100,
  raffle_id: "",
  conditions: { minQuantity: 10, publicText: "Cotas em Dobro" },
  rewards: { multiplier: 2, label: "Cotas em Dobro" },
  limits: { maxPerCustomer: 3, maxTotal: 0 },
  stackable: false
});

function prettyJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

function parseJsonField(value: string, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : fallback;
  } catch {
    return fallback;
  }
}

export function AdminPromotions() {
  const [rules, setRules] = useState<PromotionRule[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<Partial<PromotionRule>>(defaultRule());
  const [conditionsText, setConditionsText] = useState(prettyJson(defaultRule().conditions));
  const [rewardsText, setRewardsText] = useState(prettyJson(defaultRule().rewards));
  const [limitsText, setLimitsText] = useState(prettyJson(defaultRule().limits));
  const [loading, setLoading] = useState(false);

  const selectedType = useMemo(() => promotionTypes.find(item => item.value === selected.type) || promotionTypes[0], [selected.type]);

  async function load() {
    const [promotions, raffleList] = await Promise.all([
      promotionService.getAdminPromotions(),
      raffleService.getRaffles().catch(() => [])
    ]);
    setRules(promotions.rules || []);
    setStats(promotions.stats || {});
    setRaffles(raffleList || []);
  }

  useEffect(() => {
    load().catch(() => toast.error("Nao foi possivel carregar promoções"));
  }, []);

  function edit(rule: PromotionRule) {
    setSelected(rule);
    setConditionsText(prettyJson(rule.conditions));
    setRewardsText(prettyJson(rule.rewards));
    setLimitsText(prettyJson(rule.limits));
  }

  async function save() {
    setLoading(true);
    try {
      const payload: Partial<PromotionRule> = {
        ...selected,
        raffle_id: selected.raffle_id || selected.raffleId || null,
        conditions: parseJsonField(conditionsText, selected.conditions || {}),
        rewards: parseJsonField(rewardsText, selected.rewards || {}),
        limits: parseJsonField(limitsText, selected.limits || {})
      };
      await promotionService.savePromotion(payload);
      toast.success("Promoção salva");
      setSelected(defaultRule());
      setConditionsText(prettyJson(defaultRule().conditions));
      setRewardsText(prettyJson(defaultRule().rewards));
      setLimitsText(prettyJson(defaultRule().limits));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setLoading(false);
    }
  }

  async function duplicate(id: string) {
    await promotionService.duplicatePromotion(id);
    toast.success("Promoção duplicada");
    await load();
  }

  async function remove(id: string) {
    await promotionService.deletePromotion(id);
    toast.success("Promoção desativada");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--admin-muted)]">Motor comercial</p>
          <h1 className="text-3xl font-black text-[var(--admin-text)]">Promoções</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">
            Configure cotas em dobro, compre e ganhe, upsell pré-PIX, hora premiada, recuperação de PIX abandonado e rankings por cliente/campanha.
          </p>
        </div>
        <button className="admin-button-primary" onClick={() => edit(defaultRule() as PromotionRule)}>
          <Plus className="h-4 w-4" /> Nova promoção
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Ativas", stats.active || 0],
          ["Cotas extras emitidas", stats.bonusTickets || 0],
          ["PIX recuperados", stats.recoveredPix || 0],
          ["Receita atribuida", `R$ ${Number(stats.revenueAttributed || 0).toFixed(2)}`]
        ].map(([label, value]) => (
          <div key={label} className="admin-card rounded-2xl p-4">
            <p className="text-xs font-bold uppercase text-[var(--admin-muted)]">{label}</p>
            <strong className="mt-2 block text-2xl text-[var(--admin-text)]">{value}</strong>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="admin-card overflow-hidden rounded-2xl">
          <div className="border-b border-[var(--admin-border)] p-4">
            <h2 className="flex items-center gap-2 text-lg font-black text-[var(--admin-text)]"><Sparkles className="h-5 w-5" /> Regras configuradas</h2>
          </div>
          <div className="divide-y divide-[var(--admin-border)]">
            {rules.length === 0 && <p className="p-5 text-sm text-[var(--admin-muted)]">Nenhuma promoção criada ainda.</p>}
            {rules.map(rule => (
              <div key={rule.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <button className="text-left" onClick={() => edit(rule)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${rule.enabled ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-[var(--admin-muted)]"}`}>
                      {rule.enabled ? "Ativa" : "Inativa"}
                    </span>
                    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-black text-cyan-200">{promotionTypes.find(item => item.value === rule.type)?.label || rule.type}</span>
                  </div>
                  <h3 className="mt-2 text-base font-black text-[var(--admin-text)]">{rule.name}</h3>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">Prioridade {rule.priority} • {rule.raffle_id ? "Campanha específica" : "Global do cliente"}</p>
                </button>
                <div className="flex gap-2">
                  <button className="admin-icon-button" onClick={() => duplicate(rule.id)} aria-label="Duplicar"><Copy className="h-4 w-4" /></button>
                  <button className="admin-icon-button text-red-300" onClick={() => remove(rule.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card rounded-2xl p-4">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[var(--admin-text)]"><Gift className="h-5 w-5" /> Editor</h2>
          <div className="space-y-4">
            <label className="block text-sm font-bold text-[var(--admin-text)]">
              Nome
              <input className="admin-input mt-1 w-full" value={selected.name || ""} onChange={event => setSelected(prev => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="block text-sm font-bold text-[var(--admin-text)]">
              Tipo
              <select className="admin-input mt-1 w-full" value={selected.type || "double_tickets"} onChange={event => setSelected(prev => ({ ...prev, type: event.target.value as PromotionType }))}>
                {promotionTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <span className="mt-1 block text-xs text-[var(--admin-muted)]">{selectedType.hint}</span>
            </label>
            <label className="block text-sm font-bold text-[var(--admin-text)]">
              Campanha
              <select className="admin-input mt-1 w-full" value={selected.raffle_id || selected.raffleId || ""} onChange={event => setSelected(prev => ({ ...prev, raffle_id: event.target.value }))}>
                <option value="">Todas as campanhas do cliente</option>
                {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold text-[var(--admin-text)]">Prioridade<input className="admin-input mt-1 w-full" type="number" value={selected.priority || 100} onChange={event => setSelected(prev => ({ ...prev, priority: Number(event.target.value) }))} /></label>
              <label className="flex items-center gap-2 pt-7 text-sm font-bold text-[var(--admin-text)]"><input type="checkbox" checked={selected.enabled !== false} onChange={event => setSelected(prev => ({ ...prev, enabled: event.target.checked }))} /> Ativa</label>
            </div>
            <JsonEditor label="Condições" value={conditionsText} onChange={setConditionsText} />
            <JsonEditor label="Recompensas" value={rewardsText} onChange={setRewardsText} />
            <JsonEditor label="Limites" value={limitsText} onChange={setLimitsText} />
            <button className="admin-button-primary w-full" onClick={save} disabled={loading}>
              {loading ? <Zap className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />} Salvar promoção
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JsonEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-bold text-[var(--admin-text)]">
      {label}
      <textarea className="admin-input mt-1 min-h-28 w-full font-mono text-xs" value={value} onChange={event => onChange(event.target.value)} spellCheck={false} />
    </label>
  );
}
