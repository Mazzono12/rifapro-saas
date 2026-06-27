import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const server = read('server.ts');
const authSession = read('src/lib/authSession.ts');
const authStore = read('src/store/useAuthStore.ts');

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const includes = (text, fragment, message) => assert(text.includes(fragment), message);

includes(server, 'ASAAS_WEBHOOK_TOKEN || process.env.WEBHOOK_SECRET', 'Webhook production validation must require ASAAS_WEBHOOK_TOKEN or WEBHOOK_SECRET.');
includes(server, 'process.env.ASAAS_WEBHOOK_TOKEN || process.env.WEBHOOK_SECRET || ""', 'Asaas gateway config must accept WEBHOOK_SECRET fallback.');
includes(server, 'ALLOW_SINGLE_INSTANCE_PRODUCTION', 'Production single-instance bypass variable must be enforced.');
includes(server, 'Produção pública exige MULTI_INSTANCE_SAFE=true ou execução single instance explicitamente confirmada.', 'Production single-instance blocker message must be explicit.');
includes(server, 'process.env.REDIS_URL || process.env.RATE_LIMIT_REDIS_URL', 'Multi-instance production must require shared rate-limit storage.');
includes(server, 'MULTI_INSTANCE_SAFE=true exige REDIS_URL ou RATE_LIMIT_REDIS_URL', 'Multi-instance shared rate-limit error must be explicit.');

const brandingUploadStart = server.indexOf('async function saveBrandingAsset');
const brandingUploadEnd = server.indexOf('const uploadsDir', brandingUploadStart);
const brandingUpload = server.slice(brandingUploadStart, brandingUploadEnd);
includes(brandingUpload, 'SVG não é permitido por segurança. Use PNG, JPG ou WebP.', 'Branding upload must reject SVG in production with the required friendly message.');
includes(brandingUpload, 'isProductionRuntime', 'Branding upload allowlist must branch by production runtime.');
includes(brandingUpload, '? new Set([".jpg", ".jpeg", ".png", ".webp"])', 'Production branding upload must allow only png/jpg/jpeg/webp extensions.');
includes(brandingUpload, '? new Set(["image/jpeg", "image/png", "image/webp"])', 'Production branding upload must allow only safe image MIME types.');
includes(brandingUpload, 'contentType === "image/svg+xml"', 'Branding upload must explicitly identify SVG MIME.');
assert(!brandingUpload.includes('SVG seguro') || brandingUpload.includes(': "Formato nao suportado. Use PNG, JPG, JPEG, WEBP, SVG seguro ou GIF animado."'), 'SVG must not be presented as production-safe.');

includes(authSession, 'function sanitizeStoredAuthSession', 'Auth session storage must sanitize persisted session.');
includes(authSession, 'refresh_token: ""', 'Persisted auth session must not keep refresh_token.');
includes(authSession, 'email: ""', 'Persisted auth session must not keep user email.');
includes(authSession, 'localStorage.removeItem(supportSessionStorageKey)', 'setStoredAuthSession(null) must clear support session id.');
includes(authSession, 'JSON.stringify(safeSession)', 'Auth session must persist sanitized session only.');

includes(authStore, 'sanitizeStoredMockSession', 'Legacy auth store must sanitize mock session storage.');
includes(authStore, 'localStorage.removeItem(authStorageKey)', 'Logout/invalid token must clear canonical auth session storage.');
includes(authStore, 'localStorage.removeItem(supportSessionStorageKey)', 'Logout/invalid token must clear support session id.');
assert(!authStore.includes('JSON.stringify({ user: data.user, profile: data.profile })'), 'Login must not persist full user/profile payload.');
assert(!authStore.includes('JSON.stringify(session));'), 'Session refresh must not persist full session payload.');

if (failures.length) {
  console.error('Security production blockers hard test failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security production blockers hard test passed.');