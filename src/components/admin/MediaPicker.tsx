import { useState } from "react";
import { ImagePlus, Link2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { inferMediaType, type MediaType } from "../../utils/media";
import { ResponsiveMediaFrame } from "../ResponsiveMediaFrame";
import type { MediaAspectDetection, ResponsiveMediaAspectMode, ResponsiveMediaFit } from "../../utils/mediaAspect";

const maxUploadSize = 100 * 1024 * 1024;
const acceptedMedia = ".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,.wmv,.wma,.wmi";

type MediaPickerProps = {
  label: string;
  value?: string;
  mediaType?: MediaType | string;
  onChange: (mediaUrl: string, mediaType: MediaType) => void;
  required?: boolean;
  accept?: string;
  allowExternalVideo?: boolean;
};

export function MediaPicker({ label, value = "", mediaType, onChange, required = false, accept = acceptedMedia, allowExternalVideo = true }: MediaPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [lastError, setLastError] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [detectedAspect, setDetectedAspect] = useState<MediaAspectDetection | null>(null);
  const [fitMode, setFitMode] = useState<ResponsiveMediaFit>("auto");
  const [mediaAspectPreference, setMediaAspectPreference] = useState<ResponsiveMediaAspectMode>("auto");

  const uploadFile = async (file?: File) => {
    if (!file) return;
    setLastError("");
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

  const applyExternalVideo = () => {
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
    if (detectedType === "image") {
      const message = "Use link do YouTube, Vimeo, MediaDelivery/Bunny.net ou um arquivo de vídeo direto (.mp4, .webm, .mov ou .m3u8).";
      setLastError(message);
      toast.error("Link de vídeo não reconhecido");
      return;
    }
    onChange(url, detectedType);
    toast.success("Vídeo externo aplicado");
  };

  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-muted)]">
          <ImagePlus className="h-4 w-4 text-[var(--admin-primary)]" /> {label}
        </span>
        <span className="text-xs text-[var(--admin-muted)]">Até 100MB</span>
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
              <Link2 className="h-4 w-4" /> Vídeo por link externo
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={externalUrl}
                onChange={event => setExternalUrl(event.target.value)}
                placeholder="YouTube, Vimeo, MediaDelivery/Bunny.net ou URL direta do vídeo"
                className="admin-input min-h-12 min-w-0 flex-1"
              />
              <button type="button" onClick={applyExternalVideo} className="admin-button-secondary min-h-12 shrink-0">
                Aplicar link
              </button>
            </div>
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
        Arquivos aceitos: {accept.toUpperCase()}. Tipo atual: {mediaType || inferMediaType(value)}. Aceita links player.mediadelivery.net/play.
      </p>
    </div>
  );
}
