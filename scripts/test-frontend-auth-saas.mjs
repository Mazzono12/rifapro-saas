import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const app = read("src/App.tsx");
const context = read("src/context/auth/AuthContext.tsx");
const session = read("src/lib/authSession.ts");
const protectedRoute = read("src/components/auth/ProtectedRoute.tsx");
const login = read("src/pages/auth/Login.tsx");
const signup = read("src/pages/auth/Signup.tsx");
const recover = read("src/pages/auth/RecoverPassword.tsx");
const profile = read("src/pages/auth/Profile.tsx");

assert(app.includes("<AuthProvider>"), "App usa AuthProvider global");
for (const route of ["/login", "/cadastro", "/recuperar-senha", "/perfil-saas", "/painel", "/afiliado"]) {
  assert(app.includes(`path=\"${route}\"`), `rota ${route} registrada`);
}
assert(app.includes('roles={["superadmin", "admin"]}'), "admin route protegida por role");
assert(app.includes('roles={["superadmin"]}'), "superadmin route protegida por role");

for (const endpoint of ["/api/auth/login", "/api/auth/signup", "/api/auth/logout", "/api/auth/refresh", "/api/auth/me", "/api/auth/reset-password"]) {
  assert(context.includes(endpoint), `AuthContext consome ${endpoint}`);
}

for (const field of ["access_token", "refresh_token", "profile", "tenant_id", "role"]) {
  assert(context.includes(field) || session.includes(field), `sessao persiste ${field}`);
}

assert(session.includes("installAuthFetchMiddleware"), "middleware frontend de fetch existe");
assert(session.includes("Authorization"), "middleware injeta Authorization");
assert(session.includes("isTokenExpiring"), "verificacao de expiracao existe");
assert(context.includes("setInterval"), "refresh automatico periodico existe");
assert(context.includes("rifapro:auth-error"), "tratamento global de erro auth existe");
assert(protectedRoute.includes("ProtectedRoute"), "ProtectedRoute criado");
assert(protectedRoute.includes("RoleGuard"), "RoleGuard criado");
assert(login.includes("auth.login"), "Login consome contexto");
assert(signup.includes("auth.signup"), "Cadastro consome contexto");
assert(recover.includes("auth.recoverPassword"), "Recuperacao consome contexto");
assert(profile.includes("auth.logout"), "Perfil implementa logout");

for (const file of [
  "src/App.tsx",
  "src/context/auth/AuthContext.tsx",
  "src/lib/authSession.ts",
  "src/pages/auth/Login.tsx",
  "src/pages/auth/Signup.tsx",
  "src/pages/auth/RecoverPassword.tsx",
  "src/pages/auth/Profile.tsx"
]) {
  const content = read(file);
  assert(!content.includes("SERVICE_ROLE_KEY") && !content.includes("SERVICE_ROLE"), `${file} nao expoe service role`);
}

console.log("PASS: frontend auth SaaS com login, logout, refresh, roles, rotas protegidas e persistencia validado estaticamente.");
