import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.TEST_NO_PUBLIC_SUPERADMIN_SIGNUP_PORT || (5500 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
let serverOutput = "";
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  RIFAPRO_TEST_MODE: "hard",
  STORAGE_DRIVER: "persistent",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.signup-p0@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-no-public-superadmin-signup-jwt-secret",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-no-public-superadmin-signup-gateway-key"
};

const server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      if (response.status >= 200) return;
    } catch {
      // Server is still starting.
    }
    await wait(100);
  }
  throw new Error(`Servidor de teste nao iniciou a tempo. Saida: ${serverOutput.slice(-2000)}`);
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

try {
  await waitForServer();

  const blocked = await json("/api/auth/signup", {
    method: "POST",
    headers: { "x-forwarded-host": "admin.meudominio.com" },
    body: JSON.stringify({
      nome: "Superadmin Publico",
      email: "superadmin.publico@test.local",
      password: "SenhaPublica123!",
      role: "superadmin"
    })
  });
  assert.equal(blocked.response.status, 403, "Signup publico role=superadmin deve retornar 403 em producao.");

  const common = await json("/api/auth/signup", {
    method: "POST",
    headers: { "x-forwarded-host": "cliente-a.meudominio.com" },
    body: JSON.stringify({
      nome: "Admin Publico Cliente",
      email: "admin.publico.cliente@test.local",
      password: "SenhaPublica123!",
      role: "admin"
    })
  });
  assert.equal(common.response.status, 201, `Signup comum deve continuar funcionando: ${JSON.stringify(common.body)}`);
  assert.equal(common.body.usuario.role, "admin");
  assert.equal(common.body.usuario.tenant_id, "tenant-cliente-a");

  console.log("PASS: signup publico de superadmin bloqueado em producao e signup comum preservado.");
} finally {
  server.kill();
}
