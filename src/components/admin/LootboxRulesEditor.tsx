import { Plus, Trash2 } from "lucide-react";
import type { LootboxConfig, RewardWheelSegment } from "../../types";
import { cn } from "../../lib/utils";
import { MediaPicker } from "./MediaPicker";

const defaultWheelSegments: RewardWheelSegment[] = [
  { label: "PREMIO", color: "#f59e0b" },
  { label: "TENTE", color: "#334155" },
  { label: "PIX", color: "#06b6d4" },
  { label: "TENTE", color: "#475569" },
  { label: "BONUS", color: "#10b981" },
  { label: "TENTE", color: "#334155" },
  { label: "PREMIO", color: "#e11d48" },
  { label: "TENTE", color: "#475569" }
];
const MAX_WHEEL_SEGMENTS = 10;
const MIN_WHEEL_SEGMENTS = 2;
const extraWheelColors = ["#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const defaultLootboxConfig: LootboxConfig = {
  experienceType: "wheel",
  rewardModes: { box: false, wheel: true },
  ticketsPerBox: 3,
  globalTicketsCounter: 0,
  boxRules: [{ tickets: 3, boxes: 1 }],
  milestones: [
    { tier: "mini", everyXTickets: 500, name: "R$ 5", type: "pix", value: 5, currentCounter: 0 }
  ],
  wheelSegments: defaultWheelSegments,
  effects: {
    autoOpen: false,
    sfx: true,
    vfx: true,
    confetti: true
  }
};

export function normalizeLootboxConfig(config?: Partial<LootboxConfig> | null): LootboxConfig {
  const legacyExperience = config?.experienceType === "box" ? "box" : "wheel";
  const rewardModes = config?.rewardModes
    ? { box: Boolean(config.rewardModes.box), wheel: Boolean(config.rewardModes.wheel) }
    : { box: legacyExperience === "box", wheel: legacyExperience === "wheel" };
  return {
    ...defaultLootboxConfig,
    ...(config || {}),
    experienceType: rewardModes.wheel ? "wheel" : "box",
    rewardModes,
    boxRules: config?.boxRules?.length ? config.boxRules : defaultLootboxConfig.boxRules,
    milestones: config?.milestones?.length ? config.milestones : defaultLootboxConfig.milestones,
    wheelSegments: config?.wheelSegments?.length ? config.wheelSegments.slice(0, MAX_WHEEL_SEGMENTS) : defaultWheelSegments,
    effects: {
      ...defaultLootboxConfig.effects,
      ...(config?.effects || {})
    }
  };
}

