import { useEffect, useState } from "react";
import { Headphones, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useCustomerStore } from "../store/useCustomerStore";
import type { SupportTicket } from "../types";

export function SupportChat() {
  const { customer } = useCustomerStore();
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [reply, setReply] = useState("");
  const activeTicket = tickets[0];

  useEffect(() => {
    if (!customer) return;
    setForm(current => ({
      ...current,
      name: customer.name || current.name,
      phone: customer.phone || current.phone,
    }));
    const loadTickets = () => {
      fetch(`/api/support/tickets?customerId=${customer.id}`)
        .then(res => res.ok ? res.json() : [])
        .then(setTickets)
        .catch(() => null);
    };
    loadTickets();
    if (!open) return;
    const interval = window.setInterval(loadTickets, 8000);
    return () => window.clearInterval(interval);
  }, [customer?.id, open]);

  const startTicket = async () => {
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer?.id,
        name: form.name,
        phone: form.phone,
        message: form.message,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao abrir atendimento");
      return;
    }
    setTickets(current => [data, ...current]);
    setForm(current => ({ ...current, message: "" }));
    toast.success("Atendimento aberto");
  };

  const sendReply = async () => {
    if (!activeTicket || !reply.trim()) return;
    const res = await fetch(`/api/support/tickets/${activeTicket.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(activeTicket.accessToken ? { "X-Support-Token": activeTicket.accessToken } : {})
      },
      body: JSON.stringify({ message: reply }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Erro ao enviar mensagem");
      return;
    }
    setTickets(current => current.map(ticket => ticket.id === data.id ? data : ticket));
    setReply("");
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-white/10 bg-[var(--theme-surface-strong)] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-sm font-bold text-[var(--theme-text)]">Suporte ao cliente</p>
              <p className="text-xs text-[var(--theme-muted)]">Fale com um atendente</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-[var(--theme-muted)] hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {activeTicket ? (
            <div className="space-y-3 p-4">
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {activeTicket.messages.map(message => (
                  <div
                    key={message.id}
                    className={`rounded-xl p-3 text-sm ${message.sender === "customer" ? "ml-8 bg-neon-cyan/15 text-[var(--theme-text)]" : "mr-8 bg-white/10 text-[var(--theme-text)]"}`}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--theme-muted)]">
                      {message.sender === "customer" ? "Você" : message.sender === "admin" ? "Atendente" : "Assistente"}
                    </p>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Digite sua mensagem" className="min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-[var(--theme-text)]" />
                <button onClick={sendReply} className="rounded-xl bg-neon-cyan px-4 text-slate-950">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {!customer && (
                <>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-[var(--theme-text)]" />
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp" className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-[var(--theme-text)]" />
                </>
              )}
              <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Como podemos ajudar?" className="min-h-28 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-[var(--theme-text)]" />
              <button onClick={startTicket} className="w-full rounded-xl bg-neon-cyan px-4 py-3 font-bold text-slate-950">
                Iniciar atendimento
              </button>
            </div>
          )}
        </div>
      )}
      <button onClick={() => setOpen(value => !value)} className="grid h-14 w-14 place-items-center rounded-full bg-neon-cyan text-slate-950 shadow-xl">
        <Headphones className="h-6 w-6" />
      </button>
    </div>
  );
}
