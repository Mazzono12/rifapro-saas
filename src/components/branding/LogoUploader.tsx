import { Upload } from "lucide-react";

export function LogoUploader({ endpoint, onUploaded }: { endpoint: string; onUploaded: (branding: any) => void }) {
  const upload = async (file?: File | null) => {
    if (!file) return;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": file.name
      },
      body: await file.arrayBuffer()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Upload recusado");
    onUploaded(data.branding);
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.08]">
      <Upload className="h-4 w-4" /> Enviar logo/GIF
      <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,.gif,image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="sr-only" onChange={event => upload(event.target.files?.[0]).catch(error => alert(error.message))} />
    </label>
  );
}
