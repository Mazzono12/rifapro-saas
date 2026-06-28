import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

assert(server.includes("app.set(\"trust proxy\", 1)"), "trust proxy configuravel existe");
assert(server.includes("process.env.TRUST_PROXY"), "TRUST_PROXY controla trust proxy fora de producao");
assert(server.includes("X-Content-Type-Options") && server.includes("nosniff"), "X-Content-Type-Options esta configurado");
assert(server.includes("X-Frame-Options") && server.includes("SAMEORIGIN"), "X-Frame-Options esta configurado");
assert(server.includes("Referrer-Policy") && server.includes("strict-origin-when-cross-origin"), "Referrer-Policy esta configurado");
assert(server.includes("Permissions-Policy"), "Permissions-Policy esta configurado");
assert(server.includes("Content-Security-Policy"), "CSP basica esta configurada");
assert(server.includes("default-src 'self'"), "CSP define default-src self");
assert(server.includes("object-src 'none'"), "CSP bloqueia object-src");
assert(server.includes("frame-ancestors 'self'"), "CSP restringe frame-ancestors");
assert(server.includes("Strict-Transport-Security") && server.includes("isNodeProduction"), "HSTS e aplicado somente em producao");

if (process.exitCode) process.exit(process.exitCode);
