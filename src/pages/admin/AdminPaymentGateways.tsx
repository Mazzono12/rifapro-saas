import React, { useEffect, useState } from "react";
import { Settings, Save, Link2, CreditCard, CheckCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const defaultGateways = {
  pix: {
    enabled: true,
    sandbox: true,
    apiKey: "",
    pixKey: "",
    webhookUrl: "http://127.0.0.1:3000/api/webhooks/payment/sandbox",
    webhookSecret: "",
    webhookEvents: "payment.created,payment.updated,payment.paid"
  },
  active: "sandbox",
  mercadopago: { accessToken: "", publicKey: "", webhookUrl: "", webhookSecret: "" },
  pagbank: { token: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  asaas: { apiKey: "", webhookUrl: "", webhookSecret: "" },
  infinitypay: { token: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  pay2m: { token: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  cora: { clientId: "", clientSecret: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  primepag: { clientId: "", clientSecret: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  paggue: { clientId: "", clientSecret: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  cashpay: { clientId: "", clientSecret: "", apiKey: "", webhookUrl: "", webhookSecret: "" },
  fakeprocessor: { apiKey: "", webhookUrl: "", webhookSecret: "" },
  sandbox: { apiKey: "sandbox-only", webhookUrl: "", webhookSecret: "" },
  mock: { apiKey: "mock-only", webhookUrl: "", webhookSecret: "" }
};

const gatewayIds = ["sandbox", "mock", "primepag", "paggue", "cashpay", "fakeprocessor", "mercadopago", "pagbank", "asaas", "infinitypay", "pay2m", "cora"];
const gatewayLabels: Record<string, string> = {
  sandbox: "Sandbox PIX",
  mock: "Mock local",
  primepag: "PrimePag",
  paggue: "Paggue",
  cashpay: "Cash Pay",
  fakeprocessor: "Fke Processor",
  mercadopago: "Mercado Pago",
  pagbank: "PagBank",
  asaas: "Asaas",
  infinitypay: "InfinityPay",
  pay2m: "Pay2M",
  cora: "Cora"
};

function normalizeGateways(input: any) {
  return {
    ...defaultGateways,
    ...(input || {}),
    pix: { ...defaultGateways.pix, ...(input?.pix || {}) },
    mercadopago: { ...defaultGateways.mercadopago, ...(input?.mercadopago || {}) },
    pagbank: { ...defaultGateways.pagbank, ...(input?.pagbank || {}) },
    asaas: { ...defaultGateways.asaas, ...(input?.asaas || {}) },
    infinitypay: { ...defaultGateways.infinitypay, ...(input?.infinitypay || {}) },
    pay2m: { ...defaultGateways.pay2m, ...(input?.pay2m || {}) },
    cora: { ...defaultGateways.cora, ...(input?.cora || {}) },
    primepag: { ...defaultGateways.primepag, ...(input?.primepag || {}) },
    paggue: { ...defaultGateways.paggue, ...(input?.paggue || {}) },
    cashpay: { ...defaultGateways.cashpay, ...(input?.cashpay || {}) },
    fakeprocessor: { ...defaultGateways.fakeprocessor, ...(input?.fakeprocessor || {}) },
    sandbox: { ...defaultGateways.sandbox, ...(input?.sandbox || {}) },
    mock: { ...defaultGateways.mock, ...(input?.mock || {}) },
  };
}

export function AdminPaymentGateways() {
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingGateway, setTestingGateway] = useState("");
  const [gateways, setGateways] = useState<any>(defaultGateways);

  useEffect(() => {
    fetch("/api/admin/gateways")
      .then(res => res.json())
      .then(data => {
        if(data && Object.keys(data).length > 0) {
            setGateways(normalizeGateways(data));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/admin/gateways", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeGateways(gateways))
      });
      toast.success("Gateways salvos com sucesso!");
    } catch (e) {
      toast.error("Erro ao salvar gateways");
    }
  };

  const updateGateway = (gateway: string, field: string, value: string) => {
    const normalized = normalizeGateways(gateways);
    setGateways({
      ...normalized,
      [gateway]: {
        ...normalized[gateway],
        [field]: value
      }
    });
  };

  const setActiveGateway = (gateway: string) => {
    const normalized = normalizeGateways(gateways);
    setGateways({
      ...normalized,
      active: gateway,
      pix: {
        ...normalized.pix,
        webhookUrl: `http://127.0.0.1:3000/api/webhooks/payment/${gateway}`
      }
    });
  };

  const updatePix = (field: string, value: string | boolean) => {
    const normalized = normalizeGateways(gateways);
    setGateways({
      ...normalized,
      pix: {
        ...normalized.pix,
        [field]: value
      }
    });
  };

  const testGateway = async (gateway: string) => {
    setTestingGateway(gateway);
    try {
      const res = await fetch("/api/admin/gateways/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao testar gateway");
      setTestResults(current => ({ ...current, [gateway]: data }));
      if (data.ok) toast.success(`Gateway ${gateway} validado`);
      else toast.warning(`Gateway ${gateway} precisa de ajuste`, { description: data.issues?.[0] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao testar gateway");
    } finally {
      setTestingGateway("");
    }
  };

  const testAllGateways = async () => {
    for (const gateway of gatewayIds) {
      await testGateway(gateway);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-8 fade-in">
       <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-display font-medium text-white flex items-center gap-3">
               <ShieldCheck className="w-8 h-8 text-emerald-400" /> Gateways de Pagamento
            </h1>
            <p className="text-slate-400 mt-2 text-sm font-mono tracking-widest uppercase">Configure suas integrações PIX</p>
         </div>
         <button onClick={testAllGateways} className="rounded-xl border border-emerald-400/30 px-4 py-3 text-xs font-mono uppercase text-emerald-200 hover:bg-emerald-400/10">
           Testar todos
         </button>
       </div>

       <form onSubmit={handleSave} className="space-y-8">
         
         <div className="glass-card p-6 border border-emerald-500/20 rounded-3xl space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-6 border-b border-white/5 pb-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <label className="flex items-center justify-between gap-4">
                        <span>
                            <span className="block text-lg font-display font-bold text-white">PIX habilitado</span>
                            <span className="block text-xs text-slate-400 mt-1">Quando desligado, novas compras retornam indisponível.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={Boolean(gateways.pix?.enabled)}
                            onChange={e => updatePix("enabled", e.target.checked)}
                            className="h-5 w-5"
                        />
                    </label>
                    <label className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-300">
                        Ambiente sandbox/teste
                        <input
                            type="checkbox"
                            checked={Boolean(gateways.pix?.sandbox)}
                            onChange={e => updatePix("sandbox", e.target.checked)}
                        />
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GatewayInput label="Chave PIX global" type="password" value={gateways.pix?.apiKey || ""} onChange={value => updatePix("apiKey", value)} />
                    <GatewayInput label="Webhook Secret global" type="password" value={gateways.pix?.webhookSecret || ""} onChange={value => updatePix("webhookSecret", value)} />
                    <GatewayInput label="Webhook URL global" value={gateways.pix?.webhookUrl || ""} onChange={value => updatePix("webhookUrl", value)} />
                    <GatewayInput label="Eventos do webhook" value={gateways.pix?.webhookEvents || ""} onChange={value => updatePix("webhookEvents", value)} />
                </div>
            </div>

            <div className="flex flex-col gap-2 border-b border-white/5 pb-4 mb-4">
                <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">Gateway Ativo</label>
                <select 
                    value={gateways.active}
                    onChange={(e) => setActiveGateway(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500/50 transition-all font-mono text-sm max-w-sm"
                >
                    {gatewayIds.map(gateway => (
                        <option key={gateway} value={gateway}>{gatewayLabels[gateway]}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {["sandbox", "mock", "primepag", "paggue", "cashpay", "fakeprocessor"].map(gateway => (
                    <GenericGatewayCard
                        key={gateway}
                        gateway={gateway}
                        label={gatewayLabels[gateway]}
                        active={gateways.active === gateway}
                        config={gateways[gateway] || {}}
                        testing={testingGateway === gateway}
                        result={testResults[gateway]}
                        onActivate={setActiveGateway}
                        onUpdate={updateGateway}
                        onTest={testGateway}
                    />
                ))}

                {/* Mercado Pago */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'mercadopago' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        {gateways.active === 'mercadopago' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        Mercado Pago
                    </h3>
                    <div className="space-y-4">
                        <GatewayInput label="Access Token" type="password" value={gateways.mercadopago?.accessToken || ''} onChange={value => updateGateway('mercadopago', 'accessToken', value)} />
                        <GatewayInput label="Public Key" value={gateways.mercadopago?.publicKey || ''} onChange={value => updateGateway('mercadopago', 'publicKey', value)} />
                        <GatewayInput label="Webhook URL" value={gateways.mercadopago?.webhookUrl || ''} onChange={value => updateGateway('mercadopago', 'webhookUrl', value)} />
                        <GatewayInput label="Webhook Secret" type="password" value={gateways.mercadopago?.webhookSecret || ''} onChange={value => updateGateway('mercadopago', 'webhookSecret', value)} />
                    </div>
                    <GatewayTest gateway="mercadopago" result={testResults.mercadopago} testing={testingGateway === "mercadopago"} onTest={testGateway} />
                </div>

                {/* PagBank */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'pagbank' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        {gateways.active === 'pagbank' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        PagBank
                    </h3>
                    <div className="space-y-4">
                        <GatewayInput label="Token" type="password" value={gateways.pagbank?.token || ''} onChange={value => updateGateway('pagbank', 'token', value)} />
                        <GatewayInput label="API Key" type="password" value={gateways.pagbank?.apiKey || ''} onChange={value => updateGateway('pagbank', 'apiKey', value)} />
                        <GatewayInput label="Webhook URL" value={gateways.pagbank?.webhookUrl || ''} onChange={value => updateGateway('pagbank', 'webhookUrl', value)} />
                        <GatewayInput label="Webhook Secret" type="password" value={gateways.pagbank?.webhookSecret || ''} onChange={value => updateGateway('pagbank', 'webhookSecret', value)} />
                    </div>
                    <GatewayTest gateway="pagbank" result={testResults.pagbank} testing={testingGateway === "pagbank"} onTest={testGateway} />
                </div>

                {/* Asaas */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'asaas' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        {gateways.active === 'asaas' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        Asaas
                    </h3>
                    <div className="space-y-4">
                        <GatewayInput label="API Key" type="password" value={gateways.asaas?.apiKey || ''} onChange={value => updateGateway('asaas', 'apiKey', value)} />
                        <GatewayInput label="Webhook URL" value={gateways.asaas?.webhookUrl || ''} onChange={value => updateGateway('asaas', 'webhookUrl', value)} />
                        <GatewayInput label="Webhook Secret" type="password" value={gateways.asaas?.webhookSecret || ''} onChange={value => updateGateway('asaas', 'webhookSecret', value)} />
                    </div>
                    <GatewayTest gateway="asaas" result={testResults.asaas} testing={testingGateway === "asaas"} onTest={testGateway} />
                </div>

                {/* InfinityPay */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'infinitypay' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        {gateways.active === 'infinitypay' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        InfinityPay
                    </h3>
                    <div className="space-y-4">
                        <GatewayInput label="Token" type="password" value={gateways.infinitypay?.token || ''} onChange={value => updateGateway('infinitypay', 'token', value)} />
                        <GatewayInput label="API Key" type="password" value={gateways.infinitypay?.apiKey || ''} onChange={value => updateGateway('infinitypay', 'apiKey', value)} />
                        <GatewayInput label="Webhook URL" value={gateways.infinitypay?.webhookUrl || ''} onChange={value => updateGateway('infinitypay', 'webhookUrl', value)} />
                        <GatewayInput label="Webhook Secret" type="password" value={gateways.infinitypay?.webhookSecret || ''} onChange={value => updateGateway('infinitypay', 'webhookSecret', value)} />
                    </div>
                    <GatewayTest gateway="infinitypay" result={testResults.infinitypay} testing={testingGateway === "infinitypay"} onTest={testGateway} />
                </div>

                {/* Pay2M */}
                <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'pay2m' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        {gateways.active === 'pay2m' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        Pay2M
                    </h3>
                    <div className="space-y-4">
                        <GatewayInput label="Token" type="password" value={gateways.pay2m?.token || ''} onChange={value => updateGateway('pay2m', 'token', value)} />
                        <GatewayInput label="API Key" type="password" value={gateways.pay2m?.apiKey || ''} onChange={value => updateGateway('pay2m', 'apiKey', value)} />
                        <GatewayInput label="Webhook URL" value={gateways.pay2m?.webhookUrl || ''} onChange={value => updateGateway('pay2m', 'webhookUrl', value)} />
                        <GatewayInput label="Webhook Secret" type="password" value={gateways.pay2m?.webhookSecret || ''} onChange={value => updateGateway('pay2m', 'webhookSecret', value)} />
                    </div>
                    <GatewayTest gateway="pay2m" result={testResults.pay2m} testing={testingGateway === "pay2m"} onTest={testGateway} />
                </div>

                 {/* Cora */}
                 <div className={`p-6 rounded-2xl border transition-colors ${gateways.active === 'cora' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        {gateways.active === 'cora' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        Cora
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-mono text-slate-400 mb-1">Client ID</label>
                            <input 
                                type="text" 
                                value={gateways.cora?.clientId || ''} 
                                onChange={e => updateGateway('cora', 'clientId', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-mono text-slate-400 mb-1">Client Secret</label>
                            <input 
                                type="password" 
                                value={gateways.cora?.clientSecret || ''} 
                                onChange={e => updateGateway('cora', 'clientSecret', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none"
                            />
                        </div>
                        <GatewayInput label="API Key" type="password" value={gateways.cora?.apiKey || ''} onChange={value => updateGateway('cora', 'apiKey', value)} />
                        <GatewayInput label="Webhook URL" value={gateways.cora?.webhookUrl || ''} onChange={value => updateGateway('cora', 'webhookUrl', value)} />
                        <GatewayInput label="Webhook Secret" type="password" value={gateways.cora?.webhookSecret || ''} onChange={value => updateGateway('cora', 'webhookSecret', value)} />
                    </div>
                    <GatewayTest gateway="cora" result={testResults.cora} testing={testingGateway === "cora"} onTest={testGateway} />
                </div>
            </div>
         </div>
         
         <div className="flex justify-end pt-4">
           <button type="submit" className="neon-button px-8 py-4 rounded-xl flex items-center gap-2 text-sm uppercase tracking-widest font-bold !shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:!shadow-[0_0_30px_rgba(16,185,129,0.5)] !border-emerald-500/50">
              <Save className="w-4 h-4" /> Salvar Gateways
           </button>
         </div>
       </form>
    </div>
  );
}

function GenericGatewayCard({
  gateway,
  label,
  active,
  config,
  testing,
  result,
  onActivate,
  onUpdate,
  onTest
}: {
  key?: React.Key;
  gateway: string;
  label: string;
  active: boolean;
  config: Record<string, string>;
  testing: boolean;
  result?: any;
  onActivate: (gateway: string) => void;
  onUpdate: (gateway: string, field: string, value: string) => void;
  onTest: (gateway: string) => void;
}) {
  const credentialFields = gateway === "fakeprocessor" || gateway === "sandbox" || gateway === "mock"
    ? ["apiKey"]
    : ["clientId", "clientSecret", "apiKey"];

  return (
    <div className={`p-6 rounded-2xl border transition-colors ${active ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/5 bg-white/[0.02]"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          {active && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {label}
        </h3>
        <button type="button" onClick={() => onActivate(gateway)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-mono uppercase text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200">
          Usar
        </button>
      </div>
      <div className="space-y-4">
        {credentialFields.map(field => (
          <GatewayInput
            key={field}
            label={field === "apiKey" ? "API Key" : field === "clientId" ? "Client ID" : "Client Secret"}
            type={field.toLowerCase().includes("secret") || field.toLowerCase().includes("key") ? "password" : "text"}
            value={config[field] || ""}
            onChange={value => onUpdate(gateway, field, value)}
          />
        ))}
        <GatewayInput label="Webhook URL" value={config.webhookUrl || ""} onChange={value => onUpdate(gateway, "webhookUrl", value)} />
        <GatewayInput label="Webhook Secret" type="password" value={config.webhookSecret || ""} onChange={value => onUpdate(gateway, "webhookSecret", value)} />
      </div>
      <GatewayTest gateway={gateway} result={result} testing={testing} onTest={onTest} />
    </div>
  );
}

function GatewayTest({ gateway, result, testing, onTest }: { gateway: string; result?: any; testing: boolean; onTest: (gateway: string) => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Teste do caminho PIX</span>
        <button type="button" onClick={() => onTest(gateway)} disabled={testing} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-[10px] font-mono uppercase text-emerald-200 disabled:opacity-50">
          {testing ? "Testando..." : "Testar"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-2 text-xs">
          <p className={result.ok ? "text-emerald-300" : "text-amber-300"}>{result.ok ? "Configuração coerente" : "Ajustes necessários"}</p>
          <p className="break-all font-mono text-slate-500">Webhook: {result.webhookUrl}</p>
          {!!result.issues?.length && <p className="text-amber-200">{result.issues.join(" • ")}</p>}
        </div>
      )}
    </div>
  );
}

function GatewayInput({ label, value, onChange, type = "text" }: { key?: React.Key; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-mono text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-emerald-500/50 outline-none"
      />
    </div>
  );
}
