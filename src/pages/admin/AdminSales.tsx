import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Copy, Download, ExternalLink, FileJson, Users, Search, Save, TicketCheck, XCircle, Wallet, Trophy, UserPlus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import type { Raffle } from "../../types";

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeMoney(value: unknown) {
  return safeNumber(value).toFixed(2);
}

function affiliateStatusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "paid") return "Pago";
  if (value === "rejected") return "Recusado";
  if (value === "pending") return "Aguardando aprovação";
  if (value === "active") return "Ativo";
  if (value === "registered") return "Cadastrado";
  return "Em análise";
}

function eligibilityStatusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "active") return "Liberado neste mês";
  if (value === "pending") return "Aguardando meta mensal";
  return "Sem regra mensal";
}

function purchaseStatusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "paid") return "Pago";
  if (value === "pending") return "Reservado";
  if (value === "reserved") return "Reservado";
  if (value === "cancelled") return "Cancelado";
  if (value === "sold") return "Comprado";
  return "Em análise";
}

function modeLabel(mode: unknown) {
  const value = String(mode || "").toLowerCase();
  if (value === "dezena") return "Dezena";
  if (value === "centena") return "Centena";
  if (value === "milhar") return "Milhar";
  return "Modalidade";
}

function supportStatusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "open") return "Aberto";
  if (value === "answered") return "Respondido";
  if (value === "closed") return "Encerrado";
  return "Em atendimento";
}

const manualAffiliateFields = [
  ["name", "Nome completo", "Ex.: Maria Silva"],
  ["phone", "Telefone", "Ex.: (11) 99999-9999"],
  ["cpf", "CPF", "Somente números"],
  ["city", "Cidade", "Ex.: São Paulo"],
  ["state", "UF", "Ex.: SP"],
  ["refCode", "Código de indicação", "Ex.: MARIA10"],
  ["pixKey", "Chave PIX", "CPF, telefone, e-mail ou aleatória"],
  ["accessPassword", "Senha de acesso", "6 dígitos"]
] as const;

const editableAffiliateFields = [
  ["name", "Nome completo"],
  ["phone", "Telefone"],
  ["cpf", "CPF"],
  ["city", "Cidade"],
  ["state", "UF"]
] as const;

const editableCustomerFields = [
  ["name", "Nome do cliente"],
  ["phone", "WhatsApp / Telefone"],
  ["cpf", "CPF"],
  ["photoUrl", "Foto do cliente"],
  ["city", "Cidade"],
  ["state", "UF"]
] as const;

function normalizeAdminRaffle(raffle: Partial<Raffle> | null | undefined): Raffle | null {
  if (!raffle?.id) return null;
  return {
    ...raffle,
    id: String(raffle.id),
    title: safeText(raffle.title, "Campanha sem titulo"),
    description: safeText(raffle.description, ""),
    price: safeNumber(raffle.price),
    totalTickets: Math.max(1, Math.floor(safeNumber(raffle.totalTickets, 1))),
    soldTickets: Math.max(0, Math.floor(safeNumber(raffle.soldTickets))),
    image: safeText(raffle.image, ""),
    status: raffle.status || "active",
    drawDate: safeText(raffle.drawDate, "")
  } as Raffle;
}

function normalizePurchase(purchase: any) {
  const customer = purchase?.customer && typeof purchase.customer === "object" ? purchase.customer : {};
  return {
    ...purchase,
    purchaseId: String(purchase?.purchaseId || purchase?.id || ""),
    raffleId: String(purchase?.raffleId || ""),
    contact: safeText(purchase?.contact || customer.phone, ""),
    status: safeText(purchase?.status, "pending"),
    amount: safeNumber(purchase?.amount),
    tickets: Math.max(0, Math.floor(safeNumber(purchase?.tickets))),
    createdAt: safeText(purchase?.createdAt, ""),
    numeros: asArray<number>(purchase?.numeros),
    paymentHistory: asArray(purchase?.paymentHistory),
    customer: {
      ...customer,
      id: String(customer.id || ""),
      name: safeText(customer.name, ""),
      phone: safeText(customer.phone, ""),
      cpf: safeText(customer.cpf, ""),
      city: safeText(customer.city, ""),
      state: safeText(customer.state, "")
    }
  };
}

function normalizeCustomer(customer: any) {
  return {
    ...customer,
    id: String(customer?.id || ""),
    name: safeText(customer?.name, "Cliente"),
    phone: safeText(customer?.phone, ""),
    cpf: safeText(customer?.cpf, ""),
    city: safeText(customer?.city, ""),
    state: safeText(customer?.state, ""),
    totalTickets: Math.max(0, Math.floor(safeNumber(customer?.totalTickets))),
    affiliateRefCode: safeText(customer?.affiliateRefCode, ""),
    purchases: asArray(customer?.purchases).map(normalizePurchase),
    fazendinhaPurchases: asArray(customer?.fazendinhaPurchases),
    modalidadePurchases: asArray(customer?.modalidadePurchases),
    affiliate: customer?.affiliate && typeof customer.affiliate === "object" ? customer.affiliate : undefined
  };
}

