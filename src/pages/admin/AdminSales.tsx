import { useEffect, useState } from "react";
import { CheckCircle2, Download, FileJson, Users, Search, Save, TicketCheck, XCircle, Wallet, Trophy, UserPlus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import type { Raffle } from "../../types";

export function AdminSales() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [ticketSearch, setTicketSearch] = useState({ raffleId: "1", number: "" });
  const [ticketResult, setTicketResult] = useState<any | null>(null);
  const [assignCustomerId, setAssignCustomerId] = useState("");
  const [customerLookup, setCustomerLookup] = useState("");
  const [customerLookupResults, setCustomerLookupResults] = useState<any[]>([]);
  const [affiliateQuery, setAffiliateQuery] = useState("");
  const [affiliateResults, setAffiliateResults] = useState<any[]>([]);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any | null>(null);
  const [walletForm, setWalletForm] = useState({ amount: "", note: "" });
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportReply, setSupportReply] = useState<Record<string, string>>({});
  const [manualAffiliate, setManualAffiliate] = useState({
    name: "",
    phone: "",
    cpf: "",
    city: "",
    state: "",
    refCode: "",
    pixKey: "",
    accessPassword: "123456"
  });
  const [drawSearch, setDrawSearch] = useState({ raffleId: "1", number: "" });
  const [drawResult, setDrawResult] = useState<any | null>(null);
  const [purchaseRaffleFilter, setPurchaseRaffleFilter] = useState("all");

  const loadData = () => {
    fetch("/api/admin/purchases")
      .then(res => res.json())
      .then(setPurchases);
    fetch("/api/admin/customers").then(res => res.json()).then(setCustomers).catch(() => null);
    fetch("/api/raffles").then(res => res.json()).then(setRaffles).catch(() => null);
    fetch("/api/admin/affiliates/withdrawals").then(res => res.json()).then(setWithdrawals).catch(() => null);
    fetch("/api/admin/support/tickets").then(res => res.json()).then(setSupportTickets).catch(() => null);
  };

  useEffect(() => {
    loadData();
  }, []);

  const exportCSV = () => {
    const headers = ["Nome completo", "Telefone", "Cidade", "Data da compra", "Codigo do sorteio", "Quantidade de cotas"];
    const rows = filteredPurchases.map(p => [
      p.customer?.name || "",
      p.customer?.phone || p.contact || "",
      p.customer?.city || "",
      p.createdAt,
      p.raffleId,
      p.tickets || 0
    ]);
    downloadCsv("vendas.csv", headers, rows);
  };

  const exportJSON = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(filteredPurchases, null, 2))}`;
    const a = document.createElement("a");
    a.href = jsonString;
    a.download = "data.json";
    a.click();
  };

  const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const escape = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csvContent = [headers.map(escape).join(","), ...rows.map(row => row.map(escape).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportAllCustomers = () => {
    downloadCsv(
      "clientes-plataforma.csv",
      ["ID", "Nome", "Telefone", "CPF", "Cidade", "UF", "Cotas", "Afiliado"],
      customers.map(customer => [
        customer.id,
        customer.name,
        customer.phone,
        customer.cpf,
        customer.city || "",
        customer.state || "",
        customer.totalTickets || 0,
        customer.affiliateRefCode || ""
      ])
    );
  };

  const exportRaffleParticipants = () => {
    const raffleId = purchaseRaffleFilter === "all" ? ticketSearch.raffleId : purchaseRaffleFilter;
    const raffle = raffles.find(item => item.id === raffleId);
    const participantMap = new Map<string, any>();
    purchases
      .filter(purchase => purchase.raffleId === raffleId)
      .forEach(purchase => {
        const key = purchase.customer?.id || purchase.contact || purchase.purchaseId;
        const current = participantMap.get(key) || {
          id: purchase.customer?.id || "",
          name: purchase.customer?.name || "",
          phone: purchase.customer?.phone || purchase.contact || "",
          cpf: purchase.customer?.cpf || "",
          city: purchase.customer?.city || "",
          state: purchase.customer?.state || "",
          tickets: 0,
          amount: 0,
          lastPurchaseAt: purchase.createdAt || ""
        };
        current.tickets += purchase.tickets || 0;
        current.amount += purchase.amount || 0;
        if (purchase.createdAt && (!current.lastPurchaseAt || purchase.createdAt > current.lastPurchaseAt)) current.lastPurchaseAt = purchase.createdAt;
        participantMap.set(key, current);
      });
    downloadCsv(
      `clientes-${raffle?.title || raffleId}.csv`,
      ["Nome completo", "Telefone", "Cidade", "Data da compra", "Codigo do sorteio", "Quantidade de cotas"],
      Array.from(participantMap.values()).map(item => [
        item.name,
        item.phone,
        item.city,
        item.lastPurchaseAt || "",
        raffleId,
        item.tickets
      ])
    );
  };

  const filteredCustomers = customers.filter(customer => {
    const query = customerQuery.toLowerCase().replace(/\D/g, "");
    const text = `${customer.name} ${customer.phone} ${customer.cpf} ${customer.city} ${customer.state}`.toLowerCase();
    return !customerQuery || text.includes(customerQuery.toLowerCase()) || customer.phone.includes(query) || customer.cpf.includes(query);
  });
  const filteredPurchases = purchases.filter(purchase => purchaseRaffleFilter === "all" || purchase.raffleId === purchaseRaffleFilter);

  const openCustomerEditor = (customer: any) => {
    setEditingCustomer({
      ...customer,
      purchases: (customer.purchases || []).map((purchase: any) => ({
        ...purchase,
        editableNumbers: purchase.editableNumbers ?? (purchase.numeros || []).join(", ")
      }))
    });
  };

  const saveCustomer = async () => {
    if (!editingCustomer) return;
    const res = await fetch(`/api/admin/customers/${editingCustomer.id}/full`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingCustomer),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao salvar cliente");
      return;
    }
    toast.success("Cadastro atualizado pelo admin");
    setEditingCustomer(null);
    loadData();
  };

  const searchTicket = async () => {
    const params = new URLSearchParams({ raffleId: ticketSearch.raffleId, number: ticketSearch.number });
    const res = await fetch(`/api/admin/tickets/search?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao buscar cota");
      return;
    }
    setTicketResult(data);
    setAssignCustomerId(data.customer?.id || customers[0]?.id || "");
  };

  const searchCustomer = async () => {
    const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(customerLookup)}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao buscar cliente");
      return;
    }
    setCustomerLookupResults(data);
  };

  const applyCustomerSearch = () => {
    setCustomerQuery(customerSearchInput.trim());
  };

  const searchAffiliate = async () => {
    const res = await fetch(`/api/admin/affiliates/search?q=${encodeURIComponent(affiliateQuery)}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao buscar afiliado");
      return;
    }
    setAffiliateResults(data);
    setSelectedAffiliate(data[0] || null);
  };

  const createManualAffiliate = async () => {
    const res = await fetch("/api/admin/affiliates/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manualAffiliate),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao cadastrar afiliado");
      return;
    }
    toast.success("Afiliado cadastrado manualmente");
    setManualAffiliate({ name: "", phone: "", cpf: "", city: "", state: "", refCode: "", pixKey: "", accessPassword: "123456" });
    setAffiliateResults([{ customer: data.customer, affiliate: data.affiliate }, ...affiliateResults]);
    setSelectedAffiliate({ customer: data.customer, affiliate: data.affiliate });
    loadData();
  };

  const updateAffiliateWallet = async (action: string) => {
    if (!selectedAffiliate?.affiliate?.refCode) return;
    const res = await fetch(`/api/admin/affiliates/${selectedAffiliate.affiliate.refCode}/wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, amount: Number(walletForm.amount || 0), note: walletForm.note }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao atualizar saldo");
      return;
    }
    const next = { ...selectedAffiliate, affiliate: data };
    setSelectedAffiliate(next);
    setAffiliateResults(results => results.map(item => item.affiliate.refCode === data.refCode ? next : item));
    toast.success("Carteira do afiliado atualizada");
  };

  const saveAffiliateFull = async () => {
    if (!selectedAffiliate?.affiliate?.refCode) return;
    const res = await fetch(`/api/admin/affiliates/${selectedAffiliate.affiliate.refCode}/full`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selectedAffiliate),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao salvar afiliado");
      return;
    }
    setSelectedAffiliate(data);
    setAffiliateResults(results => results.map(item => item.affiliate.refCode === data.affiliate.refCode ? data : item));
    toast.success("Afiliado atualizado");
    loadData();
  };

  const runDrawLookup = async () => {
    const res = await fetch(`/api/admin/raffles/${drawSearch.raffleId}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: Number(drawSearch.number) }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao realizar sorteio");
      return;
    }
    setDrawResult(data);
  };

  const assignTicket = async (status: "pending" | "paid") => {
    const res = await fetch("/api/admin/tickets/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raffleId: ticketSearch.raffleId,
        number: Number(ticketSearch.number),
        customerId: assignCustomerId,
        status,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao atribuir cota");
      return;
    }
    setTicketResult(data);
    toast.success(status === "paid" ? "Cota comprada pelo admin" : "Cota reservada pelo admin");
    loadData();
  };

  const updatePurchaseStatus = async (purchaseId: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/admin/purchases/${purchaseId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason: "Rejeitada pelo admin" }) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao atualizar compra");
      return;
    }
    toast.success(action === "approve" ? "Pagamento PIX aprovado" : "Pagamento PIX rejeitado");
    loadData();
  };

  const updateWithdrawalStatus = async (id: string, status: "paid" | "rejected") => {
    const res = await fetch(`/api/admin/affiliates/withdrawals/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: status === "paid" ? "Transferencia manual confirmada pelo admin" : "Saque recusado pelo admin" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao atualizar saque");
      return;
    }
    toast.success(status === "paid" ? "Saque marcado como pago" : "Saque recusado");
    loadData();
  };

  const replySupport = async (ticketId: string) => {
    const message = supportReply[ticketId] || "";
    const res = await fetch(`/api/admin/support/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao responder suporte");
      return;
    }
    setSupportReply(current => ({ ...current, [ticketId]: "" }));
    setSupportTickets(current => current.map(ticket => ticket.id === ticketId ? data : ticket));
    toast.success("Resposta enviada ao cliente");
  };

  return (
    <div className="space-y-6">
       <section className="admin-card p-5">
       <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
         <div>
            <h1 className="mb-1 flex items-center gap-3 text-2xl font-black text-[var(--admin-text)]">
               <Users className="h-7 w-7 text-[var(--admin-primary)]" /> Vendas e Usuários
            </h1>
            <p className="text-sm text-[var(--admin-muted)]">Gerencie pagamentos, clientes, cotas, afiliados e dados por sorteio.</p>
         </div>
         <div className="flex flex-wrap gap-2">
           <select value={purchaseRaffleFilter} onChange={e => setPurchaseRaffleFilter(e.target.value)} className="admin-input rounded-xl px-3 py-2 text-xs">
             <option value="all">Todos os sorteios</option>
             {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
           </select>
           <button onClick={exportCSV} className="admin-button-secondary">
              <Download className="w-4 h-4" /> CSV
           </button>
           <button onClick={exportJSON} className="admin-button-secondary">
              <FileJson className="w-4 h-4" /> JSON
           </button>
           <button onClick={exportRaffleParticipants} className="admin-button-secondary">
              <Download className="w-4 h-4" /> Clientes da ação
           </button>
           <button onClick={exportAllCustomers} className="admin-button-secondary">
              <Download className="w-4 h-4" /> Todos clientes
           </button>
         </div>
       </div>
       </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="admin-card p-5 space-y-4 xl:col-span-2">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-300" />
              <h2 className="text-xl font-display font-bold">Realizar sorteio por cota</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
              <select value={drawSearch.raffleId} onChange={e => setDrawSearch({ ...drawSearch, raffleId: e.target.value })} className="p-3">
                {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
              </select>
              <input value={drawSearch.number} onChange={e => setDrawSearch({ ...drawSearch, number: e.target.value })} placeholder="Número da cota sorteada" className="p-3" />
              <button onClick={runDrawLookup} className="admin-button">Apurar</button>
            </div>
            {drawResult && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-slate-300">
                  Sorteio <strong className="text-white">{drawResult.raffle?.title}</strong> • Cota <strong className="text-white">#{String(drawResult.number).padStart(6, "0")}</strong>
                </p>
                <p className={cn("mt-2 text-sm font-bold", drawResult.status === "available" ? "text-emerald-300" : drawResult.status === "winner" ? "text-amber-300" : "text-cyan-300")}>
                  {drawResult.message}
                </p>
                {drawResult.customer && (
                  <div className="mt-3 grid gap-2 text-xs font-mono text-slate-400 md:grid-cols-4">
                    <span>Cliente: {drawResult.customer.name}</span>
                    <span>Telefone: {drawResult.customer.phone}</span>
                    <span>CPF: {drawResult.customer.cpf}</span>
                    <span>Cidade: {drawResult.customer.city || "Nao informado"} / {drawResult.customer.state || "UF"}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="admin-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <TicketCheck className="w-5 h-5 text-neon-cyan" />
             <h2 className="text-xl font-display font-bold">Buscar, reservar ou vender cota</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
             <select value={ticketSearch.raffleId} onChange={e => setTicketSearch({ ...ticketSearch, raffleId: e.target.value })} className="p-3">
               {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
             </select>
              <input value={ticketSearch.number} onChange={e => setTicketSearch({ ...ticketSearch, number: e.target.value })} placeholder="Número da cota" className="p-3" />
             <button onClick={searchTicket} className="admin-button">Buscar</button>
           </div>
           {ticketResult && (
             <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
               <p className="text-sm text-slate-300">
                 Cota <strong className="text-white">#{String(ticketResult.number).padStart(6, "0")}</strong>: {" "}
                 <span className={ticketResult.status === "available" ? "text-emerald-300" : "text-amber-300"}>
                   {ticketResult.status === "available" ? "disponivel" : ticketResult.status === "sold" ? "comprada" : "reservada"}
                 </span>
               </p>
                {ticketResult.customer && (
                  <div className="text-xs text-slate-400 font-mono">
                    Cliente: {ticketResult.customer.name} • {ticketResult.customer.phone} • CPF {ticketResult.customer.cpf} • {ticketResult.customer.city || "Nao informado"} / {ticketResult.customer.state || "UF"}
                  </div>
                )}
               <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
                 <select value={assignCustomerId} onChange={e => setAssignCustomerId(e.target.value)} className="p-3">
                   {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} • {customer.phone}</option>)}
                 </select>
                 <button onClick={() => assignTicket("pending")} className="px-4 py-3 rounded-xl border border-amber-400/30 text-amber-200">Reservar</button>
                 <button onClick={() => assignTicket("paid")} className="px-4 py-3 rounded-xl border border-emerald-400/30 text-emerald-200">Comprar</button>
               </div>
             </div>
           )}
          </div>

          <div className="admin-card p-5 space-y-4">
           <div className="flex items-center justify-between gap-4">
             <h2 className="text-xl font-display font-bold">Buscar Cliente</h2>
              <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
                <input
                  value={customerSearchInput}
                  onChange={e => setCustomerSearchInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") applyCustomerSearch();
                  }}
                  placeholder="Buscar nome, CPF, telefone..."
                  className="admin-input w-full p-3 text-sm"
                />
                <button onClick={applyCustomerSearch} className="admin-button">
                  <Search className="h-4 w-4" /> Buscar
                </button>
              </div>
           </div>
           <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 pr-1">
             {filteredCustomers.map(customer => (
               <button key={customer.id} onClick={() => openCustomerEditor(customer)} className="w-full rounded-xl border border-[var(--admin-border)] bg-white/[0.03] p-3 text-left transition hover:border-[var(--admin-primary)] hover:bg-white/[0.06]">
                 <p className="font-semibold text-[var(--admin-text)]">{customer.name}</p>
                 <p className="text-xs font-mono text-[var(--admin-muted)]">{customer.phone} • CPF {customer.cpf} • {customer.city || "Cidade"} / {customer.state || "UF"}</p>
               </button>
             ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:col-span-2 xl:grid-cols-2">
          <div className="admin-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-display font-bold">Buscar cliente por telefone ou CPF</h2>
              <button onClick={searchCustomer} className="admin-button">Buscar</button>
            </div>
            <input value={customerLookup} onChange={e => setCustomerLookup(e.target.value)} placeholder="Digite telefone ou CPF" className="w-full p-3" />
            <div className="space-y-2">
              {customerLookupResults.map(customer => (
                <div key={customer.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-bold text-white">{customer.name}</p>
                      <p className="text-xs font-mono text-slate-400">{customer.phone} • CPF {customer.cpf} • {customer.city || "Nao informado"} / {customer.state || "UF"}</p>
                      <p className="mt-1 text-xs font-mono text-cyan-300">Afiliado: {customer.affiliate?.refCode} • Saldo total R$ {Number(customer.affiliate?.commission || 0).toFixed(2)}</p>
                    </div>
                    <button onClick={() => openCustomerEditor(customer)} className="admin-button-secondary">
                      Editar ficha
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <LookupStat label="Compras rifas" value={String(customer.purchases?.length || 0)} />
                    <LookupStat label="Fazendinha" value={String(customer.fazendinhaPurchases?.length || 0)} />
                    <LookupStat label="Modalidades" value={String(customer.modalidadePurchases?.length || 0)} />
                  </div>
                  {(customer.purchases || []).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Cotas compradas em rifas</p>
                      {customer.purchases.map((purchase: any) => (
                        <div key={purchase.purchaseId} className="rounded-xl border border-white/5 bg-black/20 p-3">
                          <p className="text-sm font-bold text-white">{purchase.raffleTitle} • {purchase.status}</p>
                          <p className="mt-1 break-all font-mono text-xs text-slate-400">
                            {(purchase.numeros || []).length ? purchase.numeros.map((n: number) => String(n).padStart(6, "0")).join(", ") : "Sem cotas alocadas ainda"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-emerald-300" />
              <h2 className="text-xl font-display font-bold">Solicitações de saque</h2>
            </div>
            <div className="max-h-96 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {withdrawals.length === 0 && <p className="text-sm text-slate-400">Nenhum saque solicitado ainda.</p>}
              {withdrawals.map(withdrawal => (
                <div key={withdrawal.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-bold text-white">{withdrawal.customerName} • R$ {Number(withdrawal.amount || 0).toFixed(2)}</p>
                      <p className="text-xs font-mono text-slate-400">{withdrawal.customerPhone} • {withdrawal.refCode}</p>
                      <p className="mt-1 break-all text-xs font-mono text-emerald-300">PIX: {withdrawal.pixKey}</p>
                      <p className="mt-1 text-xs text-slate-500">Status: {withdrawal.status}</p>
                    </div>
                    {withdrawal.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => updateWithdrawalStatus(withdrawal.id, "paid")} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">
                          Pago
                        </button>
                        <button onClick={() => updateWithdrawalStatus(withdrawal.id, "rejected")} className="rounded-xl border border-rose-400/30 px-3 py-2 text-xs font-bold text-rose-200">
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-cyan-300" />
              <h2 className="text-xl font-display font-bold">Chat de suporte</h2>
            </div>
            <div className="max-h-96 space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {supportTickets.length === 0 && <p className="text-sm text-slate-400">Nenhum atendimento aberto.</p>}
              {supportTickets.map(ticket => (
                <div key={ticket.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3">
                    <p className="font-bold text-white">{ticket.customerName}</p>
                    <p className="text-xs font-mono text-slate-400">{ticket.customerPhone} • {ticket.status}</p>
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl bg-black/20 p-3 text-sm">
                    {ticket.messages.map((message: any) => (
                      <div key={message.id} className={cn("rounded-lg p-2", message.sender === "admin" ? "bg-cyan-400/10 text-cyan-100" : message.sender === "bot" ? "bg-white/5 text-slate-300" : "bg-emerald-400/10 text-emerald-100")}>
                        <p className="text-[10px] uppercase tracking-widest opacity-70">{message.sender}</p>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      value={supportReply[ticket.id] || ""}
                      onChange={e => setSupportReply(current => ({ ...current, [ticket.id]: e.target.value }))}
                      placeholder="Responder como atendente"
                      className="p-3 text-sm"
                    />
                    <button onClick={() => replySupport(ticket.id)} className="admin-button">Responder</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-emerald-300" />
              <h2 className="text-xl font-display font-bold">Afiliados, comissões e prêmios</h2>
            </div>
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[var(--admin-primary)]" />
                <h3 className="font-semibold text-[var(--admin-text)]">Cadastrar afiliado manualmente</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["name", "Nome"],
                  ["phone", "Telefone"],
                  ["cpf", "CPF"],
                  ["city", "Cidade"],
                  ["state", "UF"],
                  ["refCode", "Código afiliado"],
                  ["pixKey", "Chave PIX"],
                  ["accessPassword", "Senha 6 dígitos"]
                ].map(([field, label]) => (
                  <label key={field} className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[var(--admin-muted)]">{label}</span>
                    <input
                      value={(manualAffiliate as any)[field] || ""}
                      onChange={e => setManualAffiliate({ ...manualAffiliate, [field]: e.target.value })}
                      className="w-full p-3 text-sm"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={createManualAffiliate} className="admin-button">
                  <UserPlus className="h-4 w-4" /> Cadastrar afiliado
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input value={affiliateQuery} onChange={e => setAffiliateQuery(e.target.value)} placeholder="Buscar afiliado por CPF, telefone ou código" className="p-3" />
              <button onClick={searchAffiliate} className="admin-button">Buscar</button>
            </div>
            <div className="grid gap-3 md:grid-cols-[0.85fr_1.15fr]">
              <div className="max-h-72 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                {affiliateResults.map(item => (
                  <button key={item.affiliate.refCode} onClick={() => setSelectedAffiliate(item)} className={cn("w-full rounded-xl border p-3 text-left", selectedAffiliate?.affiliate?.refCode === item.affiliate.refCode ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/5 bg-white/[0.03]")}>
                    <p className="font-semibold text-white">{item.customer.name}</p>
                    <p className="text-xs font-mono text-slate-500">{item.customer.phone} • CPF {item.customer.cpf}</p>
                    <p className="text-xs font-mono text-emerald-300">{item.affiliate.refCode}</p>
                  </button>
                ))}
              </div>
              {selectedAffiliate && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {["name", "phone", "cpf", "city", "state"].map(field => (
                      <label key={field} className="space-y-1">
                        <span className="text-[10px] font-mono uppercase text-slate-500">{field}</span>
                        <input
                          value={selectedAffiliate.customer?.[field] || ""}
                          onChange={e => setSelectedAffiliate({
                            ...selectedAffiliate,
                            customer: { ...selectedAffiliate.customer, [field]: e.target.value }
                          })}
                          className="w-full p-3 text-sm"
                        />
                      </label>
                    ))}
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-[10px] font-mono uppercase text-slate-500">Chave PIX</span>
                      <input
                        value={selectedAffiliate.affiliate.pixKey || ""}
                        onChange={e => setSelectedAffiliate({
                          ...selectedAffiliate,
                          affiliate: { ...selectedAffiliate.affiliate, pixKey: e.target.value }
                        })}
                        className="w-full p-3 text-sm"
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MiniWallet label="Comissões" value={selectedAffiliate.affiliate.commissionBalance} />
                    <MiniWallet label="Prêmios" value={selectedAffiliate.affiliate.prizeBalance} />
                    <MiniWallet label="Total" value={selectedAffiliate.affiliate.commission} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500">Saldo comissões</span>
                      <input
                        type="number"
                        value={selectedAffiliate.affiliate.commissionBalance || 0}
                        onChange={e => {
                          const commissionBalance = Number(e.target.value);
                          const prizeBalance = Number(selectedAffiliate.affiliate.prizeBalance || 0);
                          setSelectedAffiliate({
                            ...selectedAffiliate,
                            affiliate: { ...selectedAffiliate.affiliate, commissionBalance, commission: commissionBalance + prizeBalance }
                          });
                        }}
                        className="w-full p-3 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-500">Saldo prêmios</span>
                      <input
                        type="number"
                        value={selectedAffiliate.affiliate.prizeBalance || 0}
                        onChange={e => {
                          const prizeBalance = Number(e.target.value);
                          const commissionBalance = Number(selectedAffiliate.affiliate.commissionBalance || 0);
                          setSelectedAffiliate({
                            ...selectedAffiliate,
                            affiliate: { ...selectedAffiliate.affiliate, prizeBalance, commission: commissionBalance + prizeBalance }
                          });
                        }}
                        className="w-full p-3 text-sm"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
                      <span className="text-sm text-white">Usar saldo para compras</span>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedAffiliate.affiliate.useBalanceForPurchases)}
                        onChange={e => setSelectedAffiliate({
                          ...selectedAffiliate,
                          affiliate: { ...selectedAffiliate.affiliate, useBalanceForPurchases: e.target.checked }
                        })}
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input type="number" min="0" value={walletForm.amount} onChange={e => setWalletForm({ ...walletForm, amount: e.target.value })} placeholder="Valor" className="p-3" />
                    <input value={walletForm.note} onChange={e => setWalletForm({ ...walletForm, note: e.target.value })} placeholder="Observação" className="p-3" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <WalletButton label="salvar ficha" onClick={saveAffiliateFull} />
                    <WalletButton label="+ comissão" onClick={() => updateAffiliateWallet("add_commission")} />
                    <WalletButton label="+ prêmio" onClick={() => updateAffiliateWallet("add_prize")} />
                    <WalletButton label="pagar comissão" onClick={() => updateAffiliateWallet("pay_commission")} />
                    <WalletButton label="pagar prêmio" onClick={() => updateAffiliateWallet("pay_prize")} />
                    <WalletButton label="zerar comissão" danger onClick={() => updateAffiliateWallet("zero_commission")} />
                    <WalletButton label="zerar prêmio" danger onClick={() => updateAffiliateWallet("zero_prize")} />
                    <WalletButton label="zerar tudo" danger onClick={() => updateAffiliateWallet("zero_all")} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
       </div>

       {editingCustomer && (
         <div className="admin-card border border-[var(--admin-primary)]/25 p-5 space-y-4">
           <h2 className="text-xl font-display font-bold">Editar ficha do cliente</h2>
           <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
             {["name", "phone", "cpf", "photoUrl", "city", "state"].map(field => (
               <label key={field} className="space-y-1">
                 <span className="text-[10px] font-mono uppercase text-slate-500">{field}</span>
                 <input value={editingCustomer[field] || ""} onChange={e => setEditingCustomer({ ...editingCustomer, [field]: e.target.value })} className="w-full p-3" />
               </label>
             ))}
             <label className="space-y-1">
               <span className="text-[10px] font-mono uppercase text-slate-500">Total cotas</span>
               <input type="number" value={editingCustomer.totalTickets || 0} disabled className="w-full p-3 opacity-60" />
             </label>
           </div>
           <div className="grid gap-4 xl:grid-cols-2">
             <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
               <h3 className="font-display text-lg font-bold text-white">Cotas de rifas editáveis</h3>
               <p className="mt-1 text-xs text-slate-500">Separe números por vírgula ou espaço. Ao salvar, o sistema remove ou acrescenta cotas nesta compra.</p>
               <div className="mt-4 space-y-3">
                 {(editingCustomer.purchases || []).length === 0 ? (
                   <p className="text-sm text-slate-500">Nenhuma compra tradicional encontrada.</p>
                 ) : editingCustomer.purchases.map((purchase: any, index: number) => (
                   <div key={purchase.purchaseId} className="rounded-xl border border-white/5 bg-black/20 p-3">
                     <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                       <p className="font-bold text-white">{purchase.raffleTitle || purchase.raffleId}</p>
                       <span className="text-[10px] font-mono uppercase text-slate-500">{purchase.purchaseId} • {purchase.status}</span>
                     </div>
                     <textarea
                       value={purchase.editableNumbers || ""}
                       onChange={e => {
                         const nextPurchases = [...(editingCustomer.purchases || [])];
                         nextPurchases[index] = { ...purchase, editableNumbers: e.target.value };
                         setEditingCustomer({ ...editingCustomer, purchases: nextPurchases });
                       }}
                       rows={3}
                       className="mt-3 w-full rounded-xl border border-white/10 bg-cyber-900/50 p-3 font-mono text-sm text-white"
                       placeholder="Ex: 12, 34, 777"
                     />
                   </div>
                 ))}
               </div>
             </div>
             <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
               <h3 className="font-display text-lg font-bold text-white">Outras modalidades</h3>
               <p className="mt-1 text-xs text-slate-500">Edite apenas para cotas disponíveis. Fazendinha usa IDs dos grupos: leao, vaca, aguia...</p>
               <div className="mt-4 space-y-3">
                 {(editingCustomer.fazendinhaPurchases || []).map((purchase: any, index: number) => (
                   <div key={purchase.id} className="rounded-xl border border-emerald-300/10 bg-emerald-300/5 p-3">
                     <p className="font-bold text-white">Fazendinha • {purchase.nomeBicho}</p>
                     <p className="font-mono text-xs text-slate-400">{purchase.numeros?.join(", ")} • {purchase.statusPagamento}</p>
                     <textarea
                       value={purchase.editableGroupIds || ""}
                       onChange={e => {
                         const next = [...(editingCustomer.fazendinhaPurchases || [])];
                         next[index] = { ...purchase, editableGroupIds: e.target.value };
                         setEditingCustomer({ ...editingCustomer, fazendinhaPurchases: next });
                       }}
                       rows={2}
                       className="mt-3 w-full rounded-xl border border-white/10 bg-cyber-900/50 p-3 font-mono text-sm text-white"
                       placeholder="Ex: leao, vaca"
                     />
                   </div>
                 ))}
                 {(editingCustomer.modalidadePurchases || []).map((purchase: any, index: number) => (
                   <div key={purchase.id} className="rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-3">
                     <p className="font-bold text-white">{purchase.mode}</p>
                     <p className="font-mono text-xs text-slate-400">{purchase.numbers?.join(", ")} • {purchase.status}</p>
                     <textarea
                       value={purchase.editableNumbers || ""}
                       onChange={e => {
                         const next = [...(editingCustomer.modalidadePurchases || [])];
                         next[index] = { ...purchase, editableNumbers: e.target.value };
                         setEditingCustomer({ ...editingCustomer, modalidadePurchases: next });
                       }}
                       rows={2}
                       className="mt-3 w-full rounded-xl border border-white/10 bg-cyber-900/50 p-3 font-mono text-sm text-white"
                       placeholder="Ex: 07, 25, 999"
                     />
                   </div>
                 ))}
                 {!(editingCustomer.fazendinhaPurchases || []).length && !(editingCustomer.modalidadePurchases || []).length && (
                   <p className="text-sm text-slate-500">Nenhuma compra em Fazendinha, Dezena, Centena ou Milhar.</p>
                 )}
               </div>
             </div>
           </div>
           <div className="flex justify-end gap-3">
             <button onClick={() => setEditingCustomer(null)} className="admin-button-secondary">Cancelar</button>
             <button onClick={saveCustomer} className="admin-button"><Save className="w-4 h-4" /> Salvar ficha</button>
           </div>
         </div>
       )}

       <div className="admin-card overflow-hidden">
          <div className="p-4 border-b border-[var(--admin-border)] flex gap-4">
            <div className="relative flex-1 max-w-sm">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-muted)]" />
               <input type="text" placeholder="Buscar por HASH ou telefone..." className="admin-input w-full rounded-xl py-2 pl-10 pr-4 text-sm" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse whitespace-nowrap">
               <thead>
                 <tr className="bg-white/[0.035] text-xs font-mono text-[var(--admin-muted)] tracking-wider">
                   <th className="font-semibold py-4 px-6 border-b border-white/5">HASH / ID</th>
                   <th className="font-semibold py-4 px-6 border-b border-white/5">CONTATO</th>
                   <th className="font-semibold py-4 px-6 border-b border-white/5 text-center">STATUS</th>
                   <th className="font-semibold py-4 px-6 border-b border-white/5">HISTÓRICO PIX</th>
                   <th className="font-semibold py-4 px-6 border-b border-white/5 text-right">VALOR</th>
                   <th className="font-semibold py-4 px-6 border-b border-white/5 text-right">COTAS</th>
                   <th className="font-semibold py-4 px-6 border-b border-white/5 text-right">AÇÕES</th>
                 </tr>
               </thead>
               <tbody className="font-mono text-sm">
                  {filteredPurchases.length === 0 ? (
                     <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">Nenhuma venda registrada até o momento.</td>
                     </tr>
                  ) : filteredPurchases.map((p, i) => (
                     <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-neon-cyan">{p.purchaseId}</td>
                        <td className="py-4 px-6 text-slate-300">{p.contact || "Anônimo"}</td>
                        <td className="py-4 px-6 text-center">
                          <span className={cn(
                            "text-[10px] px-3 py-1 font-bold rounded-sm tracking-widest uppercase",
                            p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                            p.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          )}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          <div className="space-y-1">
                            {(p.paymentHistory?.length ? p.paymentHistory : []).map((item: any, idx: number) => (
                              <div key={idx} className={cn("text-[10px] uppercase tracking-widest", item.status === "paid" ? "text-emerald-300" : "text-red-300")}>
                                {item.label}
                              </div>
                            ))}
                            {!p.paymentHistory?.length && <span className="text-[10px] text-slate-500 uppercase tracking-widest">Aguardando PIX</span>}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-white">R$ {p.amount.toFixed(2)}</td>
                        <td className="py-4 px-6 text-right text-slate-400">{p.tickets} cotas</td>
                        <td className="py-4 px-6 text-right">
                          {p.status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => updatePurchaseStatus(p.purchaseId, "approve")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-400/10">
                                <CheckCircle2 className="w-3 h-3" /> Aprovar
                              </button>
                              <button onClick={() => updatePurchaseStatus(p.purchaseId, "reject")} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10">
                                <XCircle className="w-3 h-3" /> Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Finalizada</span>
                          )}
                        </td>
                     </tr>
                  ))}
               </tbody>
             </table>
          </div>
       </div>
    </div>
  );
}

function MiniWallet({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-white">R$ {Number(value || 0).toFixed(2)}</p>
    </div>
  );
}

function LookupStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function WalletButton({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-[10px] font-mono uppercase tracking-widest",
        danger ? "border-red-400/30 text-red-200 hover:bg-red-400/10" : "border-emerald-400/30 text-emerald-200 hover:bg-emerald-400/10"
      )}
    >
      {label}
    </button>
  );
}
