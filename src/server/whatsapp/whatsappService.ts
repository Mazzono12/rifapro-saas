export type TicketConfirmationOrder = {
  orderId: string;
  tenantId: string;
  campaignName: string;
  quantity: number;
  numbers: Array<number | string>;
  amount: number;
  phone: string;
  ticketUrl: string;
};

export function normalizeBrazilianPhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function maskPhone(phone: string) {
  const normalized = normalizeBrazilianPhone(phone);
  if (normalized.length < 8) return "***";
  return `${normalized.slice(0, 4)}*****${normalized.slice(-4)}`;
}

export function isValidBrazilianWhatsAppPhone(phone: string) {
  return /^55\d{10,11}$/.test(normalizeBrazilianPhone(phone));
}

export function buildTicketConfirmationMessage(order: TicketConfirmationOrder) {
  const numbers = order.numbers.length > 40
    ? `${order.numbers.slice(0, 40).join(", ")} e mais ${order.numbers.length - 40}`
    : order.numbers.join(", ");
  const amount = order.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return [
    "Pagamento confirmado!",
    "",
    "Seus bilhetes foram gerados com sucesso.",
    "",
    `Campanha: ${order.campaignName}`,
    `Quantidade de cotas: ${order.quantity}`,
    `Seus numeros: ${numbers || "consulte no bilhete"}`,
    `Valor pago: ${amount}`,
    `Pedido: ${order.orderId}`,
    "",
    "Acesse seu bilhete:",
    order.ticketUrl,
    "",
    "Boa sorte!"
  ].join("\n");
}

export function buildTicketConfirmationIdempotencyKey(orderId: string) {
  return `whatsapp:ticket-confirmation:${orderId}`;
}

export async function enqueueTicketConfirmation(_orderId: string) {
  throw new Error("enqueueTicketConfirmation deve ser orquestrado pelo servidor da aplicacao");
}

export async function sendQueuedMessage(_messageId: string) {
  throw new Error("sendQueuedMessage deve ser orquestrado pelo servidor da aplicacao");
}

export async function processWhatsAppQueue() {
  throw new Error("processWhatsAppQueue deve ser orquestrado pelo servidor da aplicacao");
}
