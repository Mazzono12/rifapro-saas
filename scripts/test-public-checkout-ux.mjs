import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sliceBetween(content, start, end) {
  const startIndex = content.indexOf(start);
  assert(startIndex >= 0, `Trecho inicial nao encontrado: ${start}`);
  const endIndex = content.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `Trecho final nao encontrado: ${end}`);
  return content.slice(startIndex, endIndex);
}

const campaignHero = read("src/components/CampaignMediaHero.tsx");
const videoPlayer = read("src/components/VideoHeroPlayer.tsx");
const smartVideo = read("src/components/SmartAutoPlayVideo.tsx");
const videoProvider = read("src/context/video-playback/VideoPlaybackContext.tsx");
const smartHook = read("src/hooks/useSmartVideoPlayback.ts");
const soundToggle = read("src/components/VideoSoundToggle.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const customerStore = read("src/store/useCustomerStore.ts");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const geoService = read("src/services/GeoPrefillService.ts");
const useCityDetection = read("src/hooks/useCityDetection.ts");
const api = read("src/services/api.ts");
const server = read("server.ts");
const numberMode = read("src/pages/NumberModePage.tsx");
const fazendinha = read("src/pages/Fazendinha.tsx");
const fazendinhaSection = read("src/components/FazendinhaSection.tsx");

assert(campaignHero.includes("VideoHeroPlayer"), "CampaignMediaHero deve usar VideoHeroPlayer para videos");
assert(videoPlayer.includes("SmartAutoPlayVideo"), "VideoHeroPlayer deve usar SmartAutoPlayVideo");
assert(smartVideo.includes("useSmartVideoPlayback"), "SmartAutoPlayVideo deve usar hook de visibilidade inteligente");
assert(videoProvider.includes("VideoPlaybackProvider"), "Deve existir VideoPlaybackProvider para coordenar videos");
assert(videoProvider.includes("IntersectionObserver") || smartHook.includes("IntersectionObserver"), "Autoplay inteligente deve usar IntersectionObserver");
assert(videoProvider.includes("sort((a, b) => b.ratio - a.ratio)"), "Apenas o video mais visivel deve tocar");
assert(videoProvider.includes("pauseEntry"), "Videos fora de visibilidade devem pausar");
assert(videoProvider.includes("active.video.muted = true"), "Autoplay bloqueado deve cair para muted");
assert(smartHook.includes("observer.disconnect()"), "Observer deve ser limpo no unmount");
assert(videoPlayer.includes("playsInline"), "VideoHeroPlayer deve preservar playsInline para mobile");
assert(smartVideo.includes('preload={priority ? "auto" : preload}'), "SmartAutoPlayVideo deve usar preload metadata fora de prioridade");
assert(soundToggle.includes("Ativar Som"), "VideoSoundToggle deve exibir CTA Ativar Som");

assert(!dashboard.includes("Criar senha"), "Area do cliente nao deve mostrar Criar senha no fluxo de entrada");
assert(dashboard.includes("Entrar"), "Area do cliente deve trocar acao de acesso para Entrar");
assert(dashboard.includes("Sair"), "Area do cliente deve expor botao Sair");
assert(dashboard.includes("clearCustomer()"), "Botao Sair deve limpar sessao do cliente");
assert(customerStore.includes("localStorage.removeItem(customerSessionKey)"), "Logout do cliente deve limpar localStorage do cliente");
assert(customerStore.includes("sessionStorage.removeItem(customerSessionKey)"), "Logout do cliente deve limpar sessionStorage do cliente");
assert(!customerStore.includes("nexusdraw_admin_token"), "Logout do cliente nao deve remover token admin");

const paymentPix = sliceBetween(raffleDetails, "function PaymentPix", "function PremiumTicket");
assert(!/Suporte WhatsApp|supportUrl|wa\.me|api\.whatsapp\.com/i.test(paymentPix), "Checkout PIX nao pode conter CTA de WhatsApp");
assert(paymentPix.includes("JÁ REALIZEI O PAGAMENTO") || paymentPix.includes("Confirmar PIX") || paymentPix.includes("Ja paguei, verificar"), "Checkout PIX deve conter botao de consulta do pagamento");
assert(paymentPix.includes("Copiar código PIX"), "Checkout PIX deve conter botao Copiar codigo PIX");
assert(paymentPix.includes("cfx-copy-pix-button"), "Botao Copiar codigo PIX deve usar classe propria");
assert(raffleDetails.includes("copyTextToClipboard") && raffleDetails.includes("document.execCommand(\"copy\")"), "Copiar PIX deve ter fallback para HTTP/local mobile");
assert(raffleDetails.includes("checkoutService.checkPixPaymentStatus(purchase.purchaseId)"), "Botao de pagamento realizado deve consultar status seguro do pedido");
assert(api.includes('fetch(`/api/checkout/orders/${orderId}/status`)'), "Status PIX deve usar GET /api/checkout/orders/:id/status");
assert(server.includes('app.get("/api/checkout/orders/:orderId/status"'), "Backend deve expor endpoint seguro de status");
assert(server.includes("Confirmacao manual pelo cliente nao e permitida"), "Confirmacao manual deve continuar bloqueada");
assert(raffleDetails.includes("/api/customers/checkout-lookup"), "Checkout deve consultar CPF para reconhecer cliente existente antes de pedir senha");
assert(raffleDetails.includes("knownCustomer") && (raffleDetails.includes("!customerForm.knownCustomer") || raffleDetails.includes("!form.knownCustomer")), "Cliente existente nao deve precisar de senha para gerar PIX");
assert(server.includes('app.post("/api/customers/checkout-lookup"'), "Backend deve expor lookup publico seguro para checkout");
assert(raffleDetails.includes("if (!recognizedCustomer && !form.knownCustomer") || raffleDetails.includes("if (!recognizedCustomer && !customerForm.knownCustomer"), "Senha deve ser obrigatoria somente para cadastro inicial no checkout");
const checkoutReview = sliceBetween(raffleDetails, "function CheckoutReview", "function PaymentPix");
assert(checkoutReview.includes('data-checkout-mode="pix-rapido"'), "Checkout deve operar em modo PIX rapido");
assert(checkoutReview.includes("Nome completo") && checkoutReview.includes("WhatsApp") && checkoutReview.includes("CPF"), "PIX rapido deve mostrar nome, WhatsApp e CPF antes do PIX");
assert(checkoutReview.includes("body: JSON.stringify({ cpf: cpfDigits, phone: phoneDigits })"), "Lookup do checkout deve reconhecer cliente por CPF ou WhatsApp");
assert(checkoutReview.includes("const [needsAccessPassword, setNeedsAccessPassword] = useState(false)"), "Senha nao deve aparecer inicialmente para gerar PIX");
assert(checkoutReview.includes("needsAccessPassword && !props.customerForm.knownCustomer"), "Senha deve aparecer somente quando cadastro novo precisar dela");
assert(checkoutReview.includes('data-checkout-recognized-buyer="true"'), "Comprador reconhecido deve ver resumo compacto sem campos de cadastro");
assert(checkoutReview.includes("Comprador reconhecido") && checkoutReview.includes("Finalizar como"), "Checkout deve comunicar comprador reconhecido automaticamente");
assert(checkoutReview.includes("Trocar comprador") && checkoutReview.includes("props.onSwitchCustomer"), "Checkout deve permitir trocar comprador reconhecido");
assert(checkoutReview.includes("Gerar PIX agora"), "CTA Gerar PIX agora deve ficar visivel no checkout mobile");
assert(!checkoutReview.includes("showRegistration"), "Checkout nao deve exigir clique duplicado para abrir cadastro antes do PIX");
assert((checkoutReview.match(/type="submit"/g) || []).length === 1, "Checkout deve ter apenas um CTA submit antes do PIX");
assert(raffleDetails.includes('fetch(`/api/raffles/${id}/buy`'), "PIX deve continuar sendo criado pelo fluxo original de compra da rifa");
assert(raffleDetails.includes("customerTenantId === raffleTenantId"), "Comprador salvo so pode ser usado quando pertence ao tenant da rifa");
assert(raffleDetails.includes("clearCustomer()") && raffleDetails.includes("setRequireIdentity(true)"), "Trocar comprador deve limpar comprador salvo e voltar ao formulario normal");
assert(customerStore.includes("tenant_id: customer.tenant_id"), "Comprador salvo localmente deve preservar tenant_id para validacao multitenant");
const accessPasswordContract = sliceBetween(server, "function normalizeAccessPassword", "function stripSensitiveCustomerFields");
assert(accessPasswordContract.includes('replace(/\\D/g, "")'), "Senha de acesso deve considerar apenas os digitos informados");
assert(accessPasswordContract.includes('value.length === 6 ? value : ""'), "Qualquer senha numerica com exatamente 6 digitos deve ser aceita");
for (const blockedPattern of ["123456", "000000", "111111", "sequencial", "fraca", "weak"]) {
  assert(!accessPasswordContract.includes(blockedPattern), `Senha de 6 digitos nao deve ter bloqueio por padrao fraco: ${blockedPattern}`);
}
assert(server.includes("getRaffleMinPurchaseTickets") && server.includes("normalizeRaffleMinPurchasePayload"), "Backend deve normalizar quantidade minima de cotas por campanha");
assert(raffleDetails.includes("Quantidade mínima:") && raffleDetails.includes("minPurchaseTickets"), "Checkout deve exibir e respeitar quantidade minima configurada");

assert(receipt.includes("CheckoutModalShell"), "Recibo pre-pagamento deve usar shell/header compartilhado do checkout");
assert(premiumUi.includes("TenantLogo"), "Header compartilhado do checkout deve usar logo do tenant");
assert(premiumUi.includes("TenantHeaderName"), "Header compartilhado do checkout deve usar nome do tenant");
assert(receipt.includes('label="Cidade"'), "Recibo deve mostrar cidade antes do PIX");
assert(receipt.includes("Revise e gere seu PIX"), "Recibo deve ter hierarquia profissional de pre-pagamento");

assert(server.includes('app.get("/api/public/geo"'), "Backend deve ter endpoint publico seguro de geolocalizacao");
assert(geoService.includes("/api/public/geo"), "GeoPrefillService deve buscar cidade antes do PIX");
assert(geoService.includes("localStorage"), "GeoPrefillService deve cachear cidade localmente");
assert(useCityDetection.includes("GeoPrefillService.detect"), "useCityDetection deve carregar prefill de cidade");
for (const [name, content] of [["RaffleDetails", raffleDetails], ["NumberModePage", numberMode], ["Fazendinha", fazendinha], ["FazendinhaSection", fazendinhaSection]]) {
  assert(content.includes("useCityDetection"), `${name} deve preencher cidade antes do PIX`);
  assert(content.includes("GeoPrefillService.saveManual"), `${name} deve salvar cidade editada no cache`);
  assert(content.includes("Confirmar PIX") || content.includes("JÁ REALIZEI O PAGAMENTO") || content.includes("Ja paguei, verificar"), `${name} deve expor consulta de pagamento no fluxo PIX`);
}

assert(!/SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(campaignHero + videoPlayer + soundToggle + receipt + geoService + useCityDetection), "Codigo publico nao deve expor service role");

console.log("[public-checkout-ux] ok");
