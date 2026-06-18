import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const appUrl = process.env.FINAL_VISUAL_APP_URL || "http://127.0.0.1:3000";
const debugPort = Number(process.env.FINAL_VISUAL_DEBUG_PORT || 9331);
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const screenshotsDir = resolve(root, "reports/screenshots/final-visual-theme");
const reportPath = resolve(root, "reports/final-visual-theme-audit.md");
const chromeProfileDir = resolve(root, "reports/chrome-profile-final-visual-theme");

mkdirSync(screenshotsDir, { recursive: true });

const allRoutes = [
  ["public-home", "/"],
  ["public-campaign", "/raffle/R_0EF5B344"],
  ["public-checkout-pix", "/checkout/pedido/36F15E72"],
  ["public-receipt", "/checkout/pedido/08F85F15"],
  ["public-bilhetes", "/meus-bilhetes"],
  ["public-perfil", "/perfil"],
  ["public-affiliates", "/afiliados"],
  ["public-winners", "/ganhadores"],
  ["public-login", "/login"],
  ["public-signup", "/cadastro"],
  ["customer-cotas", "/minhas-cotas"],
  ["customer-numeros", "/meus-numeros"],
  ["customer-jogos", "/meus-jogos"],
  ["admin-dashboard", "/admin"],
  ["admin-campaigns", "/admin/rifas"],
  ["admin-clients", "/admin/crm"],
  ["admin-orders", "/admin/central-pedidos"],
  ["admin-payments", "/admin/pagamentos"],
  ["admin-config", "/admin/config"],
  ["admin-integrations", "/admin/integracoes"],
  ["admin-promotions", "/admin/promocoes"],
  ["admin-gamification", "/admin/gamificacao"],
  ["admin-draws", "/admin/live-draw"],
  ["admin-super-cotas", "/admin/cotas"],
  ["superadmin-dashboard", "/superadmin"],
  ["superadmin-tenants", "/superadmin/clientes"],
  ["superadmin-plans", "/superadmin/platform-billing"],
  ["superadmin-reports", "/superadmin/relatorios"],
  ["superadmin-finance", "/superadmin/platform-billing"]
];

const group = process.env.FINAL_VISUAL_GROUP || "all";
const routes = allRoutes.filter(([id]) => {
  if (group === "all") return true;
  if (group === "public") return id.startsWith("public-") || id.startsWith("customer-");
  if (group === "admin") return id.startsWith("admin-");
  if (group === "superadmin") return id.startsWith("superadmin-");
  return id.includes(group);
});

const viewports = [
  { name: "mobile390", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1366, height: 900, mobile: false }
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout(promise, label, timeoutMs = 15000) {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => {
      throw new Error(`Timeout em ${label}`);
    })
  ]);
}

async function waitForHttp(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timeout aguardando ${url}`);
}

function startChrome() {
  rmSync(chromeProfileDir, { recursive: true, force: true });
  return spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfileDir}`,
    "--no-first-run",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        return;
      }
      for (const listener of this.events.get(msg.method) || []) listener(msg.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  once(method) {
    return new Promise(resolve => {
      const listener = params => {
        const list = this.events.get(method) || [];
        this.events.set(method, list.filter(item => item !== listener));
        resolve(params);
      };
      this.events.set(method, [...(this.events.get(method) || []), listener]);
    });
  }

  on(method, listener) {
    this.events.set(method, [...(this.events.get(method) || []), listener]);
  }

  close() {
    this.ws.close();
  }
}

async function newPage() {
  const res = await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" });
  const target = await res.json();
  const page = new Cdp(target.webSocketDebuggerUrl);
  page.targetId = target.id;
  await page.open();
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  page.runtimeErrors = [];
  page.on("Runtime.exceptionThrown", params => {
    page.runtimeErrors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Runtime exception");
  });
  return page;
}

async function closePage(page) {
  try {
    page?.close();
  } catch {}
}

async function navigate(page, url, viewport) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
    mobile: viewport.mobile
  });
  const loaded = page.once("Page.loadEventFired");
  await page.send("Page.navigate", { url });
  await Promise.race([
    loaded,
    delay(10000).then(() => {
      throw new Error(`Timeout ao carregar ${url}`);
    })
  ]);
  await delay(1300);
}