function normalizeAffiliateResult(item: any) {
  const customer = normalizeCustomer(item?.customer || {});
  const affiliate = item?.affiliate && typeof item.affiliate === "object" ? item.affiliate : {};
  return {
    ...item,
    customer,
    affiliate: {
      ...affiliate,
      refCode: safeText(affiliate.refCode || customer.affiliateRefCode, ""),
      pixKey: safeText(affiliate.pixKey, ""),
      commissionBalance: safeNumber(affiliate.commissionBalance),
      prizeBalance: safeNumber(affiliate.prizeBalance),
      commission: safeNumber(affiliate.commission),
      useCustomCommission: Boolean(affiliate.useCustomCommission),
      customCommissionRate: safeNumber(affiliate.customCommissionRate),
      useBalanceForPurchases: Boolean(affiliate.useBalanceForPurchases),
      performanceRewardBalances: affiliate.performanceRewardBalances || {},
      performanceRewardConsumptions: asArray(affiliate.performanceRewardConsumptions)
    }
  };
}

function normalizeSupportTicket(ticket: any) {
  return {
    ...ticket,
    id: String(ticket?.id || ""),
    status: safeText(ticket?.status, "open"),
    customerName: safeText(ticket?.customerName, "Cliente"),
    customerPhone: safeText(ticket?.customerPhone, ""),
    messages: asArray(ticket?.messages)
  };
}

type PixRecoveryFilter = "all" | "pending" | "expired" | "24h" | "7d";

function normalizePixRecoveryOrder(item: any) {
  return {
    id: String(item?.id || ""),
    customerName: safeText(item?.customerName, "Cliente"),
    whatsapp: safeText(item?.whatsapp, ""),
    campaign: safeText(item?.campaign, "Campanha"),
    amount: safeNumber(item?.amount),
    status: safeText(item?.status, "pending"),
    statusLabel: safeText(item?.statusLabel, "Aguardando pagamento"),
    createdAt: safeText(item?.createdAt, ""),
    expiresAt: safeText(item?.expiresAt, ""),
    paymentLink: safeText(item?.paymentLink, ""),
    campaignLink: safeText(item?.campaignLink, ""),
    orderUrl: safeText(item?.orderUrl, ""),
    copyMessage: safeText(item?.copyMessage, "")
  };
}

async function readJsonArray<T = any>(url: string, normalize?: (item: any) => T): Promise<T[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("application/json")) return [];
    const payload = await response.json();
    const items = asArray(payload);
    return normalize ? items.map(normalize).filter(Boolean) as T[] : items as T[];
  } catch {
    return [];
  }
}

