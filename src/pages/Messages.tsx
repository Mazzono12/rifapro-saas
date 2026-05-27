import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useCustomerStore } from "../store/useCustomerStore";
import { cn } from "../lib/utils";
import { MessageVideoPlayer } from "../components/MessageVideoPlayer";

export function Messages() {
  const { customer } = useCustomerStore();
  const [messages, setMessages] = useState<any[]>([]);
  const safeMessages = Array.isArray(messages) ? messages : [];

  const load = () => {
    if (!customer) return;
    fetch(`/api/customers/${customer.id}/messages`)
      .then(res => res.json())
      .then(data => setMessages(Array.isArray(data) ? data : data?.messages || []))
      .catch(() => setMessages([]));
  };

  useEffect(() => {
    load();
  }, [customer?.id]);

  const markRead = async (message: any) => {
    if (!customer || message.read) return;
    await fetch(`/api/customers/${customer.id}/messages/${message.id}/read`, { method: "POST" });
    setMessages(current => current.map(item => item.id === message.id ? { ...item, read: true } : item));
  };

  if (!customer) {
    return (
      <div className="container mx-auto max-w-xl px-4 pb-10 pt-6">
        <div className="glass-card p-8 text-center">
          <Bell className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <h1 className="font-display text-2xl font-bold text-white">Mensagens</h1>
          <p className="mt-2 text-slate-400">Faça uma compra ou entre com seu cadastro para receber avisos.</p>
          <Link to="/" className="neon-button mt-6 inline-flex rounded-xl px-6 py-3">Ir para início</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 pb-8 pt-4">
      <div className="mb-6">
        <p className="text-xs font-mono uppercase tracking-[0.25em] text-neon-cyan">Central do cliente</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-4xl font-black text-white">
          <Bell className="h-8 w-8 text-amber-300" /> Mensagens
        </h1>
      </div>

      <div className="space-y-4">
        {safeMessages.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-500">Nenhuma mensagem recebida.</div>
        ) : safeMessages.map(message => (
          <div key={message.id} className={cn("glass-card border p-5", message.read ? "border-white/5" : "border-amber-300/30 bg-amber-300/5")}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-500">
                  <Megaphone className="h-4 w-4 text-amber-300" /> {message.type === "promotion" ? "Promoção" : "Aviso"}
                </p>
                <h2 className="mt-2 font-display text-2xl font-black text-white">{message.title}</h2>
                {message.mediaUrl && (
                  <div className="mt-4 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    <MessageVideoPlayer mediaUrl={message.mediaUrl} mediaType={message.mediaType} config={message.videoConfig} className="h-full w-full" />
                  </div>
                )}
                <p className="mt-2 text-slate-300">{message.body}</p>
                <p className="mt-3 text-xs font-mono text-slate-500">{new Date(message.createdAt).toLocaleString("pt-BR")}</p>
              </div>
              {!message.read && (
                <button onClick={() => markRead(message)} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/10">
                  <CheckCheck className="mr-1 inline h-4 w-4" /> Marcar lida
                </button>
              )}
            </div>
            {message.ctaUrl && (
              <Link
                to={message.ctaUrl}
                onClick={() => {
                  markRead(message);
                  toast.success("Abrindo promoção");
                }}
                className="neon-button mt-5 inline-flex rounded-xl px-5 py-3"
              >
                {message.ctaLabel || "Abrir promoção"}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
