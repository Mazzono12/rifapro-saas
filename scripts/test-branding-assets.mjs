import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const serverSource = readFileSync("server.ts", "utf8");
assert.match(serverSource, /image\/gif/, "GIF deve ser MIME permitido");
assert.match(serverSource, /\.gif/, "Extensao .gif deve ser permitida");
assert.match(serverSource, /<script\|javascript:\|onload=\|onerror=\|<foreignobject/, "SVG perigoso deve ser bloqueado");
assert.match(serverSource, /TENANT_BRANDING_MAX_BYTES/, "Tamanho maximo deve ser configuravel");
assert.match(serverSource, /tenant-assets\/.+branding/, "Assets devem usar caminho tenant-assets/{tenant_id}/branding");

const port = Number(process.env.PORT || (5250 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  TENANT_BRANDING_MAX_BYTES: "1024",
  SUPABASE_URL: "",
  VITE_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SERVICE_KEY: "",
  SUPERADMIN_EMAIL: "superadmin.assets@test.local",
  SUPERADMIN_PASSWORD: "SenhaSuperadmin123!",
  JWT_SECRET: "branding-assets-jwt-secret-long-value",
  GATEWAY_CREDENTIALS_ENCRYPTION_KEY: "branding-assets-gateway-credentials-key"
};
const server = spawn(process.execPath, ["dist/server.js"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/public/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor de assets nao iniciou.\n${serverOutput}`);
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  return body.token;
}

async function upload(token, name, type, bytes) {
  const response = await fetch(`${baseUrl}/api/superadmin/tenants/tenant-cliente-a/branding/logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": type, "X-File-Name": name },
    body: bytes
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

try {
  await waitForServer();
  const token = await login();
  const gif = Buffer.from("GIF89a\u0001\u0000\u0001\u0000\u0080\u0000\u0000\u0000\u0000\u0000ffffff,\u0000\u0000\u0000\u0000\u0001\u0000\u0001\u0000\u0000\u0002\u0002D\u0001\u0000;", "binary");
  const gifUpload = await upload(token, "logo.gif", "image/gif", gif);
  assert.equal(gifUpload.response.status, 201, "GIF animado deve ser aceito");
  assert.equal(gifUpload.body.branding.logo_mime_type, "image/gif", "MIME do GIF deve ser preservado");
  assert.match(gifUpload.body.branding.logo_url, /\.gif$/, "GIF nao deve virar imagem estatica");

  const invalid = await upload(token, "logo.exe", "application/x-msdownload", Buffer.from("MZ"));
  assert.equal(invalid.response.status, 415, "Upload invalido deve ser recusado");

  const oversized = await upload(token, "logo.png", "image/png", Buffer.alloc(2048));
  assert.equal(oversized.response.status, 413, "Tamanho excessivo deve ser recusado");

  const dangerousSvg = await upload(token, "logo.svg", "image/svg+xml", Buffer.from("<svg onload=\"alert(1)\"></svg>"));
  assert.equal(dangerousSvg.response.status, 415, "SVG perigoso deve ser recusado");

  console.log("PASS: assets de branding validam GIF, MIME, tamanho e SVG perigoso.");
} finally {
  server.kill();
}
