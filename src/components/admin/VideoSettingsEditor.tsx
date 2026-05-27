export const defaultVideoConfig = {
  enabled: true,
  autoplay: true,
  allowPause: true,
  allowMute: true,
  allowRewind: true,
  startMuted: false,
  tapToUnmute: false,
  tapToTogglePlay: true,
  unmuteOnViewMotion: false,
  pauseAudioOnScroll: false,
  focusModeEnabled: true,
  autoFocusOnAutoplay: true,
  hideHeaderOnPlay: true,
  hideHeroInfoOnPlay: true,
  refocusOnTopDelaySeconds: 3,
  autoplayCardsOnView: true,
  cardsAutoplayThreshold: 55,
  initialVolume: 40,
  showControls: false,
  labels: {
    play: "Play",
    pause: "Pause",
    mute: "Mutar",
    unmute: "Ouvir",
    rewind: "Voltar 10s",
    tapToUnmute: "Toque para ouvir",
    volume: "Volume"
  }
};

export type AdminVideoConfig = typeof defaultVideoConfig;

export function mergeVideoConfig(config?: Partial<AdminVideoConfig>) {
  return {
    ...defaultVideoConfig,
    ...(config || {}),
    initialVolume: Math.min(100, Math.max(0, Number(config?.initialVolume ?? defaultVideoConfig.initialVolume))),
    refocusOnTopDelaySeconds: Math.min(30, Math.max(0, Number(config?.refocusOnTopDelaySeconds ?? defaultVideoConfig.refocusOnTopDelaySeconds))),
    cardsAutoplayThreshold: Math.min(100, Math.max(10, Number(config?.cardsAutoplayThreshold ?? defaultVideoConfig.cardsAutoplayThreshold))),
    labels: {
      ...defaultVideoConfig.labels,
      ...(config?.labels || {})
    }
  };
}

export function VideoSettingsEditor({
  config,
  onChange,
  onLabelChange,
  lockHiddenControls = false
}: {
  config: AdminVideoConfig;
  onChange: (patch: Record<string, any>) => void;
  onLabelChange: (field: string, value: string) => void;
  lockHiddenControls?: boolean;
}) {
  const toggles = ([
    ["enabled", "Player ativo"],
    ["autoplay", "Play automático"],
    ["allowPause", "Cliente pode pausar/dar play"],
    ["allowMute", "Cliente pode mutar/desmutar"],
    ["allowRewind", "Cliente pode voltar 10s"],
    ["startMuted", "Começar mudo"],
    ["tapToUnmute", "Toque ativa áudio"],
    ["tapToTogglePlay", "Toque no vídeo pausa/play"],
    ["unmuteOnViewMotion", "Ao entrar na tela dá voz"],
    ["pauseAudioOnScroll", "Ao rolar, áudio para"],
    ["focusModeEnabled", "Modo foco do vídeo principal"],
    ["autoFocusOnAutoplay", "Ocultar cabeçalho no play automático"],
    ["hideHeaderOnPlay", "Sumir cabeçalho durante reprodução"],
    ["hideHeroInfoOnPlay", "Sumir textos sobre o vídeo"],
    ["autoplayCardsOnView", "Play automático dos outros sorteios ao aparecer"],
    ["showControls", "Mostrar controles"]
  ] as const).filter(([field]) => !lockHiddenControls || !["showControls", "tapToUnmute"].includes(field));

  const labelFields = [
    ["play", "Nome botão play"],
    ["pause", "Nome botão pause"],
    ["mute", "Nome botão mutar"],
    ["unmute", "Nome botão ouvir"],
    ["rewind", "Nome botão voltar"],
    ["tapToUnmute", "Texto toque para ouvir"],
    ["volume", "Texto volume"]
  ] as const;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {toggles.map(([field, label]) => (
          <label key={field} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs font-mono text-slate-300">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={Boolean((config as any)[field])}
              onChange={e => onChange({ [field]: e.target.checked })}
            />
          </label>
        ))}
      </div>
      <label className="block rounded-xl border border-white/5 bg-black/20 p-3">
        <span className="text-xs text-slate-300">Volume inicial: {config.initialVolume}%</span>
        <input
          type="range"
          min="0"
          max="100"
          value={config.initialVolume}
          onChange={e => onChange({ initialVolume: Number(e.target.value) })}
          className="mt-3 w-full"
        />
      </label>
      <label className="block rounded-xl border border-white/5 bg-black/20 p-3">
        <span className="text-xs text-slate-300">Reativar modo foco no topo após: {config.refocusOnTopDelaySeconds}s</span>
        <input
          type="range"
          min="0"
          max="30"
          value={config.refocusOnTopDelaySeconds}
          onChange={e => onChange({ refocusOnTopDelaySeconds: Number(e.target.value) })}
          className="mt-3 w-full"
        />
      </label>
      <label className="block rounded-xl border border-white/5 bg-black/20 p-3">
        <span className="text-xs text-slate-300">Play nos cards quando estiverem {config.cardsAutoplayThreshold}% visíveis</span>
        <input
          type="range"
          min="10"
          max="100"
          value={config.cardsAutoplayThreshold}
          onChange={e => onChange({ cardsAutoplayThreshold: Number(e.target.value) })}
          className="mt-3 w-full"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {labelFields.map(([field, label]) => (
          <label key={field} className="space-y-1">
            <span className="block text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
            <input
              value={(config.labels as any)?.[field] || ""}
              onChange={e => onLabelChange(field, e.target.value)}
              className="w-full p-3 text-sm"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
