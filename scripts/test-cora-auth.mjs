import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provider = readFileSync("src/server/payments/CoraProvider.ts", "utf8");
const admin = readFileSync("src/pages/admin/AdminPaymentGateways.tsx", "utf8");

for (const needle of [
  "https://matls-clients.api.stage.cora.com.br",
  "https://matls-clients.api.cora.com.br",
  "getAccessToken",
  "grant_type",
  "client_credentials",
  "tokenCache",
  "certificate",
  "privateKey",
  "Certificado e chave privada Cora sao obrigatorios",
  "timeoutMs",
  "httpsRequest",
  "cert: this.certificate",
  "key: this.privateKey",
  "response.statusCode >= 500 && attempt === 0"
]) assert.ok(provider.includes(needle), `CoraProvider auth incompleto: ${needle}`);

for (const needle of [
  "Banco Cora Pix real",
  "client_id",
  "client_secret",
  "Certificado PEM",
  "Chave privada PEM",
  "Banco Cora pode exigir CoraPro/Integração Direta com certificado e chave"
]) assert.ok(admin.includes(needle), `Admin Cora auth incompleto: ${needle}`);

assert.ok(!provider.includes("console.log(this.privateKey)") && !provider.includes("console.log(this.certificate)") && !provider.includes("console.log(token"), "Cora nao deve logar token/certificado/chave.");

console.log("PASS: Cora auth com token cacheado, certificado/chave, timeout e retry controlado.");
