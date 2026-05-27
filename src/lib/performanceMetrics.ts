type MetricName = "public_page_load" | "checkout_modal_open" | "pix_generation";

const marks = new Map<MetricName, number>();

function canReportMetrics() {
  return typeof window !== "undefined" && import.meta.env.DEV;
}

export function startMetric(name: MetricName) {
  if (!canReportMetrics()) return;
  marks.set(name, performance.now());
}

export function finishMetric(name: MetricName, details?: Record<string, unknown>) {
  if (!canReportMetrics()) return;
  const startedAt = marks.get(name);
  const durationMs = startedAt ? Math.round(performance.now() - startedAt) : 0;
  marks.delete(name);
  window.dispatchEvent(new CustomEvent("rifapro:performance-metric", {
    detail: { name, durationMs, ...details }
  }));
  console.info("[perf]", name, { durationMs, ...details });
}

export function markPageLoaded(details?: Record<string, unknown>) {
  if (!canReportMetrics()) return;
  window.requestAnimationFrame(() => finishMetric("public_page_load", details));
}
