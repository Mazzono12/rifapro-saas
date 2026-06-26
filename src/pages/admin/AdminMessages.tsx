import { useEffect, useState, type FormEvent } from "react";
import { Send, Megaphone, Info } from "lucide-react";
import { toast } from "sonner";
import type { Raffle } from "../../types";
import { MediaPicker } from "../../components/admin/MediaPicker";
import { MessageVideoPlayer } from "../../components/MessageVideoPlayer";

const defaultVideoConfig = {
  enabled: true,
  autoplay: true,
  allowPause: true,
  allowMute: true,
  allowRewind: true,
  startMuted: true,
  tapToUnmute: true,
  unmuteOnViewMotion: false,
  pauseAudioOnScroll: true,
  initialVolume: 40,
  showControls: true,
};

export function AdminMessages() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "promotion",
    raffleId: "",
    mediaUrl: "",
    mediaType: "image",
    videoConfig: defaultVideoConfig,
    ctaLabel: "Comprar cotas",
    ctaUrl: ""
  });

  const load = () => {
    fetch("/api/admin/raffles").then(res => res.json()).then(setRaffles).catch(() => null);
    fetch("/api/admin/messages").then(res => res.json()).then(setMessages).catch(() => null);
  };

  useEffect(() => {
    load();
  }, []);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar mensagem");
      toast.success("Mensagem enviada para os clientes");
      setForm({ title: "", body: "", type: "promotion", raffleId: "", mediaUrl: "", mediaType: "image", videoConfig: defaultVideoConfig, ctaLabel: "Comprar cotas", ctaUrl: "" });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const updateVideoConfig = (patch: Partial<typeof defaultVideoConfig>) => {
    setForm(current => ({
      ...current,
      videoConfig: {
        ...current.videoConfig,
        ...patch,
      }
    }));
  };

  const chooseRaffle = (raffleId: string) => {
    setForm(current => ({
      ...current,
      raffleId,
      ctaUrl: raffleId ? `/raffle/${raffleId}` : "",
      ctaLabel: raffleId ? "Comprar cotas" : current.ctaLabel
    }));
  };

  return (
    <div className="space-y-6 fade-in">
      <div>
        <p className="text-sm text-[var(--admin-muted)]">Envie promoções, avisos de sorteio e chamadas com botão direto para compra.</p>
      </div>

      <form onSubmit={sendMessage} className="glass-card grid gap-5 border border-white/5 p-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-400">Tipo</span>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full p-3">
                <option value="promotion">Promoção</option>
                <option value="notice">Aviso</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-400">Ação / Sorteio da promoção</span>
              <select value={form.raffleId} onChange={e => chooseRaffle(e.target.value)} className="w-full p-3">
                <option value="">Mensagem informativa</option>
                {raffles.map(raffle => <option key={raffle.id} value={raffle.id}>{raffle.title}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-mono uppercase text-slate-400">Título</span>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Promoção relâmpago hoje" className="w-full p-3" />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-mono uppercase text-slate-400">Mensagem</span>
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Escreva o aviso que aparecerá para todos os clientes..." className="min-h-36 w-full p-3" />
          </label>
          <MediaPicker
            label="Mídia opcional da mensagem"
            value={form.mediaUrl}
            mediaType={form.mediaType}
            onChange={(mediaUrl, mediaType) => setForm({ ...form, mediaUrl, mediaType })}
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Mini painel de vídeo</p>
                <p className="mt-1 text-xs text-slate-500">Controle a experiência do cliente no estilo Vimeo.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={form.videoConfig.enabled} onChange={e => updateVideoConfig({ enabled: e.target.checked })} />
                Enviar vídeo
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <VideoToggle label="Play automático" checked={form.videoConfig.autoplay} onChange={value => updateVideoConfig({ autoplay: value })} />
              <VideoToggle label="Cliente pode pausar/dar play" checked={form.videoConfig.allowPause} onChange={value => updateVideoConfig({ allowPause: value })} />
              <VideoToggle label="Cliente pode mutar/desmutar" checked={form.videoConfig.allowMute} onChange={value => updateVideoConfig({ allowMute: value })} />
              <VideoToggle label="Cliente pode voltar 10s" checked={form.videoConfig.allowRewind} onChange={value => updateVideoConfig({ allowRewind: value })} />
              <VideoToggle label="Começar mudo" checked={form.videoConfig.startMuted} onChange={value => updateVideoConfig({ startMuted: value })} />
              <VideoToggle label="Toque na tela ativa áudio" checked={form.videoConfig.tapToUnmute} onChange={value => updateVideoConfig({ tapToUnmute: value })} />
              <VideoToggle label="Ao entrar na tela dá voz" checked={form.videoConfig.unmuteOnViewMotion} onChange={value => updateVideoConfig({ unmuteOnViewMotion: value })} />
              <VideoToggle label="Ao rolar a tela, áudio para" checked={form.videoConfig.pauseAudioOnScroll} onChange={value => updateVideoConfig({ pauseAudioOnScroll: value })} />
              <VideoToggle label="Mostrar controles no vídeo" checked={form.videoConfig.showControls} onChange={value => updateVideoConfig({ showControls: value })} />
              <label className="rounded-xl border border-white/5 bg-black/20 p-3">
                <span className="text-xs text-slate-300">Volume inicial: {form.videoConfig.initialVolume}%</span>
                <input type="range" min="0" max="100" value={form.videoConfig.initialVolume} onChange={e => updateVideoConfig({ initialVolume: Number(e.target.value) })} className="mt-3 w-full" />
              </label>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={form.ctaLabel} onChange={e => setForm({ ...form, ctaLabel: e.target.value })} placeholder="Texto do botão" className="p-3" />
            <input value={form.ctaUrl} onChange={e => setForm({ ...form, ctaUrl: e.target.value })} placeholder="/raffle/1" className="p-3" />
          </div>
          <button disabled={sending} className="admin-action-button inline-flex rounded-xl px-6 py-3 disabled:opacity-50">
            <Send className="mr-2 h-4 w-4" /> {sending ? "Enviando..." : "Enviar para todos os clientes"}
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Prévia da notificação</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-100 p-5">
            {form.type === "promotion" ? <Megaphone className="mb-3 h-6 w-6 text-slate-600" /> : <Info className="mb-3 h-6 w-6 text-cyan-300" />}
            {form.mediaUrl && (
              <div className="mb-4 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <MessageVideoPlayer mediaUrl={form.mediaUrl} mediaType={form.mediaType as any} config={form.videoConfig} className="h-full w-full" />
              </div>
            )}
            <h2 className="font-display text-2xl font-black text-white">{form.title || "Título da mensagem"}</h2>
            <p className="mt-2 text-sm text-slate-300">{form.body || "O cliente verá o texto completo da mensagem aqui."}</p>
            {(form.ctaUrl || form.raffleId) && (
              <span className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-black">
                {form.ctaLabel || "Abrir"}
              </span>
            )}
          </div>
        </div>
      </form>

      <div className="glass-card border border-white/5 p-6">
        <h2 className="font-display text-xl font-bold text-white">Histórico de envios</h2>
        <div className="mt-4 space-y-3">
          {messages.length === 0 ? <p className="text-sm text-slate-500">Nenhuma mensagem enviada.</p> : messages.map(message => (
            <div key={message.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-bold text-white">{message.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{message.body}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-mono uppercase text-slate-400">
                  {message.readCount}/{message.deliveredTo} lidas
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-slate-300">
      {label}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}

