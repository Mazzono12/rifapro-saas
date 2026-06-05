import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, Crown, Download, Filter, LayoutDashboard, MessageSquare, Phone, Search, Star, Tag, Ticket, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable, MetricCard } from "../../components/admin/AdminPremium";

type CrmContact = {
  id: string;
  tenant_id: string;
  customer_id?: string;
  nome: string;
  telefone: string;
  email?: string;
  cpf_mascarado: string;
  cidade?: string;
  estado?: string;
  origem: string;
  tags: string[];
  score: number;
  status: "lead" | "comprador" | "vip" | "inativo" | "bloqueado";
  pipeline_stage: "novo lead" | "interessado" | "comprou" | "recorrente" | "vip" | "inativo" | "perdido";
  last_purchase_at?: string;
  total_spent: number;
  total_orders: number;
  notes: string;
  updated_at: string;
};

type CrmPayload = {
  contacts: CrmContact[];
  pipeline: Array<{ stage: string; total: number; value: number; contacts: CrmContact[] }>;
  segments: Record<string, CrmContact[]>;
  metrics: { total: number; leads: number; compradores: number; vips: number; inativos: number; receita: number };
};

type BuyerCrmCustomer = {
  id: string;
  nome: string;
  whatsapp: string;
  totalComprado: number;
  quantidadeCompras: number;
  ultimaCompra: string;
  campanhaMaisRecente: string;
  statusComercial: "Novo cliente" | "Recorrente" | "VIP" | "Inativo" | "PIX pendente" | string;
  tiposCompra: string[];
  flags: Record<string, boolean>;
  mensagemPronta: string;
};

type BuyerCrmPayload = {
  customers: BuyerCrmCustomer[];
  segments: Record<string, BuyerCrmCustomer[]>;
  metrics: { total: number; totalComprado: number; compras: number; pixPendente: number; vip: number; recorrentes: number };
};

const emptyPayload: CrmPayload = { contacts: [], pipeline: [], segments: {}, metrics: { total: 0, leads: 0, compradores: 0, vips: 0, inativos: 0, receita: 0 } };
const emptyBuyerPayload: BuyerCrmPayload = { customers: [], segments: {}, metrics: { total: 0, totalComprado: 0, compras: 0, pixPendente: 0, vip: 0, recorrentes: 0 } };

const segmentLabels: Record<string, string> = {
  inactive: "Inativos",
  recurring: "Recorrentes",
  highTicket: "Alto ticket",
  vip: "VIP",
  leads: "Interessados",
  blocked: "Bloqueados"
};

const buyerSegmentLabels: Record<string, string> = {
  todos: "Todos",
  compraramHoje: "Compraram hoje",
  ultimos7Dias: "Compraram nos últimos 7 dias",
  clientesVip: "Clientes VIP",
  compradoresRecorrentes: "Compradores recorrentes",
  pixPendente: "PIX pendente",
  pixVencido: "PIX vencido",
  compraramRifa: "Compraram Rifa",
  compraramFazendinha: "Compraram Fazendinha",
  compraramModalidades: "Compraram Modalidades",
  inativos30Dias: "Inativos há 30 dias"
};

