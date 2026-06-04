import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
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

for (const optional of ["ASAAS_API_KEY", "ASAAS_WEBHOOK_TOKEN"]) {
  assert.ok(!serverRequiredEnv.includes(`"${optional}"`), `${optional} nao deve bloquear inicializacao em producao`);
  assert.ok(!prodCheckRequiredEnv.includes(`"${optional}"`), `${optional} nao deve reprovar prod:check como obrigatorio`);
}

assert.ok(
  server.includes('gateway !== "asaas" && Boolean(pixConfig.apiKey)'),
  "Asaas nao pode ser considerado configurado apenas pela chave PIX global"
);
assert.ok(
  server.includes('status: !hasGatewayCredentials ? "not_configured"'),
  "Teste do gateway deve expor status not_configured sem credenciais"
);
assert.ok(
  prodCheck.includes("Asaas nao configurado no .env; o sistema inicia"),
  "prod:check deve tratar Asaas ausente como aviso"
);

console.log("PASS: Asaas opcional no boot/prod-check, obrigatorios de producao preservados e gateway marcado como not_configured.");
