import { readFileSync } from "node:fs";

const backup = readFileSync("scripts/backup-persistent-state.mjs", "utf8");
const restore = readFileSync("scripts/restore-persistent-state.mjs", "utf8");
const pkg = readFileSync("package.json", "utf8");

function includesAll(content, expected, label) {
  const missing = expected.filter(item => !content.includes(item));
  if (missing.length) throw new Error(`${label} sem trechos obrigatorios: ${missing.join(", ")}`);
}

includesAll(backup, [
  "persistent_state_records",
  "SUPABASE_SERVICE_ROLE_KEY",
  "checksum_sha256",
  "createHash(\"sha256\")",
  "BACKUP_DIR",
  "row_count",
  "console.log(JSON.stringify"
], "backup persistente");

includesAll(restore, [
  "persistent_state_records",
  "checksum_sha256",
  "Checksum invalido. Restore bloqueado.",
  "dry_run",
  "--apply",
  "SUPABASE_SERVICE_ROLE_KEY",
  "onConflict: \"scope,state_key\"",
  "collection = String"
], "restore persistente");

includesAll(pkg, [
  "backup:persistent-state",
  "restore:persistent-state",
  "test:backup-restore-readiness"
], "scripts npm backup/restore");

if ((backup + restore).split("\n").some(line => /console\.(log|error)/.test(line) && /serviceKey|service_key|SUPABASE_SERVICE_KEY/.test(line))) {
  throw new Error("Scripts de backup/restore nao devem imprimir secrets.");
}

console.log("[backup-restore-readiness] ok");
