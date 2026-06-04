import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { BrandingSettingsForm } from "../../components/branding/BrandingSettingsForm";

export function SuperAdminTenantBranding() {
  const { tenantId = "" } = useParams();
  const [branding, setBranding] = useState<any>(null);
  const isGlobal = !tenantId;
  const baseEndpoint = isGlobal ? "/api/superadmin/branding" : `/api/superadmin/tenants/${tenantId}/branding`;

  useEffect(() => {
    fetch(baseEndpoint)
      .then(res => res.json())
      .then(setBranding)
      .catch(() => toast.error("Nao foi possivel carregar aparencia"));
  }, [baseEndpoint]);

  const save = async () => {
    const res = await fetch(baseEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding)
    });
    if (!res.ok) throw new Error("Nao foi possivel salvar aparencia");
    setBranding(await res.json());
    toast.success("Aparencia salva");
  };

  const reset = async () => {
    const res = await fetch(`${baseEndpoint}/reset`, { method: "POST" });
    if (!res.ok) throw new Error("Nao foi possivel resetar aparencia");
    setBranding(await res.json());
    toast.success("Aparencia resetada");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="premium-eyebrow">{isGlobal ? "Global" : "Conta"}</p>
        <h1 className="text-3xl font-black text-white">{isGlobal ? "Aparencia global" : "Aparencia da conta"}</h1>
        <p className="mt-2 text-sm text-slate-400">Configure nome, logo, GIF animado, favicon, cores e a tela de login premium.</p>
      </div>
      {branding ? (
        <BrandingSettingsForm
          value={branding}
          onChange={setBranding}
          onSave={() => save().catch(error => toast.error(error.message))}
          onReset={() => reset().catch(error => toast.error(error.message))}
          logoEndpoint={`${baseEndpoint}/logo`}
          faviconEndpoint={`${baseEndpoint}/favicon`}
        />
      ) : (
        <div className="premium-card p-8 text-slate-400">Carregando aparencia...</div>
      )}
    </div>
  );
}
