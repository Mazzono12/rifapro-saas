import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const app = read("src/App.tsx");
const rifas = read("src/pages/admin/AdminRifasModule.tsx");
const modalidades = read("src/pages/admin/AdminModalidades.tsx");
const fazendinha = read("src/pages/admin/AdminFazendinha.tsx");
const dezena = read("src/pages/admin/AdminDezena.tsx");
const centena = read("src/pages/admin/AdminCentena.tsx");
const milhar = read("src/pages/admin/AdminMilhar.tsx");
const roleta = read("src/pages/admin/AdminRoletaPremiada.tsx");
const caixinha = read("src/pages/admin/AdminCaixinhaPremiada.tsx");
const raspadinha = read("src/pages/admin/AdminRaspadinha.tsx");

for (const [route, component] of [
  ["rifas", "AdminRifas"], ["dezena", "AdminDezena"], ["centena", "AdminCentena"],
  ["milhar", "AdminMilhar"], ["fazendinha", "AdminFazendinha"],
  ["roleta-premiada", "AdminRoletaPremiada"], ["caixinha-premiada", "AdminCaixinhaPremiada"],
  ["raspadinha", "AdminRaspadinha"]
]) {
  assert(app.includes(`<Route path="${route}"`) && app.includes(`<${component} />`), `${route} usa pagina propria`);
}

assert(dezena.includes('modeFilter="dezena"'), "Dezena filtra somente sua modalidade");
assert(centena.includes('modeFilter="centena"'), "Centena filtra somente sua modalidade");
assert(milhar.includes('modeFilter="milhar"'), "Milhar filtra somente sua modalidade");

for (const [name, source] of [["Rifas", rifas], ["Modalidades numericas", modalidades], ["Fazendinha", fazendinha]]) {
  assert(!/LootboxRulesEditor|RewardExperienceSelector|VideoSettingsEditor|Player isolado/i.test(source), `${name} nao expoe configuracao misturada`);
  assert(!/type=["']color["']|color picker|paleta|palette|autoplay|\bloop\b/i.test(source), `${name} nao expoe cor, paleta ou player avancado`);
}

assert(!/checkoutMedia|homeBanner|PremiumExperienceEditor|MediaSettingsEditor/.test(fazendinha), "Fazendinha nao expoe midia tecnica ou experiencia da Caixinha");
assert(!/Caixinha Premiada|Roleta Premiada|Raspadinha/.test(rifas), "Rifas nao configura outras modalidades");
assert(!/Caixinha Premiada|Roleta Premiada|Raspadinha/.test(modalidades), "Dezena, Centena e Milhar nao configuram outras modalidades");

for (const [name, source, terms] of [
  ["Roleta", roleta, ["Ativacao e vinculo", "Premios e chances", "Regras", "Historico", "Status"]],
  ["Caixinha", caixinha, ["Ativacao e vinculo", "Premios", "Quantidade", "Regras", "Historico e status"]],
  ["Raspadinha", raspadinha, ["Ativacao e vinculo", "Premios", "Quantidade", "Regras", "Historico e status"]]
]) {
  for (const term of terms) assert(source.includes(term), `${name} contem ${term}`);
  assert(!/type=["']color["']|color picker|paleta|palette|autoplay|\bloop\b|VideoSettingsEditor/i.test(source), `${name} nao possui customizacao visual ou player avancado`);
}

console.log("OK: Fase 10A mantém cada modalidade em sua propria fronteira de configuracao.");