import { useEffect, useMemo, useState } from "react";
import { Save, Sparkles } from "lucide-react";
import type { GamificationConfig, GamificationEvent, GamificationWinner, Raffle } from "../../types";

const moduleLabels: Record<string, string> = {
  scratchcard: "Raspadinha",
  winningTicket: "Super Cota",
  luckyHour: "Hora premiada",
  mysteryBox: "Caixinha premiada",
  doubleTickets: "Cotas em dobro",
  doubleChance: "Chance em dobro",
  extremeTickets: "Maior e menor cota",
  buyerRanking: "Ranking de compradores",
  orderBump: "Order bump / Upsell"
};

const statusLabels: Record<string, string> = {
  success: "Concluído",
  completed: "Concluído",
  winner: "Ganhador encontrado",
  pending: "Em processamento",
  failed: "Precisa de atenção",
  error: "Precisa de atenção"
};

export function AdminGamification() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState("");
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [events, setEvents] = useState<GamificationEvent[]>([]);
  const [winners, setWinners] = useState<GamificationWinner[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedRaffle = useMemo(() => raffles.find(raffle => raffle.id === selectedRaffleId), [raffles, selectedRaffleId]);

  useEffect(() => {
    fetch("/api/admin/gamification")
      .then(res => res.json())
      .then(data => {
        setRaffles(data.raffles || []);
        setEvents(data.events || []);
        setWinners(data.winners || []);
        const first = data.raffles?.[0];
        if (first) setSelectedRaffleId(first.id);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!selectedRaffleId) return;
    fetch(`/api/admin/gamification/${selectedRaffleId}`)
      .then(res => res.json())
      .then(data => {
        setConfig(data.config);
        setEvents(data.events || []);
        setWinners(data.winners || []);
      })
      .catch(() => null);
  }, [selectedRaffleId]);

  function update(path: string, value: any) {
    if (!config) return;
    const copy: any = structuredClone(config);
    const parts = path.split(".");
    let target = copy;
    parts.slice(0, -1).forEach(part => { target = target[part]; });
    target[parts.at(-1)!] = value;
    setConfig(copy);
  }

  function updateDoubleTicketPackages(value: string) {
    const quantities = value
      .split(/[,\s]+/)
      .map(item => Number(item.trim()))
      .filter(value => Number.isFinite(value) && value > 0)
      .map(value => Math.floor(value));
    update("doubleTickets.packageQuantities", Array.from(new Set(quantities)));
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/gamification/${config.raffleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      setConfig(await response.json());
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return <div className="admin-card p-6 text-[var(--admin-muted)]">Carregando gamificação...</div>;
  }

  return (
    <div className="space-y-5">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--admin-text)]"><Sparkles className="h-5 w-5" /> Gamificação e conversão</h1>
            <p className="text-sm text-[var(--admin-muted)]">Configurações por ação, com gestão por cliente e geração segura de prêmios.</p>
          </div>
          <div className="flex gap-2">
            <select className="admin-input min-w-64" value={selectedRaffleId} onChange={event => setSelectedRaffleId(event.target.value)}>
              {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
            </select>
            <button type="button" onClick={save} disabled={saving} className="admin-button-primary"><Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(config.modules).map(([key, enabled]) => (
          <label key={key} className="admin-card flex cursor-pointer items-center justify-between p-4">
            <span className="text-sm font-semibold text-[var(--admin-text)]">{friendlyModule(key)}</span>
            <input type="checkbox" checked={Boolean(enabled)} onChange={event => update(`modules.${key}`, event.target.checked)} />
          </label>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card space-y-4 p-5">
          <h2 className="font-semibold text-[var(--admin-text)]">Regras principais</h2>
          <Field label="Probabilidade da raspadinha (%)" value={config.scratchcard.winProbability} onChange={value => update("scratchcard.winProbability", Number(value))} />
          <Field label="Oferta adicional - cotas" value={config.orderBump.tickets} onChange={value => update("orderBump.tickets", Number(value))} />
          <Field label="Oferta adicional - desconto (%)" value={config.orderBump.discountPercent} onChange={value => update("orderBump.discountPercent", Number(value))} />
          <Field label="Oferta adicional - texto" value={config.orderBump.label} onChange={value => update("orderBump.label", value)} />
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--admin-muted)]">Promoção</p>
                <h3 className="font-semibold text-[var(--admin-text)]">Cotas em Dobro</h3>
                <p className="mt-1 text-xs text-[var(--admin-muted)]">Regra: comprou X, ganha X. Exemplo: comprou 100, recebe 200 cotas no bilhete.</p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-xs font-black text-[var(--admin-text)]">
                <input type="checkbox" checked={Boolean(config.modules.doubleTickets)} onChange={event => update("modules.doubleTickets", event.target.checked)} />
                Status: {config.modules.doubleTickets ? "Ativa" : "Inativa"}
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Quantidade mínima para ativar" value={config.doubleTickets.minTickets} onChange={value => update("doubleTickets.minTickets", Number(value))} />
              <Field label="Limite por cliente" value={config.doubleTickets.maxUsesPerCustomer} onChange={value => update("doubleTickets.maxUsesPerCustomer", Number(value))} />
              <Field label="Data início" value={config.doubleTickets.startsAt} onChange={value => update("doubleTickets.startsAt", value)} />
              <Field label="Data fim" value={config.doubleTickets.endsAt} onChange={value => update("doubleTickets.endsAt", value)} />
            </div>
            <Field label="Aviso na página pública" value={config.doubleTickets.label} onChange={value => update("doubleTickets.label", value)} />
            <Field label="Aplicar em pacotes específicos" value={(config.doubleTickets.packageQuantities || []).join(", ")} onChange={updateDoubleTicketPackages} placeholder="Ex.: 700, 1800, 3000. Vazio = todos os pacotes" />
          </div>
          <Field label="Chance em dobro - peso" value={config.doubleChance.weight} onChange={value => update("doubleChance.weight", Number(value))} />
          <Field label="Chance em dobro - início" value={config.doubleChance.startsAt} onChange={value => update("doubleChance.startsAt", value)} />
          <Field label="Chance em dobro - fim" value={config.doubleChance.endsAt} onChange={value => update("doubleChance.endsAt", value)} />
        </div>

        <div className="admin-card space-y-4 p-5">
          <h2 className="font-semibold text-[var(--admin-text)]">Prêmios e campanhas automáticas</h2>
          <p className="text-sm text-[var(--admin-muted)]">Configure os benefícios por nome, quantidade e chance de entrega. Os detalhes técnicos ficam protegidos pelo sistema.</p>
          <RewardPlanner label="Prêmios da raspadinha" value={config.scratchcard.prizes} onChange={value => update("scratchcard.prizes", value)} />
          <RewardPlanner label="Super Cotas" value={config.winningTicket.prizes} onChange={value => update("winningTicket.prizes", value)} />
          <RewardPlanner label="Janelas da hora premiada" value={config.luckyHour.windows} onChange={value => update("luckyHour.windows", value)} mode="window" />
          <RewardPlanner label="Caixinhas premiadas" value={config.mysteryBox.boxes} onChange={value => update("mysteryBox.boxes", value)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-5">
          <h2 className="mb-3 font-semibold text-[var(--admin-text)]">Ganhadores automáticos</h2>
          <Rows rows={winners.map(winner => [friendlyModule(winner.module), winner.prize || "Benefício entregue", winner.number ? `Cota ${winner.number}` : "Cota não informada", winner.purchaseId ? "Compra vinculada" : "Compra não vinculada"])} empty="Nenhum ganhador automático ainda." />
        </div>
        <div className="admin-card p-5">
          <h2 className="mb-3 font-semibold text-[var(--admin-text)]">Eventos</h2>
          <Rows rows={events.slice(0, 12).map(event => [friendlyModule(event.module), friendlyStatus(event.status), event.purchaseId ? "Compra vinculada" : "Compra não vinculada", new Date(event.createdAt).toLocaleString("pt-BR")])} empty="Nenhum evento ainda." />
        </div>
      </section>

      {selectedRaffle && <p className="text-xs text-[var(--admin-muted)]">Editando: {selectedRaffle.title}</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "" }: { label: string; value: any; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm text-[var(--admin-muted)]">
      {label}
      <input className="admin-input mt-1 w-full" value={value ?? ""} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function RewardPlanner({ label, value, onChange, mode = "reward" }: { label: string; value: any; onChange: (value: any) => void; mode?: "reward" | "window" }) {
  const items = Array.isArray(value) ? value : [];
  const updateItem = (index: number, key: string, nextValue: string) => {
    const next = [...items];
    const current = next[index] && typeof next[index] === "object" ? next[index] : {};
    next[index] = { ...current, [key]: key === "quantity" || key === "chance" ? Number(nextValue || 0) : nextValue };
    onChange(next);
  };
  const addItem = () => onChange([...items, mode === "window" ? { label: "Nova janela", startsAt: "", endsAt: "" } : { label: "Novo prêmio", quantity: 1, chance: 0, winnerName: "" }]);

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--admin-text)]">{label}</h3>
          <p className="text-xs text-[var(--admin-muted)]">{items.length ? `${items.length} item(ns) configurado(s)` : "Nenhum item cadastrado"}</p>
        </div>
        <button type="button" onClick={addItem} className="admin-button-secondary text-xs">Adicionar</button>
      </div>
      <div className="mt-3 space-y-3">
        {items.slice(0, 6).map((item: any, index: number) => (
          <div key={index} className="rounded-xl border border-[var(--admin-border)] p-3">
            <Field label={mode === "window" ? "Nome da janela" : "Nome do benefício"} value={item.label || item.name || item.prize || ""} onChange={next => updateItem(index, "label", next)} />
            {mode === "window" ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="Início" value={item.startsAt || item.start || ""} onChange={next => updateItem(index, "startsAt", next)} />
                <Field label="Fim" value={item.endsAt || item.end || ""} onChange={next => updateItem(index, "endsAt", next)} />
              </div>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Field label="Quantidade disponível" value={item.quantity ?? ""} onChange={next => updateItem(index, "quantity", next)} />
                <Field label="Chance de entrega (%)" value={item.chance ?? item.probability ?? ""} onChange={next => updateItem(index, "chance", next)} />
                <Field label="Nome do Ganhador" value={item.winnerName || item.ganhadorNome || item.nomeGanhador || ""} onChange={next => updateItem(index, "winnerName", next)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function friendlyModule(value: string) {
  return moduleLabels[value] || "Ação comercial";
}

function friendlyStatus(value: string) {
  return statusLabels[String(value || "").toLowerCase()] || "Registrado";
}

function Rows({ rows, empty }: { rows: any[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-[var(--admin-muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-[var(--admin-border)]">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="py-2 pr-3 text-[var(--admin-text)]">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
