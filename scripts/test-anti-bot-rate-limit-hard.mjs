import { readFileSync } from "node:fs";

const server = readFileSync("server.ts", "utf8");
const raffleDetails = readFileSync("src/pages/RaffleDetails.tsx", "utf8");
const api = readFileSync("src/services/api.ts", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

assert(server.includes("function enforceCheckoutAbuseLimits"), "checkout possui limitador anti-bot composto");
assert(server.includes("checkout:cpf:"), "checkout possui limitador por CPF normalizado");
assert(server.includes("checkout:phone:"), "checkout possui limitador por telefone normalizado");
assert(server.includes("checkout:tenant-campaign:"), "checkout possui limitador por tenant + campanha");
assert(server.includes("success: false, code: \"RATE_LIMITED\""), "resposta RATE_LIMITED padronizada existe");
assert(server.includes("code: \"BOT_DETECTED\""), "honeypot retorna BOT_DETECTED");
assert(server.includes("isCheckoutHoneypotFilled(req.body || {})"), "honeypot e verificado no backend");

const raffleBuyIndex = server.indexOf("app.post(\"/api/raffles/:id/buy\"");
const raffleLimitIndex = server.indexOf("enforceCheckoutAbuseLimits(req, res, { tenantId, campaignId: id", raffleBuyIndex);
const rafflePixIndex = server.indexOf("attachActiveGatewayPixToOrder", raffleBuyIndex);
assert(raffleBuyIndex >= 0 && raffleLimitIndex > raffleBuyIndex && rafflePixIndex > raffleLimitIndex, "rifa aplica limitador antes de criar PIX");

const modeBuyIndex = server.indexOf("app.post(\"/api/modalidades/:mode/buy\"");
const modeLimitIndex = server.indexOf("enforceCheckoutAbuseLimits(req, res, { tenantId, campaignId: mode", modeBuyIndex);
const modeLockIndex = server.indexOf("withCriticalReservationLocks", modeBuyIndex);
assert(modeBuyIndex >= 0 && modeLimitIndex > modeBuyIndex && modeLockIndex > modeLimitIndex, "modalidades aplicam limitador antes da reserva");

const fazFunctionIndex = server.indexOf("async function createFazendinhaPurchase");
const fazLimitIndex = server.indexOf("enforceCheckoutAbuseLimits(req, res, { tenantId, campaignId: `fazendinha:", fazFunctionIndex);
const fazExpireIndex = server.indexOf("expireFazendinhaReservations", fazFunctionIndex);
assert(fazFunctionIndex >= 0 && fazLimitIndex > fazFunctionIndex && fazExpireIndex > fazLimitIndex, "Fazendinha aplica limitador antes da reserva");

assert(server.includes("credentialRateLimiter") && server.includes("app.post(\"/api/auth/login\", rateLimiter, credentialRateLimiter"), "login publico/admin usa credentialRateLimiter");
assert(server.includes("app.post(\"/api/auth/admin/login\", rateLimiter, credentialRateLimiter"), "admin login usa credentialRateLimiter");
assert(server.includes("app.post(\"/api/customers/login\", credentialRateLimiter"), "login de cliente usa credentialRateLimiter");
assert(server.includes("app.post(\"/api/customers/password-reset/request\", credentialRateLimiter"), "reset de cliente usa credentialRateLimiter");
assert(server.includes("app.post(\"/api/auth/reset-password\", rateLimiter, credentialRateLimiter"), "reset auth usa credentialRateLimiter");

assert(raffleDetails.includes("const [checkoutHoneypot, setCheckoutHoneypot]"), "checkout da rifa possui estado de honeypot");
assert(raffleDetails.includes("name=\"companyWebsite\""), "checkout da rifa possui campo honeypot invisivel");
assert(raffleDetails.includes("companyWebsite: checkoutHoneypot"), "checkout da rifa envia honeypot ao backend");
assert(api.includes("companyWebsite: \"\""), "servicos de modalidades/Fazendinha enviam honeypot vazio");

if (process.exitCode) process.exit(process.exitCode);
