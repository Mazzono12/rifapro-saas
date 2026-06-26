import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Check, Edit2, MoreVertical, Plus, Star, Trash2, X } from "lucide-react";
import type { InstantPrize, Raffle } from "../../types";
import { AdminBadge, AdminButton, AdminIconButton, AdminInput, AdminPage, AdminPageHeader, AdminSection, AdminSelect, AdminTable } from "../../components/ui/admin/AdminDesignSystem";

export function AdminInstantPrizes() {
  const [prizes, setPrizes] = useState<InstantPrize[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState("all");
  const [isEditing, setIsEditing] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<Partial<InstantPrize>>({});

  const loadPrizes = () => {
    fetch("/api/admin/instant-prizes")
      .then(res => res.json())
      .then(setPrizes);
  };

  useEffect(() => {
    loadPrizes();
    fetch("/api/raffles").then(res => res.json()).then((data: Raffle[]) => {
      setRaffles(data);
      if (data[0]) setSelectedRaffleId(data[0].id);
    }).catch(() => null);
  }, []);

  const filteredPrizes = selectedRaffleId === "all" ? prizes : prizes.filter(prize => prize.raffleId === selectedRaffleId);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const method = currentPrize.id ? "PUT" : "POST";
    const url = currentPrize.id ? `/api/admin/instant-prizes/${currentPrize.id}` : "/api/admin/instant-prizes";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentPrize)
    });

    setIsEditing(false);
    setCurrentPrize({});
    loadPrizes();
  };

  const rows = filteredPrizes.map(prize => [
    raffles.find(raffle => raffle.id === prize.raffleId)?.title || prize.raffleId,
    String(prize.numeroPremiado).padStart(6, "0"),
    prize.valorPremio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    prize.winnerName || "-",
    <AdminBadge tone={prize.status === "available" ? "success" : "slate"}>{prize.status === "available" ? "Disponivel" : "Resgatado"}</AdminBadge>,
    <div className="flex justify-end gap-2"><AdminIconButton onClick={() => { setCurrentPrize(prize); setIsEditing(true); }} aria-label="Editar Super Cota"><Edit2 className="h-4 w-4" /></AdminIconButton><AdminIconButton onClick={async () => { await fetch(`/api/admin/instant-prizes/${prize.id}`, { method: "DELETE" }); loadPrizes(); }} aria-label="Excluir Super Cota"><Trash2 className="h-4 w-4" /></AdminIconButton></div>
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Super Cotas"
        description="Cada sorteio possui sua propria lista de Super Cotas."
        actions={<><AdminSelect value={selectedRaffleId} onChange={event => setSelectedRaffleId(event.target.value)}><option value="all">Todos os sorteios</option>{raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}</AdminSelect><AdminButton onClick={() => { setCurrentPrize({ raffleId: selectedRaffleId === "all" ? raffles[0]?.id : selectedRaffleId }); setIsEditing(true); }}><Plus className="h-4 w-4" />Nova Super Cota</AdminButton></>}
      />

      {isEditing && <AdminSection title={currentPrize.id ? "Editar premio" : "Criar novo premio"} actions={<AdminIconButton onClick={() => setIsEditing(false)} aria-label="Fechar formulario"><X className="h-4 w-4" /></AdminIconButton>}>
        <form onSubmit={handleSave} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-[var(--rp-muted)]">Sorteio<AdminSelect required value={currentPrize.raffleId || ""} onChange={event => setCurrentPrize({ ...currentPrize, raffleId: event.target.value })}><option value="">Selecione</option>{raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}</AdminSelect></label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--rp-muted)]">Numero premiado<AdminInput required type="number" value={currentPrize.numeroPremiado || ""} onChange={event => setCurrentPrize({ ...currentPrize, numeroPremiado: parseInt(event.target.value) })} /></label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--rp-muted)]">Valor do premio (R$)<AdminInput required type="number" step="0.01" value={currentPrize.valorPremio || ""} onChange={event => setCurrentPrize({ ...currentPrize, valorPremio: parseFloat(event.target.value) })} /></label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--rp-muted)]">Nome do ganhador<AdminInput value={currentPrize.winnerName || ""} onChange={event => setCurrentPrize({ ...currentPrize, winnerName: event.target.value })} /></label>
          <div className="flex justify-end"><AdminButton type="submit"><Check className="h-4 w-4" />Salvar premio</AdminButton></div>
        </form>
      </AdminSection>}

      <AdminSection title="Lista de Super Cotas" description="Registros cadastrados por sorteio.">
        <AdminTable columns={["Rifa", "Numero", "Valor", "Ganhador", "Status", "Acoes"]} rows={rows} empty="Nenhuma Super Cota cadastrada." />
      </AdminSection>

      <AdminSection title="Resumo operacional">
        <div className="grid gap-3 md:grid-cols-3"><Summary icon={<Star className="h-4 w-4" />} label="Total" value={filteredPrizes.length} /><Summary label="Disponiveis" value={filteredPrizes.filter(prize => prize.status === "available").length} /><Summary label="Resgatadas" value={filteredPrizes.filter(prize => prize.status !== "available").length} /></div>
      </AdminSection>
    </AdminPage>
  );
}

function Summary({ icon, label, value }: { icon?: ReactNode; label: string; value: string | number }) {
  return <div className="rounded-lg border border-[var(--rp-border)] bg-white p-4 text-sm"><span className="flex items-center gap-2 text-[var(--rp-muted)]">{icon}{label}</span><strong className="mt-2 block text-xl text-[var(--rp-text)]">{value}</strong></div>;
}