export function LootboxRulesEditor({
  value,
  onChange,
  title = "Regras da roleta premiada",
  showExperienceSelector = true
}: {
  value?: Partial<LootboxConfig> | null;
  onChange: (config: LootboxConfig) => void;
  title?: string;
  showExperienceSelector?: boolean;
}) {
  const config = normalizeLootboxConfig(value);

  const update = (patch: Partial<LootboxConfig>) => onChange(normalizeLootboxConfig({ ...config, ...patch }));

  const updateRule = (index: number, field: "tickets" | "boxes", nextValue: number) => {
    const boxRules = [...config.boxRules];
    boxRules[index] = { ...boxRules[index], [field]: Math.max(1, nextValue) };
    update({ boxRules });
  };

  const updateMilestone = (index: number, field: string, nextValue: string | number) => {
    const milestones = [...config.milestones];
    milestones[index] = { ...milestones[index], [field]: nextValue };
    update({ milestones });
  };

  const updateSegment = (index: number, patch: Partial<RewardWheelSegment>) => {
    const wheelSegments = [...(config.wheelSegments || defaultWheelSegments)];
    wheelSegments[index] = { ...wheelSegments[index], ...patch };
    update({ wheelSegments });
  };

  const updateSegmentReward = (index: number, field: string, nextValue: string | number) => {
    const segment = (config.wheelSegments || defaultWheelSegments)[index];
    updateSegment(index, {
      reward: {
        tier: segment.reward?.tier || "mini",
        everyXTickets: segment.reward?.everyXTickets || 500,
        name: segment.reward?.name || segment.label || "Premio da paleta",
        type: segment.reward?.type || "pix",
        value: segment.reward?.value || 0,
        currentCounter: segment.reward?.currentCounter || 0,
        [field]: nextValue
      }
    });
  };

  const addSegment = () => {
    const wheelSegments = config.wheelSegments || defaultWheelSegments;
    if (wheelSegments.length >= MAX_WHEEL_SEGMENTS) return;
    const index = wheelSegments.length;
    update({
      wheelSegments: [
        ...wheelSegments,
        { label: `PALETA ${index + 1}`, color: extraWheelColors[index % extraWheelColors.length] }
      ]
    });
  };

  const removeSegment = (index: number) => {
    const wheelSegments = config.wheelSegments || defaultWheelSegments;
    if (wheelSegments.length <= MIN_WHEEL_SEGMENTS) return;
    update({ wheelSegments: wheelSegments.filter((_, itemIndex) => itemIndex !== index) });
  };

  return (
    <section className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.03] p-5">
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">A compra confirmada libera jogos pela quantidade comprada pelo cliente. O prêmio nasce pela quantidade total vendida nesta ação e fica reservado ao próximo jogo validamente liberado.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {showExperienceSelector && (
          <label className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-500">Experiência exibida ao cliente</span>
            <select value={config.experienceType || "wheel"} onChange={event => update({ experienceType: event.target.value as "box" | "wheel" })} className="w-full p-3">
              <option value="wheel">Roleta Premiada</option>
              <option value="box">Caixinha Premiada</option>
            </select>
          </label>
        )}
        <Field label="Contador de cotas vendidas" type="number" value={String(config.globalTicketsCounter || 0)} onChange={value => update({ globalTicketsCounter: Math.max(0, Number(value)) })} />
        <Field label="Fallback: cotas compradas por jogo" type="number" value={String(config.ticketsPerBox || 3)} onChange={value => update({ ticketsPerBox: Math.max(1, Number(value)) })} />
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Direito de jogar por compra confirmada</p>
          <button type="button" onClick={() => update({ boxRules: [...config.boxRules, { tickets: 3, boxes: 1 }] })} className="rounded-lg border border-amber-300/20 px-3 py-1 text-xs text-amber-200">
            <Plus className="mr-1 inline h-3 w-3" /> Regra
          </button>
        </div>
        <div className="space-y-2">
          {config.boxRules.map((rule, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-2xl border border-white/5 bg-black/20 p-3">
              <Field label="Cotas compradas pelo cliente" type="number" value={String(rule.tickets)} onChange={value => updateRule(index, "tickets", Number(value))} />
              <Field label="Jogos liberados" type="number" value={String(rule.boxes)} onChange={value => updateRule(index, "boxes", Number(value))} />
              <button type="button" onClick={() => update({ boxRules: config.boxRules.filter((_, itemIndex) => itemIndex !== index) })} className="self-end rounded-xl border border-red-400/20 p-3 text-red-200">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {config.rewardModes?.wheel ? "Prêmios da caixinha e fallback da roleta sem paleta premiada" : "Prêmios por vendas totais desta ação"}
          </p>
          <button type="button" onClick={() => update({ milestones: [...config.milestones, { tier: "mini", everyXTickets: 500, name: "R$ 10", type: "pix", value: 10, currentCounter: 0 }] })} className="rounded-lg border border-amber-300/20 px-3 py-1 text-xs text-amber-200">
            <Plus className="mr-1 inline h-3 w-3" /> Prêmio
          </button>
        </div>
        <div className="space-y-3">
          {config.milestones.map((milestone, index) => (
            <div key={index} className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="grid gap-2 md:grid-cols-[0.8fr_1fr_1fr_auto]">
                <label className="space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-500">Raridade</span>
                  <select value={milestone.tier || "mini"} onChange={event => updateMilestone(index, "tier", event.target.value)} className="w-full p-3">
                    <option value="mini">Mini</option>
                    <option value="medio">Médio</option>
                    <option value="alto">Alto</option>
                  </select>
                </label>
                <Field label="Cotas vendidas no total" type="number" value={String(milestone.everyXTickets)} onChange={value => updateMilestone(index, "everyXTickets", Math.max(1, Number(value)))} />
                <Field label="Contador atual" type="number" value={String(milestone.currentCounter || 0)} onChange={value => updateMilestone(index, "currentCounter", Math.max(0, Number(value)))} />
                <button type="button" onClick={() => update({ milestones: config.milestones.filter((_, itemIndex) => itemIndex !== index) })} className="self-end rounded-xl border border-red-400/20 p-3 text-red-200">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <Field label="Nome do prêmio" value={milestone.name || ""} onChange={value => updateMilestone(index, "name", value)} />
                <Field label="Tipo" value={milestone.type || "pix"} onChange={value => updateMilestone(index, "type", value)} />
                <Field label="Valor" type="number" value={String(milestone.value || 0)} onChange={value => updateMilestone(index, "value", Number(value))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {config.rewardModes?.wheel && (
        <div className="mt-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Paletas da roleta e prêmios individuais</p>
            <button
              type="button"
              onClick={addSegment}
              disabled={(config.wheelSegments || defaultWheelSegments).length >= MAX_WHEEL_SEGMENTS}
              className="rounded-lg border border-amber-300/20 px-3 py-1 text-xs text-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="mr-1 inline h-3 w-3" /> Adicionar paleta
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-400">Ative uma paleta premiada e informe a quantidade total vendida necessária para a roleta parar nela com o prêmio configurado.</p>
          <p className="mb-3 text-xs text-slate-400">{(config.wheelSegments || defaultWheelSegments).length} de {MAX_WHEEL_SEGMENTS} paletas configuradas.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {(config.wheelSegments || defaultWheelSegments).map((segment, index) => (
              <div key={index} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--admin-text)]">Paleta {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeSegment(index)}
                    disabled={(config.wheelSegments || defaultWheelSegments).length <= MIN_WHEEL_SEGMENTS}
                    className="rounded-lg border border-red-400/20 p-2 text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Remover paleta ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Field label={`Texto ${index + 1}`} value={segment.label} onChange={value => updateSegment(index, { label: value })} />
                  <label className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Cor</span>
                    <input type="color" value={segment.color} onChange={event => updateSegment(index, { color: event.target.value })} className="h-12 w-full rounded-xl border border-white/10 bg-transparent p-1" />
                  </label>
                </div>
                <div className="mt-3">
                  <MediaPicker
                    label={`Imagem da fatia ${index + 1}`}
                    value={segment.imageUrl || ""}
                    mediaType="image"
                    accept=".jpg,.jpeg,.png,.gif,.webp"
                    allowExternalVideo={false}
                    onChange={imageUrl => updateSegment(index, { imageUrl })}
                  />
                </div>
                <label className="mt-3 flex items-center gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3">
                  <input
                    type="checkbox"
                    checked={Boolean(segment.rewardEnabled)}
                    onChange={event => updateSegment(index, {
                      rewardEnabled: event.target.checked,
                      reward: event.target.checked ? (segment.reward || {
                        tier: "mini",
                        everyXTickets: 500,
                        name: segment.label || `Premio da paleta ${index + 1}`,
                        type: "pix",
                        value: 10,
                        currentCounter: 0
                      }) : segment.reward
                    })}
                  />
                  <span className="text-sm text-[var(--admin-text)]">Esta paleta entrega prêmio</span>
                </label>
                {segment.rewardEnabled && (
                  <div className="mt-3 space-y-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.03] p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Field label="Cotas vendidas no total" type="number" value={String(segment.reward?.everyXTickets || 500)} onChange={value => updateSegmentReward(index, "everyXTickets", Math.max(1, Number(value)))} />
                      <Field label="Contador atual" type="number" value={String(segment.reward?.currentCounter || 0)} onChange={value => updateSegmentReward(index, "currentCounter", Math.max(0, Number(value)))} />
                      <Field label="Nome do prêmio" value={segment.reward?.name || segment.label} onChange={value => updateSegmentReward(index, "name", value)} />
                      <Field label="Valor" type="number" value={String(segment.reward?.value || 0)} onChange={value => updateSegmentReward(index, "value", Number(value))} />
                      <Field label="Tipo" value={segment.reward?.type || "pix"} onChange={value => updateSegmentReward(index, "type", value)} />
                      <label className="space-y-1">
                        <span className="text-[10px] font-mono uppercase text-slate-500">Raridade</span>
                        <select value={segment.reward?.tier || "mini"} onChange={event => updateSegmentReward(index, "tier", event.target.value)} className="w-full p-3">
                          <option value="mini">Mini</option>
                          <option value="medio">Médio</option>
                          <option value="alto">Alto</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function RewardExperienceSelector({
  enabled,
  value,
  onChange
}: {
  enabled: boolean;
  value?: Partial<LootboxConfig> | null;
  onChange: (enabled: boolean, config: LootboxConfig) => void;
}) {
  const config = normalizeLootboxConfig(value);
  const rewardModes = enabled ? config.rewardModes || { box: false, wheel: true } : { box: false, wheel: false };

  const toggleMode = (mode: "box" | "wheel") => {
    const nextModes = { ...rewardModes, [mode]: !rewardModes[mode] };
    onChange(nextModes.box || nextModes.wheel, normalizeLootboxConfig({
      ...config,
      rewardModes: nextModes,
      experienceType: nextModes.wheel ? "wheel" : "box"
    }));
  };

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--admin-muted)]">Jogos premiados desta ação</p>
      <p className="mb-3 text-xs text-[var(--admin-muted)]">Ative nenhum, um ou os dois jogos. Quando ambos estiverem ligados, cada direito liberado gera uma caixinha e um giro.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {([
          { id: "box" as const, label: "Caixinha Premiada", detail: "Cliente abre uma caixa" },
          { id: "wheel" as const, label: "Roleta Premiada", detail: "Cliente gira a roleta" }
        ]).map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => toggleMode(option.id)}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              rewardModes[option.id]
                ? "border-amber-400/60 bg-amber-400/10 text-[var(--admin-text)]"
                : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text)] hover:border-amber-400/30"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn("h-3 w-3 rounded-sm border", rewardModes[option.id] ? "border-amber-300 bg-amber-300" : "border-[var(--admin-border)]")} />
              {option.label}
            </span>
            <span className="mt-1 block text-xs text-[var(--admin-muted)]">{option.detail}</span>
          </button>
        ))}
      </div>
      {!rewardModes.box && !rewardModes.wheel && (
        <p className="mt-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-sm text-[var(--admin-muted)]">Caixinha e roleta desativadas para esta ação.</p>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-mono uppercase text-slate-500">{label}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} className="w-full p-3" />
    </label>
  );
}
