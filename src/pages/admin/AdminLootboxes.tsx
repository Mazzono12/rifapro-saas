import { useEffect, useState } from "react";
import { Gift, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

const defaultLootboxEconomy = {
  ticketsPerBox: 3,
  globalTicketsCounter: 0,
  boxRules: [
    { tickets: 3, boxes: 1 },
    { tickets: 5, boxes: 2 }
  ],
  milestones: [
    { tier: "mini", everyXTickets: 500, name: "R$ 5", type: "pix", value: 5, currentCounter: 0 },
    { tier: "medio", everyXTickets: 1000, name: "R$ 50", type: "pix", value: 50, currentCounter: 0 },
    { tier: "alto", everyXTickets: 2500, name: "R$ 100", type: "pix", value: 100, currentCounter: 0 }
  ],
  effects: {
    autoOpen: false,
    sfx: true,
    vfx: true,
    confetti: true
  }
};

export function AdminLootboxes() {
  const [settings, setSettings] = useState<any>(null);
  const economy = settings?.lootboxEconomy || defaultLootboxEconomy;

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => setSettings({
        ...data,
        lootboxEconomy: {
          ...defaultLootboxEconomy,
          ...(data.lootboxEconomy || {}),
          effects: {
            ...defaultLootboxEconomy.effects,
            ...(data.lootboxEconomy?.effects || {})
          }
        }
      }))
      .catch(() => toast.error("Falha ao carregar configurações da roleta"));
  }, []);

  const updateEconomy = (patch: any) => {
    setSettings({
      ...settings,
      lootboxEconomy: {
        ...economy,
        ...patch
      }
    });
  };

  const updateBoxRule = (index: number, field: string, value: number) => {
    const boxRules = [...(economy.boxRules || [])];
    boxRules[index] = { ...boxRules[index], [field]: value };
    updateEconomy({ boxRules });
  };

  const updateMilestone = (index: number, field: string, value: any) => {
    const milestones = [...(economy.milestones || [])];
    milestones[index] = { ...milestones[index], [field]: value };
    updateEconomy({ milestones });
  };

  const save = async () => {
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      toast.success("Configurações da roleta salvas");
    } catch {
      toast.error("Erro ao salvar roleta premiada");
    }
  };

  if (!settings) return <div className="glass-card p-10 text-center text-slate-500">Carregando roleta premiada...</div>;

  return (
    <div className="space-y-6 fade-in pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
            <Gift className="h-8 w-8 text-slate-600" /> Roleta Premiada Global
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            A mesma regra de liberação da caixinha vale para os giros. Configurações individuais ficam em cada sorteio e modalidade.
          </p>
        </div>
        <button onClick={save} className="admin-action-button inline-flex items-center gap-2 rounded-xl px-5 py-3">
          <Save className="h-4 w-4" /> Salvar
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="glass-card rounded-3xl border border-white/5 p-6">
          <h2 className="mb-5 flex items-center gap-2 font-display text-xl font-bold text-white">
            <Sparkles className="h-5 w-5 text-slate-600" /> Regras de geração
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-500">Contador global de cotas</span>
              <input type="number" min="0" value={economy.globalTicketsCounter || 0} onChange={e => updateEconomy({ globalTicketsCounter: Number(e.target.value) })} className="w-full p-3" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-500">Fallback: cotas por giro</span>
              <input type="number" min="1" value={economy.ticketsPerBox || 3} onChange={e => updateEconomy({ ticketsPerBox: Number(e.target.value) })} className="w-full p-3" />
            </label>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400">Giros por compra confirmada</h3>
              <button type="button" onClick={() => updateEconomy({ boxRules: [...(economy.boxRules || []), { tickets: 3, boxes: 1 }] })} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600">
                <Plus className="mr-1 inline h-3 w-3" /> Regra
              </button>
            </div>
            <div className="space-y-3">
              {(economy.boxRules || []).map((rule: any, index: number) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                  <Field label="A cada cotas" type="number" value={String(rule.tickets)} onChange={value => updateBoxRule(index, "tickets", Math.max(1, Number(value)))} />
                  <Field label="Ganha giros" type="number" value={String(rule.boxes)} onChange={value => updateBoxRule(index, "boxes", Math.max(1, Number(value)))} />
                  <button type="button" onClick={() => updateEconomy({ boxRules: economy.boxRules.filter((_: any, itemIndex: number) => itemIndex !== index) })} className="self-end rounded-xl border border-red-400/20 p-3 text-red-200">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="glass-card rounded-3xl border border-white/5 p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-white">Milestones de premiação</h2>
            <button type="button" onClick={() => updateEconomy({ milestones: [...(economy.milestones || []), { tier: "mini", everyXTickets: 500, name: "R$ 10", type: "pix", value: 10, currentCounter: 0 }] })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
              <Plus className="mr-1 inline h-3 w-3" /> Prêmio
            </button>
          </div>

          <div className="space-y-3">
            {(economy.milestones || []).map((milestone: any, index: number) => (
              <div key={index} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_1fr_auto]">
                  <label className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Raridade</span>
                    <select value={milestone.tier || "mini"} onChange={e => updateMilestone(index, "tier", e.target.value)} className="w-full p-3">
                      <option value="mini">Mini</option>
                      <option value="medio">Médio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </label>
                  <Field label="A cada cotas vendidas" type="number" value={String(milestone.everyXTickets)} onChange={value => updateMilestone(index, "everyXTickets", Math.max(1, Number(value)))} />
                  <Field label="Contador atual" type="number" value={String(milestone.currentCounter || 0)} onChange={value => updateMilestone(index, "currentCounter", Math.max(0, Number(value)))} />
                  <button type="button" onClick={() => updateEconomy({ milestones: economy.milestones.filter((_: any, itemIndex: number) => itemIndex !== index) })} className="self-end rounded-xl border border-red-400/20 p-3 text-red-200">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Nome do prêmio" value={milestone.name || ""} onChange={value => updateMilestone(index, "name", value)} />
                  <Field label="Tipo" value={milestone.type || "pix"} onChange={value => updateMilestone(index, "type", value)} />
                  <Field label="Valor" type="number" value={String(milestone.value || 0)} onChange={value => updateMilestone(index, "value", Number(value))} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass-card rounded-3xl border border-white/5 p-6">
        <h2 className="mb-4 font-display text-xl font-bold text-white">Experiência visual e som</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["autoOpen", "Abertura automática"],
            ["sfx", "Sons"],
            ["vfx", "Efeitos especiais"],
            ["confetti", "Confete"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <input type="checkbox" checked={Boolean(economy.effects?.[key])} onChange={e => updateEconomy({ effects: { ...(economy.effects || {}), [key]: e.target.checked } })} />
              <span className="text-sm text-white">{label}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-mono uppercase text-slate-500">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-3" />
    </label>
  );
}

