import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const hardSuite = readFileSync("scripts/test-hard-suite.mjs", "utf8");

for (const token of [
  "let persistentStateDirty = false",
  "let persistentStateDirtyReason = \"\"",
  "if (persistentStateSaving) {",
  "persistentStateDirty = true",
  "schedulePersistentStateSave(dirtyReason, 0)",
  "memoryStateRisk",
  "persistenceMode",
  "productionSafe",
  "singleProcessSafe: true",
  "multiInstanceSafe: false"
]) {
  assert.ok(server.includes(token), `server.ts deve conter ${token}`);
}

assert.match(
  server,
  /if \(isNodeProduction && memoryStateRisk && !process\.env\.RIFAPRO_TEST_MODE\) \{[\s\S]*process\.exit\(1\);[\s\S]*\}/,
  "Producao deve falhar se STORAGE_DRIVER nao for postgres/persistent."
);
assert.match(
  server,
  /persistentStateSaving = true;[\s\S]*persistentStateDirty = false;[\s\S]*finally \{[\s\S]*persistentStateSaving = false;[\s\S]*if \(persistentStateDirty\)/,
  "persistAllState deve limpar dirty no inicio e salvar novamente se alteracao chegou durante save."
);
assert.ok(
  hardSuite.includes("singleProcessSafe: true") && hardSuite.includes("multiInstanceSafe: false"),
  "Relatorios hard devem declarar risco multi-instancia."
);

console.log("PASS: dirty save reprograma persistencia e relatorios indicam singleProcessSafe=true/multiInstanceSafe=false.");
