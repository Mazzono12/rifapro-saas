import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios para o seed.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const publicAuthClient = anonKey
  ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const devTenantId = process.env.DEFAULT_SUPABASE_TENANT_ID || "00000000-0000-0000-0000-000000000001";

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return "email-invalido";
  return `${name.slice(0, 2)}***@${domain}`;
}

const rawSeeds = [
  {
    nome: process.env.SEED_SUPERADMIN_NOME || "Superadmin Inicial",
    email: process.env.SEED_SUPERADMIN_EMAIL || process.env.SUPERADMIN_EMAIL,
    password: process.env.SEED_SUPERADMIN_PASSWORD || process.env.SUPERADMIN_PASSWORD,
    tenant_id: null,
    role: "superadmin"
  },
  {
    nome: process.env.SEED_DEV_ADMIN_NOME || "Admin Tenant Dev",
    email: process.env.SEED_DEV_ADMIN_EMAIL || "admin-dev@example.com",
    password: process.env.SEED_DEV_ADMIN_PASSWORD || "AdminDev123!",
    tenant_id: devTenantId,
    role: "admin"
  }
].filter(seed => seed.email && seed.password);

const seedsByEmail = new Map();
for (const seed of rawSeeds) {
  const email = seed.email.toLowerCase().trim();
  const existing = seedsByEmail.get(email);
  if (existing) {
    const keepExisting = existing.role === "superadmin";
    const chosen = keepExisting ? existing : seed;
    const skipped = keepExisting ? seed : existing;
    console.warn(`auth seed aviso: email duplicado ${maskEmail(email)}; mantendo role ${chosen.role} e ignorando role ${skipped.role}.`);
    seedsByEmail.set(email, { ...chosen, email });
    continue;
  }
  seedsByEmail.set(email, { ...seed, email });
}
const seeds = [...seedsByEmail.values()];

console.log(`auth seed inicio: ${seeds.length} usuario(s), tenant dev ${devTenantId}`);

const { error: tenantError } = await supabase
  .from("tenants")
  .upsert({
    id: devTenantId,
    nome: "Tenant Desenvolvimento",
    slug: "dev",
    dominio: null,
    ativo: true,
    plano: "starter"
  }, { onConflict: "id" });

if (tenantError) throw tenantError;
console.log("auth seed tenant dev: ok");

for (const seed of seeds) {
  const { data: foundUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = foundUsers.users.find(user => user.email?.toLowerCase() === seed.email.toLowerCase());

  let authUser = existing;
  if (authUser) {
    console.log(`auth seed usuario existente: ${maskEmail(seed.email)} (${seed.role}); atualizando senha/metadados.`);
    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
      email: seed.email,
      password: seed.password,
      email_confirm: true,
      user_metadata: {
        nome: seed.nome,
        tenant_id: seed.tenant_id,
        role: seed.role
      },
      app_metadata: {
        tenant_id: seed.tenant_id,
        role: seed.role
      }
    });
    if (updateError) throw updateError;
    authUser = updated.user;
  } else {
    console.log(`auth seed criando usuario: ${maskEmail(seed.email)} (${seed.role}).`);
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: seed.email,
      password: seed.password,
      email_confirm: true,
      user_metadata: {
        nome: seed.nome,
        tenant_id: seed.tenant_id,
        role: seed.role
      },
      app_metadata: {
        tenant_id: seed.tenant_id,
        role: seed.role
      }
    });
    if (createError) throw createError;
    authUser = created.user;
  }

  if (!authUser) throw new Error(`Nao foi possivel criar ${seed.email}`);

  const { error: upsertError } = await supabase
    .from("usuarios")
    .upsert({
      id: authUser.id,
      tenant_id: seed.tenant_id,
      nome: seed.nome,
      email: seed.email.toLowerCase(),
      role: seed.role,
      ativo: true
    }, { onConflict: "id" });

  if (upsertError) throw upsertError;
  console.log(`auth seed perfil public.usuarios: ok ${maskEmail(seed.email)} (${seed.role}, tenant=${seed.tenant_id || "platform"})`);

  if (publicAuthClient) {
    const { error: loginError } = await publicAuthClient.auth.signInWithPassword({
      email: seed.email,
      password: seed.password
    });
    if (loginError) {
      console.error(`auth seed teste login: falhou ${maskEmail(seed.email)} - ${loginError.message}`);
      throw loginError;
    }
    console.log(`auth seed teste login: ok ${maskEmail(seed.email)}`);
  } else {
    console.warn("auth seed teste login ignorado: SUPABASE_ANON_KEY ausente.");
  }
}

console.log("Seed Supabase Auth finalizado.");
