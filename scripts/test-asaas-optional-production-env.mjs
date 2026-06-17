import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const adminPaymentGateways = readFileSync("src/pages/admin/AdminPaymentGateways.tsx", "utf8");
const prodCheck = readFileSync("scripts/prod-check.mjs", "utf8");

function arrayBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `Bloco ${marker} nao encontrado`);
  const open = source.indexOf("[", start);
  const close = source.indexOf("]", open);
  assert.ok(open >= 0 && close > open, `Array ${marker} invalido`);
  return source.slice(open, close);
}

const serverRequiredEnv = arrayBlock(server, "productionRequiredEnv");
const prodCheckRequiredEnv = arrayBlock(prodCheck, "requiredEnv");

for (const required of [
  "STORAGE_DRIVER",
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "JWT_SECRET"
]) {
  assert.ok(serverRequiredEnv.includes(`"${required}"`), `${required} deve continuar obrigatorio no boot de producao`);
  assert.ok(prodCheckRequiredEnv.includes(`"${required}"`), `${required} deve continuar obrigatorio no prod:check`);
}

assert.ok(!serverRequiredEnv.includes('"ASAAS_API_KEY"'), "ASAAS_API_KEY nao deve bloquear inicializacao do servidor");
assert.ok(!serverRequiredEnv.includes('"ASAAS_WEBHOOK_TOKEN"'), "ASAAS_WEBHOOK_TOKEN nao deve bloquear inicializacao do servidor");
assert.ok(prodCheckRequiredEnv.includes('"ASAAS_API_KEY"'), "ASAAS_API_KEY deve reprovar prod:check quando ausente");
assert.ok(!prodCheckRequiredEnv.includes('"ASAAS_WEBHOOK_TOKEN"'), "ASAAS_WEBHOOK_TOKEN deve seguir como aviso no prod:check");

assert.ok(
  server.includes("const gateway = \"asaas\"") &&
    server.includes("const effectiveAsaasApiKey = incomingApiKey || officialAsaasApiKey") &&
    server.includes('const presentCredentials = gateway === "asaas" && effectiveAsaasApiKey'),
  "Teste de gateway deve considerar somente Asaas com chave oficial salva ou chave real enviada"
);
assert.ok(
  server.includes('status: !hasGatewayCredentials ? "not_configured"'),
  "Teste do gateway deve expor status not_configured sem credenciais"
);
assert.ok(
  server.includes("normalizeRafflePixConfigForStorage") &&
    server.includes("inheritGlobal: false"),
  "Checkout deve reativar credencial PIX especifica por sorteio"
);
assert.ok(
  server.includes("const defaults = getDefaultRafflePixConfig()") &&
    server.includes('const gateway = "asaas"'),
  "PIX do checkout deve resolver sempre pelo Asaas do sorteio"
);
assert.ok(
  server.includes("const providerConfig = getPaymentGatewayConfigs(tenantId)") &&
    server.includes("normalizePaymentProvider(config.provider) === normalizedProvider && config.enabled") &&
    server.includes("return providerConfig || getDefaultPaymentGatewayConfig(tenantId)"),
  "Resolvedor do checkout deve conseguir usar o Asaas salvo mesmo quando houver config antiga de outro gateway"
);
assert.ok(
  server.includes('const provider = "asaas"') &&
    server.includes('provider: "asaas"'),
  "Gateway default deve forcar Asaas como unico canal ativo"
);
assert.ok(
  server.includes("localPixConfig") &&
    server.includes('hasPixGatewayCredentials("asaas", localCredentials)') &&
    server.includes("enabled: false"),
  "Config PIX efetiva deve priorizar chave do sorteio e isolar o global quando ausente"
);
assert.ok(
  server.includes("const legacyAsaasConfig = (getTenantGateways(tenantId).asaas || {})") &&
    server.includes("credentials.apiKey || config.pix_key || legacyAsaasConfig.apiKey"),
  "Checkout Asaas deve recuperar chave global legada se a config oficial antiga estiver sem credencial"
);
assert.ok(
  server.includes("const incomingAsaasKey = provider === \"asaas\"") &&
    server.includes("resolveAsaasEnvironment(incomingAsaasKey") &&
    server.includes("environment: asaasEnvironment"),
  "Salvamento do Asaas deve normalizar ambiente pela chave API efetiva"
);
assert.ok(
  !server.includes("Gateway PIX em sandbox/teste nao permitido no checkout publico"),
  "Checkout publico nao deve bloquear PIX por sandbox quando o ambiente global e producao fixa"
);
assert.ok(
  server.includes('environment: "production"') &&
    server.includes("sandbox: false"),
  "Gateway global deve permanecer em producao com sandbox desativado"
);
assert.ok(
  adminPaymentGateways.includes("const publicGatewayIds") &&
    adminPaymentGateways.includes("sandbox: false") &&
    !adminPaymentGateways.includes('<option value="sandbox">') &&
    !adminPaymentGateways.includes("Modo de validação"),
  "Tela de PIX global nao deve expor sandbox, mock ou modo de validacao"
);
assert.ok(
  prodCheck.includes("ASAAS_API_KEY obrigatoria: Asaas e o unico gateway de producao."),
  "prod:check deve reprovar producao sem ASAAS_API_KEY"
);

console.log("PASS: Asaas obrigatorio no prod-check, opcional no boot, sandbox removido e gateway marcado como not_configured.");
