import React, { useEffect, useState } from "react";
import { Check, Edit3, Plus, Trash2, Trophy, X } from "lucide-react";
import type { Winner } from "../../types";
import { ResponsiveMediaFrame } from "../../components/ResponsiveMediaFrame";
import { inferMediaType } from "../../utils/media";
import { MediaPicker } from "../../components/admin/MediaPicker";

const emptyWinner: Partial<Winner> = {
  winnerName: "",
  raffleName: "",
  prizeDescription: "",
  city: "",
  state: "",
  category: "Sorteio",
  sourceType: "Sorteio",
  status: "Confirmado",
  active: true,
  description: "",
  mediaUrl: "",
  mediaType: "image",
  date: new Date().toISOString().slice(0, 10)
};

function normalizeAdminWinners(payload: unknown): Winner[] {
  return Array.isArray(payload) ? payload.filter(Boolean) as Winner[] : [];
}

export function AdminWinners() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [current, setCurrent] = useState<Partial<Winner>>(emptyWinner);

  const loadWinners = () => {
    fetch("/api/winners")
      .then(res => res.ok ? res.json() : [])
      .then(payload => setWinners(normalizeAdminWinners(payload)))
      .catch(() => setWinners([]));
  };

  useEffect(() => {
    loadWinners();
  }, []);

  const startCreate = () => {
    setCurrent(emptyWinner);
    setIsEditing(true);
  };

  const startEdit = (winner: Winner) => {
    setCurrent({
      ...winner,
      date: winner.date ? new Date(winner.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      active: winner.active !== false,
      category: winner.category || winner.sourceType || "Sorteio",
      sourceType: winner.sourceType || winner.category || "Sorteio"
    });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...current,
      sourceType: current.category || current.sourceType || "Sorteio",
      mediaType: current.mediaUrl ? inferMediaType(current.mediaUrl) : current.mediaType,
      date: current.date ? new Date(current.date).toISOString() : new Date().toISOString(),
      active: current.active !== false
    };
    const id = current.id;
    await fetch(id ? `/api/admin/winners/${id}` : "/api/admin/winners", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setIsEditing(false);
    setCurrent(emptyWinner);
    loadWinners();
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Trophy className="h-8 w-8 text-violet-300" /> Ganhadores
          </h1>
          <p className="mt-1 text-sm text-slate-400">Cadastre ganhadores manuais que aparecem em /ganhadores.</p>
        </div>
        <button onClick={startCreate} className="admin-button-primary">
          <Plus className="h-4 w-4" /> Novo Ganhador
        </button>
      </div>

      {isEditing ? (
        <div className="admin-card p-5">
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-xl font-bold text-[var(--admin-text)]">{current.id ? "Editar Ganhador" : "Adicionar Ganhador"}</h2>
            <button onClick={() => setIsEditing(false)} className="admin-icon-button"><X className="h-5 w-5" /></button>
          </div>

          <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
            <AdminField label="Nome" required value={current.winnerName || ""} onChange={value => setCurrent({ ...current, winnerName: value })} />
            <AdminField label="Campanha" required value={current.raffleName || ""} onChange={value => setCurrent({ ...current, raffleName: value })} />
            <AdminField label="Cidade" value={current.city || ""} onChange={value => setCurrent({ ...current, city: value })} />
            <AdminField label="Estado" value={current.state || ""} onChange={value => setCurrent({ ...current, state: value })} />
            <label className="grid gap-2 text-sm font-semibold text-slate-300">
              Categoria
              <select className="admin-input" value={current.category || "Sorteio"} onChange={event => setCurrent({ ...current, category: event.target.value, sourceType: event.target.value })}>
                <option>Sorteio</option>
                <option>Super Cota</option>
                <option>Roleta</option>
                <option>Raspadinha</option>
                <option>Caixinha</option>
              </select>
            </label>
            <AdminField label="Data" type="date" value={String(current.date || "").slice(0, 10)} onChange={value => setCurrent({ ...current, date: value })} />
            <AdminField label="Prêmio" required value={current.prizeDescription || ""} onChange={value => setCurrent({ ...current, prizeDescription: value })} />
            <AdminField label="Valor do prêmio" type="number" value={String(current.prizeValue || "")} onChange={value => setCurrent({ ...current, prizeValue: Number(value) || 0 })} />
            <label className="grid gap-2 text-sm font-semibold text-slate-300">
              Status
              <select className="admin-input" value={current.status || "Confirmado"} onChange={event => setCurrent({ ...current, status: event.target.value })}>
                <option>Confirmado</option>
                <option>Entregue</option>
                <option>Publicado</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-semibold text-slate-300">
              <input type="checkbox" checked={current.active !== false} onChange={event => setCurrent({ ...current, active: event.target.checked })} />
              Ativo na página pública
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-300 md:col-span-2">
              Descrição opcional
              <textarea className="admin-input min-h-24" value={current.description || ""} onChange={event => setCurrent({ ...current, description: event.target.value })} />
            </label>
            <div className="md:col-span-2">
              <MediaPicker
                label="Imagem ou vídeo do ganhador"
                mediaUsage="winner"
                value={current.mediaUrl || ""}
                mediaType={current.mediaType}
                onChange={(mediaUrl, mediaType) => setCurrent({ ...current, mediaUrl, mediaType: mediaType as any })}
              />
            </div>
            <div className="flex justify-end md:col-span-2">
              <button type="submit" className="admin-button-primary">
                <Check className="h-4 w-4" /> Salvar Ganhador
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {winners.map(winner => (
            <article key={winner.id} className="admin-card overflow-hidden p-0">
              <div className="relative aspect-[4/3] bg-black">
                {winner.mediaUrl ? (
                  <ResponsiveMediaFrame src={winner.mediaUrl} type={winner.mediaType || "image"} alt={winner.winnerName} preferredFit="auto" aspectMode="auto" className="h-full w-full rounded-none" autoPlay={false} />
                ) : (
                  <div className="grid h-full place-items-center text-violet-300"><Trophy className="h-10 w-10" /></div>
                )}
                <div className="absolute right-2 top-2 flex gap-2">
                  <button onClick={() => startEdit(winner)} className="admin-icon-button bg-black/70"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={async () => { await fetch(`/api/admin/winners/${winner.id}`, { method: "DELETE" }); loadWinners(); }} className="admin-icon-button bg-black/70 text-red-200"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold text-white">{winner.winnerName}</h3>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">{winner.category || winner.sourceType || "Sorteio"}</p>
                <p className="mt-2 text-sm font-semibold text-cyan-100">{winner.prizeDescription}</p>
                <p className="mt-1 text-xs text-slate-400">{[winner.city, winner.state].filter(Boolean).join(" - ") || "Local não informado"}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminField({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-300">
      {label}
      <input required={required} type={type} className="admin-input" value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}
