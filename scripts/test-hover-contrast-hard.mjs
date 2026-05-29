import { readFileSync } from "node:fs";

const css = readFileSync("src/index.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  ".premium-button:hover",
  ".premium-button-ghost",
  ".premium-button-secondary",
  ".checkout-actions button",
  ".checkout-action-button",
  "color: var(--tenant-cta-text, #020617) !important",
  "color: var(--text-primary) !important",
  "disabled",
  "focus"
]) {
  assert(css.includes(token), `hover-contrast-hard: esperado token ${token}`);
}

assert(css.includes(".checkout-summary-label") && css.includes("color: var(--checkout-label) !important"), "labels do checkout precisam ter contraste explicito");
assert(css.includes(".checkout-summary-value") && css.includes("color: var(--checkout-value) !important"), "valores do checkout precisam ter contraste explicito");
assert(css.includes(".customer-identified-card"), "cliente identificado precisa de card dedicado de contraste");

console.log("hover-contrast-hard: ok");
