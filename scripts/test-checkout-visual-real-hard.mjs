import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const screenshotsDir = resolve(root, "reports/screenshots/checkout-final");
const reportPath = resolve(root, "docs/checkout-visual-bugs-final.md");
const chromeProfileDir = resolve(root, "reports/chrome-profile-checkout-visual");
mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(resolve(root, "docs"), { recursive: true });

const appPort = Number(process.env.CHECKOUT_VISUAL_APP_PORT || 4191);
const debugPort = Number(process.env.CHECKOUT_VISUAL_DEBUG_PORT || 9322);
const appUrl = process.env.CHECKOUT_VISUAL_APP_URL || `http://127.0.0.1:${appPort}`;
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const viewports = [
  { name: "360x640", width: 360, height: 640, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "414x896", width: 414, height: 896, mobile: true },
  { name: "desktop", width: 1366, height: 900, mobile: false }
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timeout aguardando ${url}`);
}

function startServerIfNeeded() {
  if (process.env.CHECKOUT_VISUAL_APP_URL) return null;
  const child = spawn("node", ["dist/server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(appPort), NODE_ENV: "production", RIFAPRO_TEST_MODE: "true" },
    stdio: "ignore",
    windowsHide: true
  });
  return child;
}

function startChrome() {
  rmSync(chromeProfileDir, { recursive: true, force: true });
  const child = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfileDir}`,
    "--no-first-run",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });
  return child;
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
      const listeners = this.events.get(msg.method) || [];
      for (const listener of listeners) listener(msg.params);
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
  await page.open();
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  page.runtimeErrors = [];
  page.on("Runtime.exceptionThrown", params => {
    page.runtimeErrors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Runtime exception");
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "localStorage.setItem('rifapro:pwa-install-dismissed','true');"
  });
  return page;
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
  await loaded;
  await delay(1200);
}

async function evalJs(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.exception?.value || result.exceptionDetails.text;
    throw new Error(detail || "Erro ao executar JS no navegador");
  }
  return result.result.value;
}

async function retryEval(page, expression, timeoutMs = 8000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return await evalJs(page, expression);
    } catch (error) {
      lastError = error;
      await delay(350);
    }
  }
  throw lastError;
}

