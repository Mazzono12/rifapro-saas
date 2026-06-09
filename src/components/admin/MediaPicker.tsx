import { useState } from "react";
import { ImagePlus, Link2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { inferMediaType, type MediaType } from "../../utils/media";
import { ResponsiveMediaFrame } from "../ResponsiveMediaFrame";
import type { MediaAspectDetection, ResponsiveMediaAspectMode, ResponsiveMediaFit } from "../../utils/mediaAspect";

const maxUploadSize = 100 * 1024 * 1024;
const acceptedMedia = ".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.wmv,.wma,.wmi";
type MediaUsage = "hero" | "story" | "winner" | "card";

const mediaUsageProfiles: Record<MediaUsage, { title: string; size: string; ratio: string; aspect: ResponsiveMediaAspectMode; tone: string }> = {
  hero: { title: "Banner Hero", size: "1920x1080", ratio: "16:9", aspect: "horizontal", tone: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100" },
  story: { title: "Story", size: "1080x1920", ratio: "9:16", aspect: "story", tone: "border-violet-300/25 bg-violet-400/10 text-violet-100" },
  winner: { title: "Ganhador", size: "1080x1080", ratio: "1:1", aspect: "square", tone: "border-amber-300/30 bg-amber-400/10 text-amber-100" },
  card: { title: "Card", size: "1080x1080", ratio: "1:1", aspect: "square", tone: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" }
};

function detectMediaUsage(label: string, explicit?: MediaUsage): MediaUsage {
  if (explicit) return explicit;
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/story|stories|reels/.test(normalized)) return "story";
  if (/ganhador|ganhadores|vencedor|winner/.test(normalized)) return "winner";
  if (/hero|landing|banner|home|apresentacao|principal/.test(normalized)) return "hero";
  return "card";
}

function detectFileMediaType(file: File): MediaType {
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) return "gif" as MediaType;
  return inferMediaType(file.name);
}

function displayMediaType(type: MediaType | string | undefined) {
  if (type === "video" || type === "youtube" || type === "vimeo" || type === "bunny") return "Video";
  if (type === "gif") return "GIF";
  return "Imagem";
}

type MediaPickerProps = {
  label: string;
  value?: string;
  mediaType?: MediaType | string;
  onChange: (mediaUrl: string, mediaType: MediaType) => void;
  required?: boolean;
  accept?: string;
  allowExternalVideo?: boolean;
  mediaUsage?: MediaUsage;
};

export function MediaPicker({ label, value = "", mediaType, onChange, required = false, accept = acceptedMedia, allowExternalVideo = true, mediaUsage }: MediaPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [lastError, setLastError] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [detectedAspect, setDetectedAspect] = useState<MediaAspectDetection | null>(null);
  const [fitMode, setFitMode] = useState<ResponsiveMediaFit>("auto");
  const usage = detectMediaUsage(label, mediaUsage);
  const profile = mediaUsageProfiles[usage];
  const [mediaAspectPreference, setMediaAspectPreference] = useState<ResponsiveMediaAspectMode>(profile.aspect);
  const [detectedUploadType, setDetectedUploadType] = useState<MediaType | "">("");
  const currentMediaType = detectedUploadType || mediaType || inferMediaType(value);

  const uploadFile = async (file?: File) => {
    if (!file) return;
    setLastError("");
    const nextDetectedType = detectFileMediaType(file);
    setDetectedUploadType(nextDetectedType);
    const extension = `.${file.name.split(".").pop() || ""}`.toLowerCase();
    const allowedExtensions = accept
      .split(",")
      .map(item => item.trim().toLowerCase())
      .filter(item => item.startsWith("."));
    if (!allowedExtensions.includes(extension)) {
      const message = `Formato não suportado. Use: ${allowedExtensions.join(", ").toUpperCase()}.`;
      setLastError(message);
      toast.error(message);
      return;
    }
    if (file.size > maxUploadSize) {
      const message = "Arquivo acima de 100MB";
      setLastError(message);
      toast.error(message);
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/admin/media/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": file.name,
        },
        body: await file.arrayBuffer(),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };
      if (!res.ok) throw new Error(data.error || "Falha ao subir mídia");
      onChange(data.mediaUrl, data.mediaType);
      toast.success("Mídia carregada da galeria");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar mídia";
      setLastError(message.includes("<!DOCTYPE") ? "Servidor ainda não reconheceu a rota de upload. Reinicie o npm run dev." : message);
      toast.error(message.includes("<!DOCTYPE") ? "Reinicie o servidor local para ativar upload" : message);
    } finally {
      setUploading(false);
    }
  };

  const applyExternalMedia = () => {
    const url = externalUrl.trim();
    setLastError("");
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      const message = "Informe um link externo válido iniciado por http ou https.";
      setLastError(message);
      toast.error(message);
      return;
    }

    const detectedType = inferMediaType(url);
    if (detectedType === "youtube" || detectedType === "vimeo") {
      const message = "Use link direto de vídeo .mp4/.webm ou arquivo enviado.";
      setLastError(message);
      toast.error("Player externo não suportado neste campo");
      return;
    }
    onChange(url, detectedType);
    setDetectedUploadType(detectedType);
    toast.success(detectedType === "image" ? "Imagem por link aplicada" : "Vídeo por link aplicado");
  };

  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-muted)]">
          <ImagePlus className="h-4 w-4 text-[var(--admin-primary)]" /> {label}
        </span>
        <span className="text-xs text-[var(--admin-muted)]">Até 100MB</span>
      </div>
      <div className={`mb-3 rounded-xl border px-3 py-3 ${profile.tone}`} data-media-usage={usage}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.18em]">{profile.title}</p>
          <p className="text-[11px] font-semibold opacity-90">Tipo detectado: {displayMediaType(currentMediaType)}</p>
        </div>
        <p className="mt-1 text-xs leading-5 opacity-90">
          Recomendado: <strong>{profile.size}</strong> ({profile.ratio})
        </p>
      </div>
      <div className="grid gap-4">
        <label className="admin-button-secondary inline-flex min-h-12 cursor-pointer items-center justify-center gap-2">
          <UploadCloud className="h-4 w-4" /> {uploading ? "Enviando..." : "Subir da galeria"}
          <input
            type="file"
            accept={accept}
            required={required && !value}
            disabled={uploading}
            onChange={event => {
              uploadFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
            className="sr-only"
          />
        </label>
        {allowExternalVideo && <div className="rounded-lg border border-[var(--admin-border)] p-3">
          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-muted)]">
              <Link2 className="h-4 w-4" /> URL de mídia da campanha
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={externalUrl}
                onChange={event => setExternalUrl(event.target.value)}
                placeholder="Imagem ou vídeo direto .mp4/.webm/.mov"
                className="admin-input min-h-12 min-w-0 flex-1"
              />
              <button type="button" onClick={applyExternalMedia} className="admin-button-secondary min-h-12 shrink-0">
                Aplicar link
              </button>
            </div>
            <small className="block text-xs text-[var(--admin-muted)]">Aceita imagem ou vídeo direto .mp4/.webm/.mov. Para YouTube/Vimeo, use um arquivo enviado ou link direto de CDN/storage.</small>
          </label>
        </div>
        }
      </div>
      {value && (
        <>
          <div className="mt-3 break-all rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-[var(--admin-text)]">
            Mídia selecionada: <span className="font-mono">{value}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-[var(--admin-muted)]">Comportamento
              <select value={fitMode} onChange={event => setFitMode(event.target.value as ResponsiveMediaFit)} className="admin-input">
                <option value="auto">Automático</option>
                <option value="cover">Preencher/cortar</option>
                <option value="contain">Mostrar inteiro</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[var(--admin-muted)]">Proporção preferida
              <select value={mediaAspectPreference} onChange={event => setMediaAspectPreference(event.target.value as ResponsiveMediaAspectMode)} className="admin-input">
                <option value="auto">Auto</option>
                <option value="square">Quadrado 1:1</option>
                <option value="vertical">Vertical 9:16</option>
                <option value="story">Story/Reels</option>
                <option value="portrait">Retrato 4:5</option>
                <option value="horizontal">Horizontal 16:9</option>
                <option value="banner">Banner largo</option>
              </select>
            </label>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-black">
            <ResponsiveMediaFrame
              src={value}
              type={(mediaType as MediaType) || inferMediaType(value)}
              autoPlay
              preferredFit={fitMode}
              aspectMode={mediaAspectPreference}
              className="max-h-[360px]"
              onAspectDetected={setDetectedAspect}
            />
          </div>
          <div className="mt-2 rounded-lg border border-[var(--admin-border)] bg-white/[0.03] px-3 py-2 text-xs text-[var(--admin-muted)]">
            Orientação detectada: <strong className="text-[var(--admin-text)]">{detectedAspect?.orientation || "aguardando mídia"}</strong>
            {detectedAspect && <span> · ratio {detectedAspect.ratio.toFixed(2)} · fit sugerido {detectedAspect.recommendedFit}</span>}
          </div>
        </>
      )}
      {lastError && (
        <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {lastError}
        </div>
      )}
      <p className="mt-2 text-xs text-[var(--admin-muted)]">
        Arquivos aceitos: {accept.toUpperCase()}. Tipo atual: {mediaType || inferMediaType(value)}. Aceita imagem ou vídeo direto .mp4/.webm/.mov.
      </p>
    </div>
  );
}
