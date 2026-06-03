import { existsSync, readFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const envPath = join(root, ".env");
const requiredEnv = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "STORAGE_DRIVER",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "PUBLIC_BASE_URL",
  "ADMIN_BASE_URL",
  "JWT_SECRET",
  "SESSION_SECRET"
];

function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    env[key] = raw.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function strongSecret(value) {
  return typeof value === "string" &&
    value.length >= 32 &&
    !/(troque|change|example|secret|senha|password|default|gere-um|gere-outro)/i.test(value);
}

const errors = [];
const warnings = [];

if (!existsSync(join(root, "dist", "server.js"))) errors.push("build ausente: dist/server.js nao existe");
if (!existsSync(join(root, "dist", "index.html"))) errors.push("build ausente: dist/index.html nao existe");
if (!existsSync(envPath)) {
  errors.push(".env nao encontrado");
} else {
  const env = parseEnv(readFileSync(envPath, "utf8"));
  for (const key of requiredEnv) {
    if (!String(env[key] || "").trim()) errors.push(`${key} ausente no .env`);
  }
  if (env.NODE_ENV !== "production") errors.push("NODE_ENV deve ser production");
  if (!["postgres", "persistent"].includes(String(env.STORAGE_DRIVER || "").toLowerCase())) {
    errors.push("STORAGE_DRIVER deve ser postgres ou persistent");
  }
  if (env.ENABLE_PUBLIC_DEBUG !== "false") errors.push("ENABLE_PUBLIC_DEBUG deve ser false");
  if (!String(env.DATABASE_URL || "").trim()) errors.push("DATABASE_URL configurada obrigatoria");
  if (!strongSecret(env.JWT_SECRET)) errors.push("JWT_SECRET deve ter 32+ caracteres e nao pode ser placeholder");
  if (!strongSecret(env.SESSION_SECRET)) errors.push("SESSION_SECRET deve ter 32+ caracteres e nao pode ser placeholder");
  if (env.STORAGE_DRIVER === "persistent") {
    warnings.push("STORAGE_DRIVER=persistent aceito para single-process, mas confirme persistencia real antes do deploy.");
  }
}

warnings.push("multiInstanceSafe=false: use exatamente 1 processo backend; PM2 deve ficar em fork com instances=1.");

if (warnings.length) {
  console.warn("Avisos:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("Falha no prod:check:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("PASS: prod:check validou build, .env, STORAGE_DRIVER, debug publico e segredos fortes para deploy single-process.");