export function AdminCRM() {
  const [data, setData] = useState<CrmPayload>(emptyPayload);
  const [buyerData, setBuyerData] = useState<BuyerCrmPayload>(emptyBuyerPayload);
  const [buyerSegment, setBuyerSegment] = useState("todos");
  const [buyerQuery, setBuyerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [leadForm, setLeadForm] = useState({ nome: "", telefone: "", origem: "manual", tags: "" });

  useEffect(() => {
    void loadCrm();
  }, []);

  const loadCrm = async () => {
    const [response, buyersResponse] = await Promise.all([
      fetch("/api/admin/crm"),
      fetch("/api/admin/crm/customers")
    ]);
    const payload = response.ok ? await response.json() : emptyPayload;
    const buyersPayload = buyersResponse.ok ? await buyersResponse.json() : emptyBuyerPayload;
    setData(payload);
    setBuyerData(buyersPayload);
    if (selected) void openContact(selected.id, payload.contacts);
  };

  const openContact = async (id: string, fallback = data.contacts) => {
    const response = await fetch(`/api/admin/crm/contacts/${id}`);
    if (!response.ok) {
      const local = fallback.find(contact => contact.id === id) || null;
      setSelected(local);
      return;
    }
    const payload = await response.json();
    setSelected(payload.contact);
    setHistory(payload.history);
    setNote(payload.contact.notes || "");
  };

  const saveContact = async (patch: Partial<CrmContact>) => {
    if (!selected) return;
    const response = await fetch(`/api/admin/crm/contacts/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, reason: "Atualizacao operacional CRM" })
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error || "Erro ao atualizar contato");
      return;
    }
    toast.success("Contato CRM atualizado");
    setSelected(payload);
    await loadCrm();
  };

  const saveNote = async () => {
    if (!selected || !note.trim()) return;
    const response = await fetch(`/api/admin/crm/contacts/${selected.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, reason: "Nota interna CRM" })
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error || "Erro ao salvar nota");
      return;
    }
    toast.success("Nota salva");
    setSelected(payload);
    await loadCrm();
  };

  const createLead = async () => {
    const response = await fetch("/api/admin/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...leadForm, tags: leadForm.tags.split(",").map(item => item.trim()).filter(Boolean), reason: "Contato criado no CRM" })
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error || "Erro ao criar contato");
      return;
    }
    toast.success("Contato criado");
    setCreating(false);
    setLeadForm({ nome: "", telefone: "", origem: "manual", tags: "" });
    await loadCrm();
    await openContact(payload.id);
  };

  const filtered = useMemo(() => {
    const text = query.toLowerCase();
    const digits = query.replace(/\D/g, "");
    return data.contacts.filter(contact => {
      const haystack = `${contact.nome} ${contact.telefone} ${contact.email || ""} ${contact.cpf_mascarado} ${contact.cidade || ""} ${contact.estado || ""} ${contact.origem} ${contact.tags.join(" ")}`.toLowerCase();
      if (query && !haystack.includes(text) && !contact.telefone.replace(/\D/g, "").includes(digits)) return false;
      if (status && contact.status !== status) return false;
      if (tag && !contact.tags.includes(tag)) return false;
      return true;
    });
  }, [data.contacts, query, status, tag]);

  const tags = useMemo(() => Array.from(new Set(data.contacts.flatMap(contact => contact.tags))).sort(), [data.contacts]);
  const buyerRows = useMemo(() => {
    const source = buyerSegment === "todos" ? buyerData.customers : buyerData.segments[buyerSegment] || [];
    const text = buyerQuery.toLowerCase().trim();
    const digits = buyerQuery.replace(/\D/g, "");
    return source.filter(customer => {
      const haystack = `${customer.nome} ${customer.whatsapp} ${customer.campanhaMaisRecente} ${customer.statusComercial}`.toLowerCase();
      return !text || haystack.includes(text) || customer.whatsapp.includes(digits);
    });
  }, [buyerData, buyerSegment, buyerQuery]);

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar agora");
    }
  };

  return (
    <div className="space-y-6">
      <section className="admin-card overflow-hidden p-0">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[var(--admin-primary)]">
                <Crown className="h-4 w-4" />
                CRM de Compradores
              </p>
              <h1 className="text-2xl font-black text-[var(--admin-text)]">Segmentação comercial da base</h1>
              <p className="mt-1 max-w-3xl text-sm text-[var(--admin-muted)]">Organize compradores, copie WhatsApp e mensagens prontas. Nenhuma mensagem é enviada automaticamente.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniBuyerMetric label="Compradores" value={buyerData.metrics.total} />
              <MiniBuyerMetric label="Compras" value={buyerData.metrics.compras} />
              <MiniBuyerMetric label="VIPs" value={buyerData.metrics.vip} />
              <MiniBuyerMetric label="PIX pendente" value={buyerData.metrics.pixPendente} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(buyerSegmentLabels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBuyerSegment(key)}
              className={`rounded-[8px] border p-3 text-left transition ${buyerSegment === key ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]/12" : "border-[var(--admin-border)] bg-[var(--admin-surface-strong)] hover:border-[var(--admin-primary)]/50"}`}
            >
              <p className="text-sm font-black text-[var(--admin-text)]">{label}</p>
              <p className="mt-2 text-2xl font-black text-[var(--admin-primary)]">{key === "todos" ? buyerData.customers.length : buyerData.segments[key]?.length || 0}</p>
            </button>
          ))}
        </div>

        <div className="border-t border-[var(--admin-border)] p-4">
          <label className="relative mb-4 block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <input value={buyerQuery} onChange={event => setBuyerQuery(event.target.value)} placeholder="Buscar por nome, WhatsApp, campanha ou status..." className="admin-input h-12 w-full pl-11" />
          </label>

          {buyerRows.length ? (
            <div className="grid gap-3">
              {buyerRows.map(customer => (
                <article key={customer.id} className="rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-strong)] p-4">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-center">
                    <div className="min-w-0">
                      <p className="break-words text-base font-black text-[var(--admin-text)]">{customer.nome}</p>
                      <p className="mt-1 font-mono text-xs text-[var(--admin-muted)]">{customer.whatsapp || "WhatsApp não informado"}</p>
                      <span className="mt-2 inline-flex rounded-full border border-[var(--admin-border)] px-3 py-1 text-xs font-black text-[var(--admin-primary)]">{customer.statusComercial}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <MiniBuyerMetric label="Total comprado" value={`R$ ${customer.totalComprado.toFixed(2)}`} />
                      <MiniBuyerMetric label="Compras" value={customer.quantidadeCompras} />
                    </div>
                    <div className="min-w-0 text-sm text-[var(--admin-muted)]">
                      <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {customer.ultimaCompra ? new Date(customer.ultimaCompra).toLocaleDateString("pt-BR") : "Sem compra paga"}</p>
                      <p className="mt-2 truncate font-bold text-[var(--admin-text)]">{customer.campanhaMaisRecente || "Campanha não informada"}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                      <button type="button" className="admin-button-secondary justify-center" onClick={() => void copyText("WhatsApp", customer.whatsapp)}>
                        <Copy className="h-4 w-4" /> Copiar WhatsApp
                      </button>
                      <button type="button" className="admin-button-primary justify-center" onClick={() => void copyText("Mensagem", customer.mensagemPronta)}>
                        <MessageSquare className="h-4 w-4" /> Copiar mensagem
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[var(--admin-border)] p-8 text-center">
              <UserRound className="mx-auto mb-3 h-10 w-10 text-[var(--admin-primary)]" />
              <p className="font-bold text-[var(--admin-text)]">Nenhum comprador neste segmento</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Quando houver movimentação comercial, os clientes aparecerão aqui.</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard icon={UserRound} label="Contatos" value={data.metrics.total} trend="interessados, compradores e afiliados" />
        <MetricCard icon={Star} label="VIPs" value={data.metrics.vips} trend="alto valor ou recorrência" tone="warning" />
        <MetricCard icon={Ticket} label="Compradores" value={data.metrics.compradores} trend="com compra paga" tone="success" />
        <MetricCard icon={Filter} label="Inativos" value={data.metrics.inativos} trend="reativação comercial" tone="danger" />
        <MetricCard icon={LayoutDashboard} label="Receita acompanhada" value={`R$ ${data.metrics.receita.toFixed(2)}`} trend="total pago por contatos" tone="accent" />
      </div>

      <section className="admin-card p-5">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-black text-[var(--admin-text)]">Base de relacionamento</h1>
            <p className="text-sm text-[var(--admin-muted)]">Contatos, etapas comerciais, segmentos, compras e histórico interno por cliente.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="/api/admin/crm/export.csv" className="admin-button-secondary inline-flex items-center justify-center gap-2"><Download className="h-4 w-4" /> CSV</a>
            <button type="button" onClick={() => setCreating(value => !value)} className="admin-button inline-flex items-center justify-center gap-2"><UserPlus className="h-4 w-4" /> Novo contato</button>
          </div>
        </div>

        {creating && (
          <div className="mb-5 grid gap-3 rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4 md:grid-cols-5">
            <input className="admin-input" placeholder="Nome" value={leadForm.nome} onChange={event => setLeadForm({ ...leadForm, nome: event.target.value })} />
            <input className="admin-input" placeholder="Telefone" value={leadForm.telefone} onChange={event => setLeadForm({ ...leadForm, telefone: event.target.value })} />
            <input className="admin-input" placeholder="Origem" value={leadForm.origem} onChange={event => setLeadForm({ ...leadForm, origem: event.target.value })} />
            <input className="admin-input" placeholder="Marcadores separados por vírgula" value={leadForm.tags} onChange={event => setLeadForm({ ...leadForm, tags: event.target.value })} />
            <button type="button" className="admin-button" onClick={() => void createLead()}>Salvar contato</button>
          </div>
        )}

        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, CPF mascarado, telefone, cidade, origem ou tag..." className="admin-input h-12 w-full rounded-2xl pl-11 pr-4 outline-none" />
          </label>
          <select className="admin-input" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">Todos status</option>
            <option value="lead">Interessado</option>
            <option value="comprador">Comprador</option>
            <option value="vip">VIP</option>
            <option value="inativo">Inativo</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
          <select className="admin-input" value={tag} onChange={event => setTag(event.target.value)}>
            <option value="">Todos marcadores</option>
            {tags.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <AdminDataTable
            columns={["Contato", "Status", "Etapa", "Prioridade", "Compras", "Total", "Ações"]}
            rows={filtered.map(contact => [
              <div>
                <p className="font-bold text-[var(--admin-text)]">{contact.nome}</p>
                <p className="text-xs text-[var(--admin-muted)]">{contact.telefone} · {contact.cidade || "Cidade nao informada"}</p>
              </div>,
              <StatusBadge status={contact.status} />,
              <span className="text-sm text-[var(--admin-muted)]">{commercialStageLabel(contact.pipeline_stage)}</span>,
              <span className="font-bold text-[var(--admin-primary)]">{contact.score}</span>,
              contact.total_orders,
              `R$ ${Number(contact.total_spent || 0).toFixed(2)}`,
              <button onClick={() => void openContact(contact.id)} className="admin-button-secondary">Contato</button>
            ])}
          />

          <ContactPanel selected={selected} history={history} note={note} setNote={setNote} saveNote={saveNote} saveContact={saveContact} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="admin-card p-5">
          <h2 className="mb-4 text-lg font-black text-[var(--admin-text)]">Etapas comerciais</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.pipeline.map(stage => (
              <div key={stage.stage} className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-4">
                <p className="text-sm font-black capitalize text-[var(--admin-text)]">{stage.stage}</p>
                <p className="mt-1 text-xs text-[var(--admin-muted)]">{stage.total} contato(s) · R$ {stage.value.toFixed(2)}</p>
                <div className="mt-3 space-y-2">
                  {stage.contacts.slice(0, 4).map(contact => (
                    <button key={contact.id} onClick={() => void openContact(contact.id)} className="block w-full rounded-xl bg-black/20 px-3 py-2 text-left text-xs font-bold text-[var(--admin-text)] hover:bg-white/10">{contact.nome}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card p-5">
          <h2 className="mb-4 text-lg font-black text-[var(--admin-text)]">Segmentos</h2>
          <div className="space-y-2">
            {(Object.entries(data.segments) as Array<[string, CrmContact[]]>).map(([key, contacts]) => (
              <button key={key} onClick={() => { setStatus(""); setTag(""); setQuery(""); }} className="flex w-full items-center justify-between rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] px-4 py-3 text-left">
                <span className="font-bold text-[var(--admin-text)]">{segmentLabels[key] || key}</span>
                <span className="rounded-full bg-[var(--admin-primary)]/15 px-3 py-1 text-xs font-black text-[var(--admin-primary)]">{contacts.length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export const AdminUsers = AdminCRM;

function MiniBuyerMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-black/15 p-3">
      <p className="truncate text-[10px] font-bold uppercase text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

function commercialStageLabel(stage: CrmContact["pipeline_stage"]) {
  const labels: Record<CrmContact["pipeline_stage"], string> = {
    "novo lead": "Novo contato",
    interessado: "Interessado",
    comprou: "Comprou",
    recorrente: "Recorrente",
    vip: "VIP",
    inativo: "Inativo",
    perdido: "Perdido"
  };
  return labels[stage] || stage;
}

function commercialStatusLabel(status: CrmContact["status"]) {
  const labels: Record<CrmContact["status"], string> = {
    lead: "Interessado",
    comprador: "Comprador",
    vip: "VIP",
    inativo: "Inativo",
    bloqueado: "Bloqueado"
  };
  return labels[status] || status;
}

function StatusBadge({ status }: { status: CrmContact["status"] }) {
  const tone = status === "vip" ? "text-amber-200 border-amber-400/30 bg-amber-500/10" : status === "bloqueado" ? "text-rose-200 border-rose-400/30 bg-rose-500/10" : "text-[var(--admin-primary)] border-[var(--admin-border)] bg-white/[0.03]";
  return <span className={`rounded-full border px-2 py-1 text-xs font-black uppercase ${tone}`}>{commercialStatusLabel(status)}</span>;
}

function ContactPanel({ selected, history, note, setNote, saveNote, saveContact }: {
  selected: CrmContact | null;
  history: any;
  note: string;
  setNote: (value: string) => void;
  saveNote: () => void;
  saveContact: (patch: Partial<CrmContact>) => void;
}) {
  if (!selected) {
    return (
      <aside className="admin-card grid min-h-[520px] place-items-center p-5 text-center">
        <div>
          <UserRound className="mx-auto mb-3 h-10 w-10 text-[var(--admin-primary)]" />
          <p className="font-bold text-[var(--admin-text)]">Selecione um contato</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Histórico comercial, mensagens, saldo e registros internos aparecem aqui.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="admin-card p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--admin-primary)]/15 text-xl font-black text-[var(--admin-primary)]">{selected.nome.charAt(0)}</div>
        <div>
          <h2 className="text-xl font-black text-[var(--admin-text)]">{selected.nome}</h2>
          <p className="text-sm text-[var(--admin-muted)]">{selected.origem} · {selected.cidade || "Cidade nao informada"} {selected.estado || ""}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniProfileStat icon={Phone} label="Telefone" value={selected.telefone || "-"} />
        <MiniProfileStat icon={Tag} label="CPF" value={selected.cpf_mascarado || "-"} />
        <MiniProfileStat icon={Ticket} label="Pedidos" value={selected.total_orders} />
        <MiniProfileStat icon={Star} label="Total gasto" value={`R$ ${Number(selected.total_spent || 0).toFixed(2)}`} />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <select className="admin-input" value={selected.status} onChange={event => void saveContact({ status: event.target.value as CrmContact["status"] })}>
          <option value="lead">Interessado</option>
          <option value="comprador">Comprador</option>
          <option value="vip">VIP</option>
          <option value="inativo">Inativo</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
        <select className="admin-input" value={selected.pipeline_stage} onChange={event => void saveContact({ pipeline_stage: event.target.value as CrmContact["pipeline_stage"] })}>
          <option value="novo lead">Novo contato</option>
          <option value="interessado">Interessado</option>
          <option value="comprou">Comprou</option>
          <option value="recorrente">Recorrente</option>
          <option value="vip">VIP</option>
          <option value="inativo">Inativo</option>
          <option value="perdido">Perdido</option>
        </select>
      </div>

      <div className="mt-5">
        <label className="text-sm font-bold text-[var(--admin-text)]">Notas internas</label>
        <textarea className="admin-input mt-2 min-h-28 w-full" value={note} onChange={event => setNote(event.target.value)} />
        <button type="button" className="admin-button mt-2" onClick={() => void saveNote()}>Salvar nota</button>
      </div>

      <div className="mt-5 space-y-3">
        <HistoryBlock icon={Ticket} title="Compras" items={(history?.purchases || []).slice(0, 4).map((item: any) => `${item.type} · R$ ${Number(item.amount || 0).toFixed(2)}`)} />
        <HistoryBlock icon={MessageSquare} title="WhatsApp" items={(history?.whatsapp || []).slice(0, 4).map((item: any) => `${item.status} · ${item.template || item.message || item.order_id || "mensagem"}`)} />
        <HistoryBlock icon={Tag} title="Marcadores" items={selected.tags.length ? selected.tags : ["sem marcadores"]} />
      </div>
    </aside>
  );
}

function MiniProfileStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-3">
      <Icon className="mb-2 h-4 w-4 text-[var(--admin-primary)]" />
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[var(--admin-text)]">{value}</p>
    </div>
  );
}

function HistoryBlock({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--admin-primary)]" />
        <p className="text-sm font-black text-[var(--admin-text)]">{title}</p>
      </div>
      <div className="space-y-1">
        {items.length ? items.map((item, index) => <p key={`${title}-${index}`} className="text-xs text-[var(--admin-muted)]">{item}</p>) : <p className="text-xs text-[var(--admin-muted)]">Sem registros.</p>}
      </div>
    </div>
  );
}
