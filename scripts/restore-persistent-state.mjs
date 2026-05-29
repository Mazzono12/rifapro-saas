import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const backupPath = resolve(process.argv[2] || "");
const apply = process.argv.includes("--apply");
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

if (!backupPath || !existsSync(backupPath)) {
  console.error("Informe o arquivo de backup: npm run restore:persistent-state -- caminho.json [--apply]");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(backupPath, "utf8"));
if (backup.kind !== "rifapro-persistent-state-backup" || !Array.isArray(backup.rows)) {
  console.error("Backup invalido ou incompatível.");
  process.exit(1);
}

const checksum = createHash("sha256").update(JSON.stringify(backup.rows)).digest("hex");
if (checksum !== backup.checksum_sha256) {
  console.error("Checksum invalido. Restore bloqueado.");
  process.exit(1);
}

const rows = backup.rows.map(row => {
  const collection = String(row.collection || row.state_key || "default").trim() || "default";
  const stateKey = String(row.state_key || collection).trim() || collection;
  const stateValue = row.state_value ?? row.data ?? {};
  return {
    scope: String(row.scope || "platform"),
    state_key: stateKey,
    state_value: stateValue,
    tenant_id: String(row.tenant_id || "platform"),
    collection,
    record_key: String(row.record_key || "singleton"),
    data: row.data ?? stateValue,
    updated_at: new Date().toISOString()
  };
});

if (!apply) {
  console.log(JSON.stringify({ ok: true, dry_run: true, row_count: rows.length, checksum_sha256: checksum }, null, 2));
  process.exit(0);
}

if (!supabaseUrl || !serviceKey) {
  console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios para restore com --apply.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { error } = await supabase
  .from("persistent_state_records")
  .upsert(rows, { onConflict: "scope,state_key" });

if (error) {
  console.error(`Falha ao restaurar persistent_state_records: ${error.message}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, restored_rows: rows.length, checksum_sha256: checksum }, null, 2));
