import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(file, "utf8");

const server = read("server.ts");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const checkoutResume = read("src/pages/CheckoutOrderResume.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");

function mustInclude(source, snippet, label) {
  assert.ok(source.includes(snippet), `${label}: trecho ausente: ${snippet}`);
}

function mustNotInclude(source, snippet, label) {
  assert.ok(!source.includes(snippet), `${label}: trecho proibido encontrado: ${snippet}`);
}

const statusRouteStart = server.indexOf('app.get("/api/checkout/orders/:orderId/status"');
assert.ok(statusRouteStart > 0, "Rota /api/checkout/orders/:orderId/status deve existir");
const statusRouteEnd = server.indexOf('app.get("/api/admin/health-summary"', statusRouteStart);
const statusRoute = server.slice(statusRouteStart, statusRouteEnd > statusRouteStart ? statusRouteEnd : statusRouteStart + 5000);

mustInclude(server, "safePix.pixQrCode = /^(data:image\\/|https?:\\/\\/)/i.test(pixQrCodeBase64) ? pixQrCodeBase64 : `data:image/png;base64,${pixQrCodeBase64}`;", "Backend deve normalizar base64 puro para data URI");
mustInclude(server, "safePix.encodedImage = pixQrCodeBase64;", "Backend deve aceitar/propagar encodedImage como QR");
mustInclude(server, "safePix.copyPaste = pixPayload;", "Backend deve mapear copia-e-cola");
mustInclude(server, "safePix.paymentCode = pixPayload;", "Backend deve expor paymentCode como alias");
mustInclude(server, "safePix.orderId = safePix.purchaseId || safePix.id;", "Backend deve expor orderId");
mustInclude(server, "safePix.pixGateway = safePix.pixGateway || \"asaas\";", "Backend deve expor gateway Asaas padronizado");

mustInclude(statusRoute, "refreshAsaasPixForPendingPurchase", "Recuperacao deve tentar recompor QR/payload existente");
mustInclude(statusRoute, "const publicPurchase = sanitizePublicPurchase(purchase)", "Rota de status deve reutilizar normalizacao publica");
mustInclude(statusRoute, "success: true", "Rota de status deve retornar sucesso claro");
mustInclude(statusRoute, "pixPayload,", "Rota de status deve retornar pixPayload top-level");
mustInclude(statusRoute, "pixQrCode,", "Rota de status deve retornar pixQrCode top-level");
mustInclude(statusRoute, "purchase: publicPurchase", "Rota de status deve incluir compra normalizada");
mustNotInclude(statusRoute, "attachActiveGatewayPixToOrder", "Abrir pedido pendente nao deve criar nova cobranca");
mustNotInclude(statusRoute, "createPixPayment", "Abrir pedido pendente nao deve chamar criacao de pagamento");

mustInclude(premiumUi, "export function normalizePixQrImage", "Frontend deve ter normalizador de imagem QR");
mustInclude(premiumUi, "if (/^(data:image\\/|https?:\\/\\/)/i.test(normalized)) return normalized;", "Frontend nao deve duplicar prefixo data:image");
mustInclude(premiumUi, "return `data:image/png;base64,${normalized}`;", "Frontend deve adicionar prefixo a base64 puro");
mustInclude(premiumUi, "qrImage", "Cartao PIX deve receber imagem QR");
mustInclude(premiumUi, "<img src={pixQrImage}", "Cartao PIX deve exibir imagem quando pixQrCode existir");
mustInclude(premiumUi, "<QRCodeSVG value={payload || \"\"}", "Cartao PIX deve gerar QR visual pelo payload quando nao houver imagem");
mustInclude(premiumUi, "Não foi possível gerar o PIX. Tente novamente ou fale com o suporte.", "Cartao PIX deve mostrar erro claro sem QR/payload");

mustInclude(checkoutResume, "pixQrCode?: string;", "Tela de pedido deve tipar pixQrCode");
mustInclude(checkoutResume, "PublicBrandMark", "Tela de pedido deve usar marca publica global");
mustInclude(checkoutResume, "checkout-resume-header", "Tela de pedido deve ter cabecalho visual proprio");
mustInclude(checkoutResume, "checkout-resume-brand-logo", "Logo do pedido deve seguir classe padrao da marca publica");
mustInclude(checkoutResume, "status?.pixQrCode || status?.pixQrCodeBase64", "Tela de pedido deve ler pixQrCode top-level");
mustInclude(checkoutResume, "purchase.pixQrCode || purchase.qrCode", "Tela de pedido deve ler QR normalizado da compra");
mustInclude(checkoutResume, "purchase.encodedImage", "Tela de pedido deve aceitar encodedImage");
mustInclude(checkoutResume, "<PixPaymentCard payload={pixPayload} qrImage={pixQrCode}", "Tela de pedido deve passar imagem e payload ao cartao");
mustInclude(checkoutResume, "fetch(`/api/checkout/orders/${orderId}/status`)", "Tela de pedido deve consultar rota de status existente");
mustInclude(checkoutResume, "async function copyTextToClipboard(text: string)", "Tela de pedido deve ter helper robusto para copiar PIX");
mustInclude(checkoutResume, "navigator.clipboard?.writeText && window.isSecureContext", "Copia deve usar Clipboard API somente em contexto seguro");
mustInclude(checkoutResume, "document.execCommand(\"copy\")", "Copia deve ter fallback para mobile/WebView/HTTP local");
mustInclude(checkoutResume, "const copiedOk = await copyTextToClipboard(pixPayload);", "Botao copiar deve usar helper com fallback");
mustNotInclude(checkoutResume, "attachActiveGatewayPixToOrder", "Frontend de recuperacao nao pode criar cobranca");
mustNotInclude(checkoutResume, "createPixPayment", "Frontend de recuperacao nao pode criar cobranca Asaas");

mustInclude(raffleDetails, "purchase?.copyPaste || purchase?.paymentCode || purchase?.payload", "Checkout da rifa deve aceitar aliases de copia-e-cola");
mustInclude(raffleDetails, "purchase?.pixQrCode || purchase?.qrCode", "Checkout da rifa deve aceitar pixQrCode/qrCode");
mustInclude(raffleDetails, "purchase?.encodedImage || purchase?.encoded_image", "Checkout da rifa deve aceitar encodedImage");
mustInclude(raffleDetails, "return `data:image/png;base64,${qrCode}`;", "Checkout da rifa deve prefixar base64 puro");
mustInclude(raffleDetails, "<QRCodeSVG value={pixPayload}", "Checkout da rifa deve ter fallback QR por payload");

console.log("PASS: pagina PIX normaliza pixQrCode/encodedImage/pixPayload, exibe QR, fallback por payload e nao cria cobranca duplicada.");
