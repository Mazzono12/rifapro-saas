import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const isProduction = process.env.NODE_ENV === "production";
const allowProductionSeed = process.env.ALLOW_SUPERADMIN_SEED === "true";

if (isProduction && !allowProductionSeed) {
  throw new Error("Seed de superadmin bloqueado em producao. Defina ALLOW_SUPERADMIN_SEED=true para permitir.");
}

const email = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.SUPERADMIN_PASSWORD || "");
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!email || !email.includes("@")) {
  throw new Error("SUPERADMIN_EMAIL valido e obrigatorio no .env.");
}

if (!password) {
  throw new Error("SUPERADMIN_PASSWORD e obrigatorio no .env.");
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios para reset/criacao persistente.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const publicAuthClient = anonKey
  ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function findAuthUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find(user => user.email?.toLowerCase() === targetEmail);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureSuperadmin() {
  console.log(`seed:superadmin inicio email=${email}`);

  const existing = await findAuthUserByEmail(email);
  const authPayload = {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nome: "Superadministrador",
      tenant_id: null,
      role: "superadmin"
    },
    app_metadata: {
      tenant_id: null,
      role: "superadmin"
    }
  };

  const { data, error } = existing
    ? await supabase.auth.admin.updateUserById(existing.id, authPayload)
    : await supabase.auth.admin.createUser(authPayload);

  if (error) throw error;
  if (!data.user) throw new Error("Supabase Auth nao retornou usuario.");

  const profilePayload = {
    id: data.user.id,
    tenant_id: null,
    nome: "Superadministrador",
    email,
    role: "superadmin",
    ativo: true
  };

  const { data: existingProfiles, error: findProfileError } = await supabase
    .from("usuarios")
    .select("id,email")
    .eq("email", email)
    .limit(1);

  if (findProfileError) throw findProfileError;

  const existingProfile = existingProfiles?.[0];
  const { error: profileError } = existingProfile
    ? await supabase
      .from("usuarios")
      .update(profilePayload)
      .eq("id", existingProfile.id)
    : await supabase
      .from("usuarios")
      .upsert(profilePayload, { onConflict: "id" });

  if (profileError) throw profileError;

  if (publicAuthClient) {
    const { error: loginError } = await publicAuthClient.auth.signInWithPassword({ email, password });
    if (loginError) throw new Error(`Login de validacao falhou para ${email}: ${loginError.message}`);
  } else {
    console.warn("seed:superadmin validacao de login ignorada: SUPABASE_ANON_KEY ausente.");
  }

  console.log(`seed:superadmin ${existing ? "atualizado" : "criado"} email=${email}`);
  console.log("seed:superadmin finalizado. A senha nao foi exibida.");
}

await ensureSuperadmin();
