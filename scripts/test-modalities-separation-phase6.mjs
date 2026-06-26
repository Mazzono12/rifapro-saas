import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
};

const app = read("src/App.tsx");
const campaigns = read("src/pages/admin/AdminRaffles.tsx");
const rifas = read("src/pages/admin/AdminRifas.tsx");
const rifasModule = read("src/pages/admin/AdminRifasModule.tsx");
const modalidades = read("src/pages/admin/AdminModalidades.tsx");
const dezena = read("src/pages/admin/AdminDezena.tsx");
const centena = read("src/pages/admin/AdminCentena.tsx");
const milhar = read("src/pages/admin/AdminMilhar.tsx");
const roleta = read("src/pages/admin/AdminRoletaPremiada.tsx");

const requiredRoutes = [
  ["rifas", "AdminRifas"],
  ["campanhas", "AdminRaffles"],
  ["dezena", "AdminDezena"],
  ["centena", "AdminCentena"],
  ["milhar", "AdminMilhar"],
  ["fazendinha", "AdminFazendinha"],
  ["roleta-premiada", "AdminRoletaPremiada"],
  ["caixinha-premiada", "AdminCaixinhaPremiada"],
  ["raspadinha", "AdminRaspadinha"]
];

for (const [path, component] of requiredRoutes) {
  assert(app.includes(`path="${path}"`) && app.includes(`<${component} />`), `rota /admin/${path} aponta para ${component}`);
}

assert(campaigns.includes("Central geral") && campaigns.includes("Configuracoes internas ficam nos modulos independentes"), "Campanhas virou central geral de listagem");
assert(campaigns.includes("Buscar por nome") && campaigns.includes("Todos os status") && campaigns.includes("Todas as modalidades"), "Campanhas tem busca e filtros de status/modalidade");
assert(!campaigns.includes("normalizeRafflePixDraft") && !campaigns.includes("LootboxRulesEditor") && !campaigns.includes("MediaPicker"), "Campanhas nao edita PIX, midias ou premiacoes internas");
assert(rifas.includes("AdminRifasModule") && rifasModule.includes("export function AdminRifasModule"), "Rifa Tradicional usa modulo proprio");
assert(rifasModule.includes("normalizeRafflePixDraft") && rifasModule.includes("RankingPrizeEditor") && rifasModule.includes("LootboxRulesEditor"), "Modulo de Rifas preserva configuracoes existentes da rifa tradicional");
assert(modalidades.includes("modeFilter") && modalidades.includes("visibleConfigs"), "AdminModalidades aceita filtro por modalidade numerica");
assert(dezena.includes('modeFilter="dezena"'), "Dezena renderiza apenas Dezena");
assert(centena.includes('modeFilter="centena"'), "Centena renderiza apenas Centena");
assert(milhar.includes('modeFilter="milhar"'), "Milhar renderiza apenas Milhar");
assert(!roleta.toLowerCase().includes("paleta") && !roleta.toLowerCase().includes("tema da roleta"), "Roleta Premiada nao reintroduz paleta/tema visual avancado");

const protectedFiles = ["src/pages/CheckoutOrderResume.tsx", "src/pages/RaffleDetails.tsx", "server.ts"];
for (const file of protectedFiles) {
  assert(read(file).length > 0, `${file} permanece presente para validacao de nao remocao`);
}

console.log("Fase 6 static checks completed.");

