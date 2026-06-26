import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const app = read("src/App.tsx");
const layout = read("src/pages/admin/AdminLayout.tsx");
const adminStories = read("src/pages/admin/AdminStories.tsx");
const publicStories = read("src/components/StoriesSection.tsx");
const server = read("server.ts");
const adminPages = fs.readdirSync(path.join(root, "src/pages/admin"));

assert(app.includes('import("./pages/admin/AdminStories")'), "App.tsx deve lazy-load AdminStories existente.");
assert(/<Route\s+path="stories"\s+element=\{adminSection\("Stories",\s*<AdminStories\s*\/>\)\}/.test(app), "App.tsx deve manter a rota /admin/stories apontando para AdminStories.");

assert(layout.includes("PlaySquare"), "AdminLayout deve importar icone para Stories.");
assert(layout.includes('{ name: "Campanhas", path: "/admin/campanhas", icon: Ticket, group: "Marketing" }'), "Campanhas deve aparecer no grupo Marketing.");
assert(layout.includes('{ name: "Stories", path: "/admin/stories", icon: PlaySquare, group: "Marketing" }'), "Stories deve aparecer no grupo Marketing.");
assert(layout.includes('{ name: "SendPulse", path: "/admin/sendpulse", icon: Zap, group: "Marketing" }'), "SendPulse deve continuar no grupo Marketing.");
assert(!layout.includes('{ name: "Campanhas", path: "/admin/campanhas", icon: Ticket, group: "Painel" }'), "Campanhas nao deve continuar duplicada no grupo Painel.");

assert(adminStories.includes('fetch("/api/admin/stories")'), "AdminStories deve continuar consumindo o endpoint admin existente.");
assert(adminStories.includes("/api/admin/stories/${currentStory.id}"), "AdminStories deve continuar usando endpoints existentes por id.");
assert(!adminStories.includes("/api/admin/stories-v2"), "Nao deve haver endpoint novo de Stories v2.");
assert(!adminStories.includes("/api/admin/story-center"), "Nao deve haver endpoint novo de central de Stories.");

assert(publicStories.includes("fetch(\'/api/stories\')"), "StoriesSection publico deve continuar consumindo /api/stories.");
assert(server.includes('app.get("/api/stories"'), "Servidor deve manter endpoint publico de Stories.");
assert(server.includes('app.get("/api/admin/stories"'), "Servidor deve manter listagem admin de Stories.");
assert(server.includes('app.post("/api/admin/stories"'), "Servidor deve manter criacao admin de Stories.");
assert(server.includes('app.put("/api/admin/stories/:id"'), "Servidor deve manter atualizacao admin de Stories.");
assert(server.includes('app.delete("/api/admin/stories/:id"'), "Servidor deve manter remocao admin de Stories.");
assert(server.includes("adminCanAccessTenant(req, s.tenant_id)"), "Endpoints admin devem preservar verificacao multitenant existente.");

const storyAdminPages = adminPages.filter((file) => /stor/i.test(file));
assert(storyAdminPages.length === 1 && storyAdminPages[0] === "AdminStories.tsx", "Nao deve haver pagina admin duplicada de Stories.");

console.log("Stories module integration phase 10D static checks passed.");