async function evalJs(page, expression) {
  const result = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Erro no navegador");
  }
  return result.result.value;
}

async function screenshot(page, fileName) {
  const shot = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = join(screenshotsDir, `${fileName}.png`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
}

const auditExpression = `
(() => {
  const parse = value => {
    const match = String(value || '').match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const parts = match[1].split(',').map(item => Number.parseFloat(item.trim()));
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
  };
  const hue = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    if (!d) return { h: 0, s: 0, l: (max + min) / 2 };
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    const l = (max + min) / 2;
    const s = d / (1 - Math.abs(2 * l - 1));
    return { h, s, l };
  };
  const isQr = el => {
    const text = [el.className, el.id, el.getAttribute('aria-label'), el.alt].join(' ').toLowerCase();
    return text.includes('qr') || text.includes('qrcode') || el.closest('.cfx-qr-wrap,.cp-qr-wrap,[class*="qr"],[class*="QR"]');
  };
  const selector = el => {
    if (el.id) return '#' + el.id;
    const cls = String(el.className || '').split(/\\s+/).filter(Boolean).slice(0, 3).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const visible = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const bright = [];
  const legacy = [];
  const lowContrast = [];
  const all = [...document.querySelectorAll('body, body *')].filter(visible);
  for (const el of all) {
    if (isQr(el) || ['IMG', 'VIDEO', 'CANVAS', 'SVG', 'PATH'].includes(el.tagName)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const colors = [
      ['background', parse(s.backgroundColor)],
      [Number.parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none' ? 'border-top' : '', parse(s.borderTopColor)],
      ['color', parse(s.color)]
    ].filter(([kind, c]) => kind && c && c.a > 0.35);
    const bg = parse(s.backgroundColor);
    if (bg && bg.a > 0.65 && (bg.r + bg.g + bg.b) / 3 > 218 && r.width * r.height > 900) {
      bright.push({ selector: selector(el), color: s.backgroundColor, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70) });
    }
    for (const [kind, c] of colors) {
      const hs = hue(c);
      const average = (c.r + c.g + c.b) / 3;
      const isAllowedWhiteOrMuted = average > 198 && hs.s < 0.42;
      if (!isAllowedWhiteOrMuted && hs.s > 0.34 && hs.l > 0.18 && hs.l < 0.84 && hs.h >= 178 && hs.h <= 285) {
        legacy.push({ selector: selector(el), kind, color: kind === 'color' ? s.color : kind === 'background' ? s.backgroundColor : s.borderTopColor, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70) });
      }
    }
    const fg = parse(s.color);
    if (bg && fg && bg.a > 0.85 && fg.a > 0.85) {
      const diff = Math.abs(bg.r - fg.r) + Math.abs(bg.g - fg.g) + Math.abs(bg.b - fg.b);
      if (diff < 80 && (el.textContent || '').trim().length > 2) {
        lowContrast.push({ selector: selector(el), bg: s.backgroundColor, color: s.color, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70) });
      }
    }
  }
  const bodyText = document.body.innerText.replace(/\\s+/g, ' ').trim();
  return {
    title: document.title,
    path: location.pathname,
    viewport: innerWidth + 'x' + innerHeight,
    bodyText: bodyText.slice(0, 220),
    loginBlocked: /Entrar na sua conta|Conferindo acesso|Use o CPF|Área do cliente/.test(bodyText),
    runtimeBlueScreen: /Não foi possível acessar|instabilidade|Unexpected token|is not valid JSON/.test(bodyText),
    horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 3,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    innerWidth,
    bright: bright.slice(0, 8),
    legacy: legacy.slice(0, 12),
    lowContrast: lowContrast.slice(0, 8)
  };
})()
`;

function describeProblems(audit) {
  const problems = [];
  if (audit.runtimeBlueScreen) problems.push("Tela de erro/instabilidade detectada");
  if (audit.horizontalOverflow) problems.push(`Overflow horizontal (${audit.scrollWidth}px > ${audit.innerWidth}px)`);
  if (audit.bright.length) problems.push(`${audit.bright.length} superfície(s) clara(s) visíveis`);
  if (audit.legacy.length) problems.push(`${audit.legacy.length} cor(es) azul/ciano/roxo visíveis`);
  if (audit.lowContrast.length) problems.push(`${audit.lowContrast.length} possível(is) baixo contraste`);
  if (audit.loginBlocked) problems.push("Rota protegida renderizou estado de login/fallback; conteúdo interno não auditado nesta sessão");
  return problems;
}

function writeReport(audits) {
  const lines = [
    "# Auditoria visual final: caça a resquícios do tema antigo",
    "",
    `Base renderizada: \`${appUrl}\``,
    `Screenshots: \`reports/screenshots/final-visual-theme/\``,
    "",
    "## Resultado por tela",
    ""
  ];
  for (const audit of audits) {
    const problems = describeProblems(audit);
    lines.push(`### ${audit.id} (${audit.viewport})`);
    lines.push(`- Rota: \`${audit.route}\``);
    lines.push(`- Screenshot: \`${audit.file}\``);
    if (audit.screenshotError) lines.push(`- Observação de captura: ${audit.screenshotError}`);
    lines.push(`- Estado: ${problems.length ? problems.join("; ") : "sem resquícios críticos detectados na renderização"}`);
    if (audit.bright.length) lines.push(`- Superfícies claras: ${audit.bright.map(item => `${item.selector} ${item.color}`).join("; ")}`);
    if (audit.legacy.length) lines.push(`- Azul/ciano/roxo: ${audit.legacy.map(item => `${item.selector} ${item.kind} ${item.color}`).join("; ")}`);
    if (audit.lowContrast.length) lines.push(`- Contraste: ${audit.lowContrast.map(item => `${item.selector} ${item.color} sobre ${item.bg}`).join("; ")}`);
    lines.push("");
  }
  const actionable = audits.flatMap(audit => describeProblems(audit).filter(problem => !problem.includes("Rota protegida")));
  lines.push("## Síntese");
  lines.push("");
  lines.push(actionable.length ? `Foram encontrados ${actionable.length} apontamentos visuais que exigem revisão.` : "Nenhum resquício crítico foi detectado nas telas renderizadas acessíveis.");
  lines.push("");
  lines.push("## Escopo preservado");
  lines.push("");
  lines.push("A auditoria não altera PIX, Asaas, webhook, pagamentos, checkout lógico, reservas, cotas, afiliados, ranking, Supabase, RLS ou APIs.");
  writeFileSync(reportPath, lines.join("\n"));
}

let chrome;
const audits = [];

try {
  await waitForHttp(appUrl);
  chrome = startChrome();
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
  for (const viewport of viewports) {
    const page = await newPage();
    try {
      for (const [id, route] of routes) {
        console.log(`[FINAL_VISUAL_AUDIT] ${id} ${viewport.name}`);
        await navigate(page, `${appUrl}${route}`, viewport);
        const fileName = `${id}-${viewport.name}`;
        const audit = await withTimeout(evalJs(page, auditExpression), `audit ${fileName}`, 20000);
        let file = `reports/screenshots/final-visual-theme/${fileName}.png`;
        let screenshotError = "";
        if (id === "public-checkout-pix" || id === "public-receipt") {
          screenshotError = "captura pulada para evitar travamento CDP em pagina com QR/recibo; DOM renderizado foi auditado";
          file = `captura dispensada: ${screenshotError}`;
        } else {
          try {
            await withTimeout(screenshot(page, fileName), `screenshot ${fileName}`, 30000);
          } catch (error) {
            screenshotError = error.message || String(error);
            file = `captura indisponivel: ${screenshotError}`;
          }
        }
        audits.push({ ...audit, id, route, file, screenshotError });
      }
    } finally {
      await closePage(page);
    }
  }
  writeReport(audits);
  const critical = audits.flatMap(audit => describeProblems(audit).filter(problem => !problem.includes("Rota protegida")));
  console.log(JSON.stringify({ ok: critical.length === 0, reportPath, screenshotsDir, audited: audits.length, critical }, null, 2));
  assert.equal(critical.length, 0, "Auditoria visual encontrou resquícios: " + critical.join(" | "));
} finally {
  if (chrome) chrome.kill();
}
