export type WhatsAppProviderMessage = {
  to: string;
  body: string;
  tenantId: string;
  messageId: string;
};

export async function sendMockWhatsAppMessage(message: WhatsAppProviderMessage) {
  console.log(`[whatsapp:mock] tenant=${message.tenantId} message=${message.messageId} to=${message.to}`);
  return {
    ok: true,
    providerMessageId: `mock_${message.messageId}`
  };
}
