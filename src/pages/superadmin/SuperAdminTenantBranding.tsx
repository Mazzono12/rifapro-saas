import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { BrandingSettingsForm } from "../../components/branding/BrandingSettingsForm";

export function SuperAdminTenantBranding() {
  const { tenantId = "" } = useParams();
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/superadmin/tenants/${tenantId}/branding`)
      .then(res => res.json())
      .then(setBranding)
      .catch(() => toast.error("Nao foi possivel carregar aparencia do tenant"));
  }, [tenantId]);

  const save = async () => {
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/branding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding)
    });
    if (!res.ok) throw new Error("Nao foi possivel salvar aparencia");
    setBranding(await res.json());
    toast.success("Aparencia do tenant salva");
  };

  const reset = async () => {
    const res = await fetch(`/api/superadmin/tenants/${tenantId}/branding/reset`, { method: "POST" });
    if (!res.ok) throw new Error("Nao foi possivel resetar aparencia");
    setBranding(await res.json());
    toast.success("Aparencia resetada");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="premium-eyebrow">Superadmin</p>
        <h1 className="text-3xl font-black text-white">Aparencia do tenant</h1>
        <p className="mt-2 text-sm text-slate-400">Configure nome, logo, GIF animado, favicon e cores para qualquer tenant.</p>
      </div>
      {branding ? (
        <BrandingSettingsForm
          value={branding}
          onChange={setBranding}
          onSave={() => save().catch(error => toast.error(error.message))}
          onReset={() => reset().catch(error => toast.error(error.message))}
          logoEndpoint={`/api/superadmin/tenants/${tenantId}/branding/logo`}
          faviconEndpoint={`/api/superadmin/tenants/${tenantId}/branding/favicon`}
        />
      ) : (
        <div className="premium-card p-8 text-slate-400">Carregando aparencia...</div>
      )}
    </div>
  );
}
