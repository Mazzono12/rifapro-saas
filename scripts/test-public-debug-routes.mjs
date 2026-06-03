import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const serverEntry = "dist/server.js";
assert.equal(existsSync(serverEntry), true, "Execute npm run build antes deste teste.");

const port = Number(process.env.PORT || (3460 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  RIFAPRO_TEST_MODE: "true",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.public-debug@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "test-public-debug-routes-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "test-public-debug-routes-gateway-key",
  ENABLE_PUBLIC_DEBUG: "true"
};

const server = spawn(process.execPath, [serverEntry], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", chunk => { output += chunk.toString(); });
server.stderr.on("data", chunk => { output += chunk.toString(); });

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/api/public/health`);
      if (response.status === 200) return;
    } catch {
      // Server is still starting.
    }
    await wait(100);
  }
  throw new Error(`Servidor de teste nao iniciou a tempo.\n${output.slice(-2000)}`);
}

async function assertOk(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      host: "railway-debug.local",
      "x-forwarded-host": "railway-debug.local"
    }
  });
  const body = await response.text();
  assert.equal(response.status, 200, `${path} deveria retornar 200, recebeu ${response.status}: ${body}`);
}

try {
  await waitForServer();
  await assertOk("/api/public/health");
  await assertOk("/api/public/tenant-debug");
  await assertOk("/api/public/raffles-debug");
  assert.match(output, /\[routes\] public debug routes registered/, "Log de registro das rotas publicas deve aparecer no boot.");
  console.log("PASS: rotas publicas debug respondem antes do tenant/fallback.");
} finally {
  server.kill("SIGTERM");
}