export function AdminSales() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [customerEditReason, setCustomerEditReason] = useState("");
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
  const [pixRecovery, setPixRecovery] = useState<any[]>([]);
  const [pixRecoveryFilter, setPixRecoveryFilter] = useState<PixRecoveryFilter>("all");

  const loadData = () => {
    void readJsonArray("/api/admin/purchases", normalizePurchase).then(setPurchases);
    void readJsonArray("/api/admin/recovery/pix-pending", normalizePixRecoveryOrder).then(setPixRecovery);
    void readJsonArray("/api/admin/customers", normalizeCustomer).then(setCustomers);
    void readJsonArray("/api/raffles", normalizeAdminRaffle).then(setRaffles);
    void readJsonArray("/api/admin/affiliates/withdrawals").then(setWithdrawals);
    void readJsonArray("/api/admin/support/tickets", normalizeSupportTicket).then(setSupportTickets);
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
      "clientes-ambiente-premium.csv",
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
    const phone = safeText(customer.phone);
    const cpf = safeText(customer.cpf);
    const text = `${customer.name || ""} ${phone} ${cpf} ${customer.city || ""} ${customer.state || ""}`.toLowerCase();
    return !customerQuery || text.includes(customerQuery.toLowerCase()) || phone.includes(query) || cpf.includes(query);
  });
  const filteredPurchases = purchases.filter(purchase => purchaseRaffleFilter === "all" || purchase.raffleId === purchaseRaffleFilter);
  const filteredPixRecovery = pixRecovery.filter(item => {
    const created = new Date(item.createdAt || "").getTime();
    const age = Number.isFinite(created) ? Date.now() - created : Number.POSITIVE_INFINITY;
    if (pixRecoveryFilter === "pending") return item.status === "pending";
    if (pixRecoveryFilter === "expired") return item.status === "expired";
    if (pixRecoveryFilter === "24h") return age <= 24 * 60 * 60 * 1000;
    if (pixRecoveryFilter === "7d") return age <= 7 * 24 * 60 * 60 * 1000;
    return true;
  });

  const copyRecoveryText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error("Não foi possível copiar agora");
    }
  };

  const openCustomerEditor = (customer: any) => {
    setEditingCustomer({
      ...customer,
      purchases: asArray(customer.purchases).map((purchase: any) => ({
        ...purchase,
        editableNumbers: purchase.editableNumbers ?? (purchase.numeros || []).join(", ")
      }))
    });
    setCustomerEditReason("");
  };

  const saveCustomer = async () => {
    if (!editingCustomer) return;
    if (customerEditReason.trim().length < 6) {
      toast.error("Informe um motivo para auditoria");
      return;
    }
    const res = await fetch(`/api/admin/customers/${editingCustomer.id}/full`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editingCustomer, reason: customerEditReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao salvar cliente");
      return;
    }
    toast.success("Cadastro atualizado pelo admin");
    setEditingCustomer(null);
    setCustomerEditReason("");
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
    setCustomerLookupResults(asArray(data).map(normalizeCustomer));
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
    const results = asArray(data).map(normalizeAffiliateResult);
    setAffiliateResults(results);
    setSelectedAffiliate(results[0] || null);
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
    const nextAffiliate = normalizeAffiliateResult({ customer: data.customer, affiliate: data.affiliate });
    setAffiliateResults([nextAffiliate, ...affiliateResults]);
    setSelectedAffiliate(nextAffiliate);
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
    const next = normalizeAffiliateResult({ ...selectedAffiliate, affiliate: data });
    setSelectedAffiliate(next);
    setAffiliateResults(results => results.map(item => item.affiliate?.refCode === data.refCode ? next : item));
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
    const normalized = normalizeAffiliateResult(data);
    setSelectedAffiliate(normalized);
    setAffiliateResults(results => results.map(item => item.affiliate?.refCode === normalized.affiliate.refCode ? normalized : item));
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
    const reason = action === "approve"
      ? window.prompt("Motivo da confirmação")
      : "Rejeitada pelo admin";
    if (action === "approve") {
      if (!reason?.trim()) {
        toast.error("Motivo da confirmação é obrigatório");
        return;
      }
      if (!window.confirm("Confirmar pagamento manualmente? Esta ação será auditada.")) return;
    }
    const path = action === "approve"
      ? `/api/admin/orders/${purchaseId}/manual-confirm-payment`
      : `/api/admin/purchases/${purchaseId}/reject`;
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao atualizar compra");
      return;
    }
    toast.success(action === "approve" ? "Pagamento confirmado manualmente" : "Pagamento PIX rejeitado");
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

  if (shouldUseSeparatedSalesLayout()) return (
    <div className="space-y-5">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--admin-muted)]">Operação</p>
            <h1 className="mt-1 flex items-center gap-3 text-2xl font-black text-[var(--admin-text)]">
              <Wallet className="h-7 w-7 text-[var(--admin-primary)]" /> Vendas
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Área enxuta para acessar consultas e serviços comerciais sem misturar rotinas operacionais.</p>
          </div>
          <Link to="/admin/central-pedidos" className="admin-button h-11 justify-center px-5">
            Abrir Central de Pedidos
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SalesServiceCard
          icon={<TicketCheck className="h-5 w-5" />}
          title="Pedidos e pagamentos"
          text="Consulte pedidos, cliente, pagamento, status e cotas em uma lista operacional compacta."
          to="/admin/central-pedidos"
        />
        <SalesServiceCard
          icon={<Clock className="h-5 w-5" />}
          title="Recuperação PIX"
          text="Acompanhe PIX pendente, expirado e rotinas de recuperação em uma página própria."
          to="/admin/pix-recuperacao"
        />
        <SalesServiceCard
          icon={<UserPlus className="h-5 w-5" />}
          title="Afiliados"
          text="Cadastros, códigos e gestão de afiliados ficam concentrados na área de crescimento."
          to="/admin/afiliados"
        />
        <SalesServiceCard
          icon={<Trophy className="h-5 w-5" />}
          title="Sorteios"
          text="Apuração, auditoria e publicação de resultado ficam fora da tela de vendas."
          to="/admin/sorteios"
        />
        <SalesServiceCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="Suporte"
          text="Atendimento, observações e histórico de contato ficam em atendimento."
          to="/admin/suporte"
        />
        <SalesServiceCard
          icon={<Download className="h-5 w-5" />}
          title="Relatórios"
          text="Exportações e análises ficam separadas para não poluir a operação diária."
          to="/admin/operacoes"
        />
      </div>
    </div>
  );

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

       <section className="admin-card min-w-0 p-5">
         <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
           <div className="min-w-0">
             <p className="text-xs font-black uppercase text-[var(--admin-primary)]">Recuperação de Vendas</p>
             <h2 className="mt-2 flex min-w-0 items-center gap-2 break-words text-xl font-black text-[var(--admin-text)]">
               <Clock className="h-5 w-5 shrink-0 text-[var(--admin-primary)]" /> PIX Pendentes
             </h2>
             <p className="mt-1 text-sm text-[var(--admin-muted)]">Clientes que iniciaram uma compra e ainda podem ser chamados manualmente.</p>
           </div>
           <div className="flex flex-wrap gap-2">
             {[
               ["all", "Todos"],
               ["pending", "Aguardando pagamento"],
               ["expired", "Vencidos"],
               ["24h", "Últimas 24h"],
               ["7d", "Últimos 7 dias"]
             ].map(([value, label]) => (
               <button
                 key={value}
                 type="button"
                 onClick={() => setPixRecoveryFilter(value as PixRecoveryFilter)}
                 className={cn(
                   "rounded-lg border px-3 py-2 text-xs font-bold transition",
                   pixRecoveryFilter === value ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]/15 text-[var(--admin-primary)]" : "border-[var(--admin-border)] text-[var(--admin-muted)] hover:bg-white/[0.04]"
                 )}
               >
                 {label}
               </button>
             ))}
           </div>
         </div>

         <div className="mt-5 grid min-w-0 gap-3 xl:grid-cols-2">
           {filteredPixRecovery.length === 0 ? (
             <div className="rounded-[8px] border border-[var(--admin-border)] bg-white/[0.03] p-4 text-sm text-[var(--admin-muted)] xl:col-span-2">
               Nenhum PIX pendente encontrado para este filtro.
             </div>
           ) : filteredPixRecovery.map(item => {
             const recoveryLink = item.paymentLink || item.campaignLink;
             const isExpired = item.status === "expired";
             return (
               <article key={item.id} className="min-w-0 rounded-[8px] border border-[var(--admin-border)] bg-white/[0.03] p-4">
                 <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                   <div className="min-w-0">
                     <p className="min-w-0 break-words text-sm font-black text-[var(--admin-text)]">{item.customerName}</p>
                     <p className="mt-1 min-w-0 break-words text-xs font-semibold text-[var(--admin-muted)]">{item.whatsapp || "WhatsApp não informado"}</p>
                   </div>
                   <span className={cn(
                     "shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                     isExpired ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-slate-200 bg-slate-100 text-slate-600"
                   )}>
                     {item.statusLabel}
                   </span>
                 </div>
                 <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                   <RecoveryField label="Campanha" value={item.campaign} />
                   <RecoveryField label="Valor" value={`R$ ${safeMoney(item.amount)}`} />
                   <RecoveryField label="Gerado em" value={formatDateTime(item.createdAt)} />
                   <RecoveryField label="Vencimento" value={item.expiresAt ? formatDateTime(item.expiresAt) : "Sem vencimento informado"} />
                 </div>
                 <div className="mt-4 flex flex-wrap gap-2">
                   <button
                     type="button"
                     onClick={() => copyRecoveryText(item.copyMessage, "Mensagem copiada")}
                     className="admin-button-secondary"
                   >
                     <Copy className="h-4 w-4" /> Copiar mensagem
                   </button>
                   {recoveryLink && (
                     <button
                       type="button"
                       onClick={() => copyRecoveryText(recoveryLink, isExpired ? "Link da campanha copiado" : "Link de pagamento copiado")}
                       className="admin-button-secondary"
                     >
                       <Copy className="h-4 w-4" /> {isExpired ? "Copiar link da campanha" : "Copiar link"}
                     </button>
                   )}
                   {item.orderUrl && (
                     <button
                       type="button"
                       onClick={() => window.open(item.orderUrl, "_blank", "noopener,noreferrer")}
                       className="admin-button-secondary"
                     >
                       <ExternalLink className="h-4 w-4" /> Abrir pedido
                     </button>
                   )}
                 </div>
               </article>
             );
           })}
         </div>
       </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="admin-card p-5 space-y-4 xl:col-span-2">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-slate-600" />
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
                <p className={cn("mt-2 text-sm font-bold", drawResult.status === "available" ? "text-emerald-300" : drawResult.status === "winner" ? "text-slate-600" : "text-cyan-300")}>
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
              <TicketCheck className="w-5 h-5 text-slate-700" />
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
                 <span className={ticketResult.status === "available" ? "text-emerald-300" : "text-slate-600"}>
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
                 <button onClick={() => assignTicket("pending")} className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600">Reservar</button>
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
             {filteredCustomers.length === 0 ? (
               <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.03] p-5 text-sm text-[var(--admin-muted)]">
                 Nenhum registro encontrado.
               </div>
             ) : filteredCustomers.map(customer => (
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
                      <p className="mt-1 text-xs text-cyan-300">Código de indicação: {customer.affiliate?.refCode || "não definido"} • Saldo total R$ {safeMoney(customer.affiliate?.commission)}</p>
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
                  {asArray(customer.purchases).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Cotas compradas em rifas</p>
                      {asArray(customer.purchases).map((purchase: any) => (
                        <div key={purchase.purchaseId} className="rounded-xl border border-white/5 bg-black/20 p-3">
                          <p className="text-sm font-bold text-white">{purchase.raffleTitle || "Campanha"} • Situação: {purchaseStatusLabel(purchase.status)}</p>
                          <p className="mt-1 break-all font-mono text-xs text-slate-400">
                            {asArray<number>(purchase.numeros).length ? asArray<number>(purchase.numeros).map((n: number) => String(n).padStart(6, "0")).join(", ") : "Sem cotas alocadas ainda"}
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
                      <p className="font-bold text-white">{withdrawal.customerName || "Cliente"} • R$ {safeMoney(withdrawal.amount)}</p>
                      <p className="text-xs text-slate-400">{withdrawal.customerPhone} • Código de indicação {withdrawal.refCode}</p>
                      <p className="mt-1 break-all text-xs text-emerald-300">Chave PIX: {withdrawal.pixKey}</p>
                      <p className="mt-1 text-xs text-slate-500">Situação: {affiliateStatusLabel(withdrawal.status)}</p>
                    </div>
                    {withdrawal.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => updateWithdrawalStatus(withdrawal.id, "paid")} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">
                          Marcar como pago
                        </button>
                        <button onClick={() => updateWithdrawalStatus(withdrawal.id, "rejected")} className="rounded-xl border border-rose-400/30 px-3 py-2 text-xs font-bold text-rose-200">
                          Recusar saque
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
                    <p className="text-xs text-slate-400">{ticket.customerPhone} • Situação: {supportStatusLabel(ticket.status)}</p>
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl bg-black/20 p-3 text-sm">
                    {asArray(ticket.messages).map((message: any) => (
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
              <h2 className="text-xl font-display font-bold">Programa de afiliados</h2>
            </div>
            <p className="text-sm leading-6 text-slate-400">
              Cadastre afiliados, ajuste bônus e acompanhe saques em linguagem operacional. Campos internos ficam restritos ao sistema.
            </p>
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[var(--admin-primary)]" />
                <h3 className="font-semibold text-[var(--admin-text)]">Cadastrar afiliado manualmente</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {manualAffiliateFields.map(([field, label, placeholder]) => (
                  <label key={field} className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--admin-muted)]">{label}</span>
                    <input
                      value={(manualAffiliate as any)[field] || ""}
                      onChange={e => setManualAffiliate({ ...manualAffiliate, [field]: e.target.value })}
                      placeholder={placeholder}
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
              <input value={affiliateQuery} onChange={e => setAffiliateQuery(e.target.value)} placeholder="Buscar por nome, telefone, CPF ou código de indicação" className="p-3" />
              <button onClick={searchAffiliate} className="admin-button">Buscar</button>
            </div>
            <div className="grid gap-3 md:grid-cols-[0.85fr_1.15fr]">
              <div className="max-h-72 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                {affiliateResults.map((item, index) => (
                  <button key={item.affiliate?.refCode || item.customer?.id || index} onClick={() => setSelectedAffiliate(normalizeAffiliateResult(item))} className={cn("w-full rounded-xl border p-3 text-left", selectedAffiliate?.affiliate?.refCode === item.affiliate?.refCode ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/5 bg-white/[0.03]")}>
                    <p className="font-semibold text-white">{item.customer?.name || "Cliente"}</p>
                    <p className="text-xs text-slate-500">{item.customer?.phone || "sem telefone"} • CPF {item.customer?.cpf || "não informado"}</p>
                    <p className="text-xs text-emerald-300">Código de indicação: {item.affiliate?.refCode || "não definido"}</p>
                    <p className="text-xs text-slate-400">{item.affiliate?.useCustomCommission ? "Usa comissão especial" : "Usa comissão padrão"}</p>
                  </button>
                ))}
              </div>
              {selectedAffiliate && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {editableAffiliateFields.map(([field, label]) => (
                      <label key={field} className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
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
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chave PIX para saque</span>
                      <input
                        value={selectedAffiliate.affiliate?.pixKey || ""}
                        onChange={e => setSelectedAffiliate({
                          ...selectedAffiliate,
                          affiliate: { ...selectedAffiliate.affiliate, pixKey: e.target.value }
                        })}
                        className="w-full p-3 text-sm"
                      />
                    </label>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">
                            {selectedAffiliate.affiliate?.useCustomCommission ? "Usa comissão especial" : "Usa comissão padrão"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">Essa alteração vale apenas para novas vendas indicadas. Se comissão especial estiver vazia, usa a comissão padrão.</p>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedAffiliate.affiliate?.useCustomCommission)}
                            onChange={e => setSelectedAffiliate({
                              ...selectedAffiliate,
                              affiliate: { ...selectedAffiliate.affiliate, useCustomCommission: e.target.checked }
                            })}
                          />
                          Comissão especial ativa
                        </label>
                      </div>
                      <label className="mt-3 block space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Comissão especial (%)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          disabled={!selectedAffiliate.affiliate?.useCustomCommission}
                          value={selectedAffiliate.affiliate?.customCommissionRate || 0}
                          onChange={e => setSelectedAffiliate({
                            ...selectedAffiliate,
                            affiliate: { ...selectedAffiliate.affiliate, customCommissionRate: Math.min(100, Math.max(0, Number(e.target.value))) }
                          })}
                          className="w-full p-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MiniWallet label="Comissões liberadas" value={selectedAffiliate.affiliate?.commissionBalance} />
                    <MiniWallet label="Prêmios disponíveis" value={selectedAffiliate.affiliate?.prizeBalance} />
                    <MiniWallet label="Saldo total" value={selectedAffiliate.affiliate?.commission} />
                  </div>
                  {selectedAffiliate.affiliate?.eligibility && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-bold text-white">
                          {selectedAffiliate.affiliate.eligibility.isEligibleThisMonth ? "Ativo para comissões" : "Pendente de ativação mensal"}
                        </p>
                        <p className="text-xs text-slate-400">{eligibilityStatusLabel(selectedAffiliate.affiliate.eligibility.eligibilityStatus)}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                        <MiniWallet label="Meta mensal" value={selectedAffiliate.affiliate.eligibility.monthlyRequiredAmount} />
                        <MiniWallet label="Comprado mês" value={selectedAffiliate.affiliate.eligibility.monthlyPurchasedAmount} />
                        <MiniWallet label="Falta para liberar" value={selectedAffiliate.affiliate.eligibility.remainingAmount} />
                        <MiniWallet label="Comissão bloqueada" value={selectedAffiliate.affiliate.eligibility.blockedCommissionAmount} />
                      </div>
                    </div>
                  )}
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-bold text-white">Recompensas do afiliado</p>
                      <p className="text-xs text-slate-400">Somente leitura</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <MiniCount label="Raspadinhas" value={selectedAffiliate.affiliate?.performanceRewardBalances?.scratchcard} />
                      <MiniCount label="Roletas" value={selectedAffiliate.affiliate?.performanceRewardBalances?.wheel_spin} />
                      <MiniCount label="Super Cotas" value={selectedAffiliate.affiliate?.performanceRewardBalances?.super_quota} />
                      <MiniCount label="Números bônus" value={selectedAffiliate.affiliate?.performanceRewardBalances?.bonus_number} />
                    </div>
                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {asArray(selectedAffiliate.affiliate?.performanceRewardConsumptions).slice(0, 8).map((item: any) => (
                        <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-xs font-bold text-white">{item.result?.label || "Recompensa utilizada"}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(item.createdAt)} • {item.result?.message || "Uso registrado"}</p>
                        </div>
                      ))}
                      {!asArray(selectedAffiliate.affiliate?.performanceRewardConsumptions).length && (
                        <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-500">Nenhum consumo registrado.</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Comissões liberadas</span>
                      <input
                        type="number"
                        value={selectedAffiliate.affiliate?.commissionBalance || 0}
                        onChange={e => {
                          const commissionBalance = Number(e.target.value);
                          const prizeBalance = safeNumber(selectedAffiliate.affiliate?.prizeBalance);
                          setSelectedAffiliate({
                            ...selectedAffiliate,
                            affiliate: { ...selectedAffiliate.affiliate, commissionBalance, commission: commissionBalance + prizeBalance }
                          });
                        }}
                        className="w-full p-3 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Prêmios disponíveis</span>
                      <input
                        type="number"
                        value={selectedAffiliate.affiliate?.prizeBalance || 0}
                        onChange={e => {
                          const prizeBalance = Number(e.target.value);
                          const commissionBalance = safeNumber(selectedAffiliate.affiliate?.commissionBalance);
                          setSelectedAffiliate({
                            ...selectedAffiliate,
                            affiliate: { ...selectedAffiliate.affiliate, prizeBalance, commission: commissionBalance + prizeBalance }
                          });
                        }}
                        className="w-full p-3 text-sm"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
                      <span className="text-sm text-white">Permitir compra com saldo disponível</span>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedAffiliate.affiliate?.useBalanceForPurchases)}
                        onChange={e => setSelectedAffiliate({
                          ...selectedAffiliate,
                          affiliate: { ...selectedAffiliate.affiliate, useBalanceForPurchases: e.target.checked }
                        })}
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input type="number" min="0" value={walletForm.amount} onChange={e => setWalletForm({ ...walletForm, amount: e.target.value })} placeholder="Valor do ajuste" className="p-3" />
                    <input value={walletForm.note} onChange={e => setWalletForm({ ...walletForm, note: e.target.value })} placeholder="Motivo do ajuste" className="p-3" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <WalletButton label="Salvar afiliado" onClick={saveAffiliateFull} />
                    <WalletButton label="Adicionar comissão" onClick={() => updateAffiliateWallet("add_commission")} />
                    <WalletButton label="Adicionar prêmio" onClick={() => updateAffiliateWallet("add_prize")} />
                    <WalletButton label="Registrar comissão paga" onClick={() => updateAffiliateWallet("pay_commission")} />
                    <WalletButton label="Registrar prêmio pago" onClick={() => updateAffiliateWallet("pay_prize")} />
                    <WalletButton label="Zerar comissões" danger onClick={() => updateAffiliateWallet("zero_commission")} />
                    <WalletButton label="Zerar prêmios" danger onClick={() => updateAffiliateWallet("zero_prize")} />
                    <WalletButton label="Zerar saldo total" danger onClick={() => updateAffiliateWallet("zero_all")} />
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
             {editableCustomerFields.map(([field, label]) => (
               <label key={field} className="space-y-1">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                 <input value={editingCustomer[field] || ""} onChange={e => setEditingCustomer({ ...editingCustomer, [field]: e.target.value })} className="w-full p-3" />
               </label>
             ))}
             <label className="space-y-1">
               <span className="text-[10px] font-mono uppercase text-slate-500">Total cotas</span>
               <input type="number" value={editingCustomer.totalTickets || 0} disabled className="w-full p-3 opacity-60" />
             </label>
           </div>
           <label className="block space-y-2 rounded-2xl border border-slate-200 bg-slate-100 p-4">
             <span className="text-xs font-bold uppercase text-slate-600">Motivo obrigatório para auditoria</span>
             <textarea
               value={customerEditReason}
               onChange={event => setCustomerEditReason(event.target.value)}
               className="min-h-20 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white"
               placeholder="Descreva por que dados, pedidos ou cotas foram alterados."
             />
           </label>
           <div className="grid gap-4 xl:grid-cols-2">
             <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
               <h3 className="font-display text-lg font-bold text-white">Cotas de rifas editáveis</h3>
               <p className="mt-1 text-xs text-slate-500">Separe números por vírgula ou espaço. Ao salvar, a operação atualiza as cotas desta compra.</p>
               <div className="mt-4 space-y-3">
                 {asArray(editingCustomer.purchases).length === 0 ? (
                   <p className="text-sm text-slate-500">Nenhuma compra tradicional encontrada.</p>
                 ) : asArray(editingCustomer.purchases).map((purchase: any, index: number) => (
                   <div key={purchase.purchaseId} className="rounded-xl border border-white/5 bg-black/20 p-3">
                     <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                       <div>
                         <p className="font-bold text-white">{purchase.raffleTitle || "Campanha"}</p>
                         <p className="mt-1 text-xs text-slate-500">Pedido / Compra</p>
                       </div>
                       <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                         Situação: {purchaseStatusLabel(purchase.status)}
                       </span>
                     </div>
                     <textarea
                       value={purchase.editableNumbers || ""}
                       onChange={e => {
                         const nextPurchases = [...asArray(editingCustomer.purchases)];
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
               <p className="mt-1 text-xs text-slate-500">Edite apenas cotas disponíveis. Informe os grupos da compra por nome, separados por vírgula.</p>
               <div className="mt-4 space-y-3">
                 {asArray(editingCustomer.fazendinhaPurchases).map((purchase: any, index: number) => (
                   <div key={purchase.id} className="rounded-xl border border-emerald-300/10 bg-emerald-300/5 p-3">
                     <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                       <p className="font-bold text-white">Fazendinha • {purchase.nomeBicho || "Grupo da compra"}</p>
                       <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                         Situação: {purchaseStatusLabel(purchase.statusPagamento)}
                       </span>
                     </div>
                     <p className="mt-2 text-xs text-slate-400">Números da compra: {purchase.numeros?.join(", ") || "não informado"}</p>
                     <textarea
                       value={purchase.editableGroupIds || ""}
                       onChange={e => {
                         const next = [...asArray(editingCustomer.fazendinhaPurchases)];
                         next[index] = { ...purchase, editableGroupIds: e.target.value };
                         setEditingCustomer({ ...editingCustomer, fazendinhaPurchases: next });
                       }}
                       rows={2}
                       className="mt-3 w-full rounded-xl border border-white/10 bg-cyber-900/50 p-3 font-mono text-sm text-white"
                       placeholder="Grupos da compra. Ex.: Leão, Vaca"
                     />
                   </div>
                 ))}
                 {asArray(editingCustomer.modalidadePurchases).map((purchase: any, index: number) => (
                   <div key={purchase.id} className="rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-3">
                     <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                       <p className="font-bold text-white">{modeLabel(purchase.mode)}</p>
                       <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                         Situação: {purchaseStatusLabel(purchase.status)}
                       </span>
                     </div>
                     <p className="mt-2 text-xs text-slate-400">Números da compra: {purchase.numbers?.join(", ") || "não informado"}</p>
                     <textarea
                       value={purchase.editableNumbers || ""}
                       onChange={e => {
                         const next = [...asArray(editingCustomer.modalidadePurchases)];
                         next[index] = { ...purchase, editableNumbers: e.target.value };
                         setEditingCustomer({ ...editingCustomer, modalidadePurchases: next });
                       }}
                       rows={2}
                       className="mt-3 w-full rounded-xl border border-white/10 bg-cyber-900/50 p-3 font-mono text-sm text-white"
                       placeholder="Ex: 07, 25, 999"
                     />
                   </div>
                 ))}
                 {!asArray(editingCustomer.fazendinhaPurchases).length && !asArray(editingCustomer.modalidadePurchases).length && (
                   <p className="text-sm text-slate-500">Nenhuma compra em Fazendinha, Dezena, Centena ou Milhar.</p>
                 )}
               </div>
             </div>
           </div>
           <div className="flex justify-end gap-3">
             <button onClick={() => { setEditingCustomer(null); setCustomerEditReason(""); }} className="admin-button-secondary">Cancelar</button>
             <button onClick={saveCustomer} className="admin-button"><Save className="w-4 h-4" /> Salvar ficha</button>
           </div>
         </div>
       )}

       <div className="admin-card overflow-hidden">
          <div className="p-4 border-b border-[var(--admin-border)] flex gap-4">
            <div className="relative flex-1 max-w-sm">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-muted)]" />
               <input type="text" placeholder="Buscar por venda ou telefone..." className="admin-input w-full rounded-xl py-2 pl-10 pr-4 text-sm" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse whitespace-nowrap">
               <thead>
                 <tr className="bg-white/[0.035] text-xs font-mono text-[var(--admin-muted)] tracking-wider">
                   <th className="font-semibold py-4 px-6 border-b border-white/5">VENDA</th>
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
                        <td className="py-4 px-6 text-slate-700">Venda {i + 1}</td>
                        <td className="py-4 px-6 text-slate-300">{p.contact || "Anônimo"}</td>
                        <td className="py-4 px-6 text-center">
                          <span className={cn(
                            "text-[10px] px-3 py-1 font-bold rounded-sm tracking-widest uppercase",
                            p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                            p.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-slate-1000/10 text-slate-600 border border-slate-2000/20'
                          )}>
                            {purchaseStatusLabel(p.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          <div className="space-y-1">
                            {asArray(p.paymentHistory).map((item: any, idx: number) => (
                              <div key={idx} className={cn("text-[10px] uppercase tracking-widest", item.status === "paid" ? "text-emerald-300" : "text-red-300")}>
                                {item.label}
                              </div>
                            ))}
                            {!asArray(p.paymentHistory).length && <span className="text-[10px] text-slate-500 uppercase tracking-widest">Aguardando PIX</span>}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-white">R$ {safeMoney(p.amount)}</td>
                        <td className="py-4 px-6 text-right text-slate-400">{safeNumber(p.tickets)} cotas</td>
                        <td className="py-4 px-6 text-right">
                          {p.status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => updatePurchaseStatus(p.purchaseId, "approve")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-400/10" title="Esta ação será auditada">
                                <CheckCircle2 className="w-3 h-3" /> Confirmar pagamento manualmente
                              </button>
                              <button onClick={() => updatePurchaseStatus(p.purchaseId, "reject")} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10">
                                <XCircle className="w-3 h-3" /> Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">{p.status === "paid" ? "Pagamento já confirmado" : "Finalizada"}</span>
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

function MiniWallet({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-white">R$ {safeMoney(value)}</p>
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-white">{Math.max(0, Math.floor(safeNumber(value)))}</p>
    </div>
  );
}

function RecoveryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 min-w-0 break-words text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function SalesServiceCard({ icon, title, text, to }: { icon: ReactNode; title: string; text: string; to: string }) {
  return (
    <article className="admin-card p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--admin-primary)] text-black">{icon}</span>
      <h2 className="mt-4 text-lg font-black text-[var(--admin-text)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{text}</p>
      <Link to={to} className="admin-button-secondary mt-4 h-10 justify-center">
        Abrir
      </Link>
    </article>
  );
}

function shouldUseSeparatedSalesLayout() {
  return true;
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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

