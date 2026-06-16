const genericUserError = "Nao foi possivel concluir. Tente novamente.";

export function getFriendlyErrorMessage(error: unknown, fallback = genericUserError) {
  const raw = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : error && typeof error === "object" && "error" in error
        ? String((error as { error?: unknown }).error || "")
        : "";
  const message = raw.trim();
  if (!message) return fallback;
  if (/^\s*[\[{]/.test(message)) return fallback;
  if (/<\/?[a-z][\s\S]*>/i.test(message)) return fallback;
  if (/__reactFiber|HTMLButtonElement|Circular structure|JSON\.stringify|stack|payload|raw_response/i.test(message)) return fallback;
  if (/\b(access_token|refresh_token|apiKey|clientSecret|webhookSecret|authorization|bearer)\b/i.test(message)) return "Erro de configuracao. Revise as credenciais e tente novamente.";
  if (message.length > 180) return fallback;
  return message;
}

export async function readJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function throwFriendlyApiError(response: Response, fallback = genericUserError) {
  const payload = await readJsonSafely(response);
  throw new Error(getFriendlyErrorMessage(payload, fallback));
}