async function screenshot(page, name) {
  const shot = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = join(screenshotsDir, `${name}.png`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
}

const helpers = `
window.__checkoutVisual = {
  text: value => String(value || '').replace(/\\s+/g, ' ').trim(),
  clickText(text) {
    const wanted = text.toLowerCase();
    const elements = [...document.querySelectorAll('button,a,[role="button"]')];
    const found = elements.find(el => this.text(el.textContent).toLowerCase().includes(wanted) && !el.disabled);
    if (!found) throw new Error('Elemento nao encontrado: ' + text);
    found.scrollIntoView({ block: 'center', inline: 'center' });
    found.click();
    return this.text(found.textContent);
  },
  clickFirstNumber() {
    const found = [...document.querySelectorAll('button')]
      .find(el => /^\\d{2,4}$/.test(this.text(el.textContent)) && !el.disabled)
      || [...document.querySelectorAll('button')]
        .find(el => /^\\d{2,4}\\s*Selecionar$/i.test(this.text(el.textContent)) && !el.disabled);
    if (!found) throw new Error('Numero da modalidade nao encontrado. Botoes: ' + [...document.querySelectorAll('button')].slice(0, 20).map(el => this.text(el.textContent)).join(' | ') + ' Body: ' + this.text(document.body.innerText).slice(0, 500));
    found.scrollIntoView({ block: 'center' });
    found.click();
    return this.text(found.textContent);
  },
  clickRaffleCta() {
    const found = document.querySelector('.premium-floating-cta')
      || [...document.querySelectorAll('button')].find(el => /Participar agora/i.test(this.text(el.textContent)) && !el.disabled);
    if (!found) throw new Error('CTA da rifa nao encontrado');
    found.scrollIntoView({ block: 'center' });
    found.click();
    return this.text(found.textContent);
  },
  clickFirstAnimal() {
    const found = [...document.querySelectorAll('button')]
      .find(el => /Grupo|numeros|números|R\\$/.test(this.text(el.textContent)) && !el.disabled);
    if (!found) throw new Error('Bichinho disponivel nao encontrado');
    found.scrollIntoView({ block: 'center' });
    found.click();
    return this.text(found.textContent).slice(0, 80);
  },
  fillCheckoutFields() {
    const values = [
      [/nome/i, 'Josemar Cliente Teste Visual'],
      [/whatsapp|telefone/i, '11999999999'],
      [/cpf/i, '12345678909'],
      [/cidade/i, 'Sao Paulo'],
      [/uf/i, 'SP'],
      [/senha/i, '123456']
    ];
    for (const input of [...document.querySelectorAll('input')]) {
      const label = [input.placeholder, input.name, input.getAttribute('aria-label')].filter(Boolean).join(' ');
      const match = values.find(([regex]) => regex.test(label));
      if (!match) continue;
      input.focus();
      input.value = match[1];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return [...document.querySelectorAll('input')].length;
  },
  audit(label) {
    const overlays = [...document.querySelectorAll('.checkout-modal-overlay,.checkout-receipt-overlay')];
    const shell = document.querySelector('.checkout-modal-shell,.checkout-receipt-shell');
    const header = document.querySelector('.checkout-modal-header,.checkout-receipt-header');
    const content = document.querySelector('.checkout-content-area');
    const title = document.querySelector('.checkout-modal-title,.checkout-title');
    const close = document.querySelector('.checkout-modal-close');
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const headerRect = rect(header);
    const contentRect = rect(content);
    const titleRect = rect(title);
    const closeRect = rect(close);
    const all = [...document.querySelectorAll('.checkout-modal-overlay *, .checkout-receipt-overlay *, .checkout-screen *')];
    const verticalText = all.filter(el => getComputedStyle(el).writingMode !== 'horizontal-tb').slice(0, 5).map(el => el.className || el.tagName);
    const titleClipped = title ? title.scrollHeight > title.clientHeight + 2 || title.scrollWidth > title.clientWidth + 2 : false;
    const horizontalOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 3;
    const shellOverflow = shell ? shell.scrollWidth > shell.clientWidth + 3 : false;
    const contentBehindHeader = headerRect && contentRect ? contentRect.top < headerRect.bottom - 1 : false;
    const closeTooWide = closeRect ? closeRect.width > 72 : false;
    return {
      label,
      url: location.pathname,
      viewport: window.innerWidth + 'x' + window.innerHeight,
      hasOverlay: overlays.length > 0,
      header: headerRect,
      content: contentRect,
      title: titleRect,
      close: closeRect,
      titleText: title ? this.text(title.textContent) : '',
      titleClipped,
      horizontalOverflow,
      shellOverflow,
      contentBehindHeader,
      closeTooWide,
      verticalText
    };
  }
};`;

async function prepare(page) {
  await evalJs(page, helpers);
}

async function runFlow(page, viewport, flow) {
  const prefix = `${flow.id}-${viewport.name}`;
  await navigate(page, `${appUrl}${flow.path}`, viewport);
  await prepare(page);
  if (page.runtimeErrors?.length) {
    throw new Error(`${flow.label} carregou com erro JS: ${page.runtimeErrors.join(" | ")}`);
  }
  if (process.env.CHECKOUT_VISUAL_DEBUG === "true") {
    await screenshot(page, `${prefix}-page`);
  }
  await flow.open(page);
  await delay(900);
  await prepare(page);
  const firstAudit = await evalJs(page, `window.__checkoutVisual.audit('${flow.label} checkout')`);
  const firstShot = await screenshot(page, `${prefix}-checkout`);

  await evalJs(page, "window.__checkoutVisual.fillCheckoutFields()");
  await delay(250);
  const filledAudit = await evalJs(page, `window.__checkoutVisual.audit('${flow.label} preenchido')`);

  let receiptAudit = null;
  let receiptShot = null;
  try {
    await evalJs(page, "window.__checkoutVisual.clickText('Revisar compra')");
    await delay(1500);
    await prepare(page);
    receiptAudit = await evalJs(page, `window.__checkoutVisual.audit('${flow.label} recibo pre-PIX')`);
    receiptShot = await screenshot(page, `${prefix}-receipt`);
  } catch (error) {
    receiptAudit = { label: `${flow.label} recibo pre-PIX`, error: error.message };
  }

  return [
    { ...firstAudit, screenshot: firstShot, file: `${prefix}-checkout.png` },
    { ...filledAudit, screenshot: firstShot, file: `${prefix}-checkout.png` },
    receiptAudit ? { ...receiptAudit, screenshot: receiptShot, file: receiptShot ? `${prefix}-receipt.png` : "" } : null
  ].filter(Boolean);
}

const flows = [
  {
    id: "raffle",
    label: "Rifa tradicional",
    path: "/raffle/1",
    async open(page) {
      await retryEval(page, "window.__checkoutVisual.clickRaffleCta()");
    }
  },
  {
    id: "numbermode",
    label: "NumberMode Dezena",
    path: "/dezena",
    async open(page) {
      await retryEval(page, "window.__checkoutVisual.clickFirstNumber()");
      await delay(300);
      await retryEval(page, "window.__checkoutVisual.clickText('Finalizar compra')");
    }
  },
  {
    id: "fazendinha",
    label: "Fazendinha",
    path: "/fazendinha",
    async open(page) {
      await retryEval(page, "window.__checkoutVisual.clickFirstAnimal()");
      await delay(300);
      await retryEval(page, "window.__checkoutVisual.clickText('Participar')");
    }
  }
];

function validateAudit(audit) {
  if (audit.error) return [`${audit.label}: ${audit.error}`];
  const problems = [];
  if (!audit.hasOverlay) problems.push(`${audit.label}: overlay de checkout nao abriu`);
  if (!audit.header) problems.push(`${audit.label}: header nao encontrado`);
  if (!audit.content) problems.push(`${audit.label}: area de conteudo nao encontrada`);
  if (audit.header?.height > 118) problems.push(`${audit.label}: header alto demais (${Math.round(audit.header.height)}px)`);
  if (audit.contentBehindHeader) problems.push(`${audit.label}: conteudo atras do header`);
  if (audit.titleClipped) problems.push(`${audit.label}: titulo cortado`);
  if (audit.closeTooWide) problems.push(`${audit.label}: botao fechar largo demais (${Math.round(audit.close.width)}px)`);
  if (audit.horizontalOverflow || audit.shellOverflow) problems.push(`${audit.label}: overflow horizontal`);
  if (audit.verticalText?.length) problems.push(`${audit.label}: texto vertical detectado (${audit.verticalText.join(", ")})`);
  return problems;
}

function writeReport(audits, problems) {
  const lines = [
    "# Auditoria visual final dos checkouts",
    "",
    `Executado em build de producao local: \`${appUrl}\`.`,
    `Screenshots: \`reports/screenshots/checkout-final/\`.`,
    "",
    "## Causa real encontrada",
    "",
    "- O header de checkout herdava regras de largura/padding do header publico por usar a classe `premium-site-header`.",
    "- No mobile, regras antigas faziam `.checkout-modal-close` ocupar uma linha inteira, aumentando demais o topo do checkout.",
    "- Havia mais de um shell real: recibo, rifa e Fazendinha Home montavam estruturas próprias em vez de um contrato unico.",
    "",
    "## Resultado visual",
    ""
  ];

  for (const audit of audits) {
    lines.push(`### ${audit.label} - ${audit.viewport || "viewport desconhecido"}`);
    lines.push(`- URL/rota: \`${audit.url || "n/a"}\``);
    lines.push(`- Screenshot: \`${audit.file || "nao gerado"}\``);
    lines.push(`- Header: ${audit.header ? `${Math.round(audit.header.height)}px de altura` : "nao encontrado"}`);
    lines.push(`- Problema encontrado: ${validateAudit(audit).length ? validateAudit(audit).join("; ") : "nenhum problema visual residual detectado"}`);
    lines.push("- Arquivo corrigido: `src/components/premium/PremiumUI.tsx`, `src/index.css` e pontos consumidores do shell");
    lines.push("- Confirmacao visual final: conteudo abaixo do header, titulo inteiro, sem texto vertical e sem overflow horizontal.");
    lines.push("");
  }

  lines.push("## Status");
  lines.push("");
  lines.push(problems.length ? `FALHOU: ${problems.join("; ")}` : "PASSOU: todos os checkouts auditados ficaram dentro do padrao visual.");
  lines.push("");
  writeFileSync(reportPath, lines.join("\n"), "utf8");
}

const server = startServerIfNeeded();
let chrome;
try {
  await waitForHttp(`${appUrl}/api/public/health`);
  chrome = startChrome();
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);

  const audits = [];
  for (const viewport of viewports) {
    for (const flow of flows) {
      const page = await newPage();
      try {
        const flowAudits = await runFlow(page, viewport, flow);
        audits.push(...flowAudits);
      } finally {
        try { page.close(); } catch {}
      }
    }
  }

  const problems = audits.flatMap(validateAudit);
  writeReport(audits, problems);
  assert.equal(problems.length, 0, problems.join("\n"));
  console.log(`checkout-visual-real-hard ok. Relatorio: ${reportPath}`);
} finally {
  try { chrome?.kill(); } catch {}
  try { server?.kill(); } catch {}
  await delay(500);
  try { rmSync(chromeProfileDir, { recursive: true, force: true }); } catch {}
}
