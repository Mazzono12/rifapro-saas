import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const backupDir = resolve(process.env.BACKUP_DIR || join(root, "backups"));
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

if (!supabaseUrl || !serviceKey) {
  console.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios para backup.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data, error } = await supabase
  .from("persistent_state_records")
  .select("scope,state_key,state_value,tenant_id,collection,record_key,data,updated_at")
  .order("updated_at", { ascending: false });

if (error) {
  console.error(`Falha ao exportar persistent_state_records: ${error.message}`);
  process.exit(1);
}

const payload = {
  kind: "rifapro-persistent-state-backup",
  generated_at: new Date().toISOString(),
  row_count: data?.length || 0,
  rows: data || []
};
const canonical = JSON.stringify(payload.rows);
const checksum = createHash("sha256").update(canonical).digest("hex");
const backup = { ...payload, checksum_sha256: checksum };

mkdirSync(backupDir, { recursive: true });
const file = join(backupDir, `persistent-state-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify(backup, null, 2));

console.log(JSON.stringify({ ok: true, file, row_count: backup.row_count, checksum_sha256: checksum }, null, 2));
