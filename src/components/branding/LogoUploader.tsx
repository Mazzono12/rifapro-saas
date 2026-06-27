import { Upload } from "lucide-react";

export function LogoUploader({ endpoint, onUploaded, label = "Enviar logo/GIF" }: { endpoint: string; onUploaded: (branding: any) => void; label?: string }) {
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
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-[var(--admin-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--admin-text)] hover:bg-slate-50">
      <Upload className="h-4 w-4" /> {label}
      <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,.gif,image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="sr-only" onChange={event => upload(event.target.files?.[0]).catch(error => alert(error.message))} />
    </label>
  );
}
