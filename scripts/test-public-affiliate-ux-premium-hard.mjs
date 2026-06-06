import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = file => readFileSync(file, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includesAll = (source, needles, label) => {
  for (const needle of needles) {
    assert(source.includes(needle), `${label}: faltando ${needle}`);
  }
};

const css = read("src/index.css");
const home = read("src/pages/Home.tsx");
const affiliates = read("src/pages/Affiliates.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const navbar = read("src/components/Navbar.tsx");
const premiumUi = read("src/components/premium/PremiumUI.tsx");
const raffleDetails = read("src/pages/RaffleDetails.tsx");
const receipt = read("src/components/checkout/PrePaymentReceiptModal.tsx");
const server = read("server.ts");
const packageJson = read("package.json");

includesAll(css, ["#0B0B0D", "#141417", "#1A1A1F", "#22C55E", ".affiliate-premium", ".customer-premium"], "tema dark premium");
includesAll(home, ["PremiumPageLayout", "home-featured-raffle-block", "data-premium-section=\"modalidades\"", "data-premium-section=\"fazendinha\"", "data-premium-section=\"ganhadores\""], "home premium");
includesAll(css, ["border-radius: 20px", "transform: translateY(-2px)", "box-shadow: 0 28px 90px"], "cards de rifa premium");
includesAll(raffleDetails, ["CheckoutModalShell", "checkoutStep", "Pagamento PIX", "checkoutService.preview", "executeBuy"], "checkout visual preservado");
includesAll(premiumUi, ["QRCodeSVG", "PixPaymentCard", "Copiar PIX", "bgColor=\"#ffffff\""], "PIX visual preservado");
includesAll(home, ["id=\"ganhadores\"", "WinnersGallery"], "ganhadores premium");
includesAll(raffleDetails, ["Top compradores", "RankingSection", "ranking.slice(0, 4)"], "top compradores premium");
includesAll(dashboard, ["customer-premium", "Compras", "Favoritos", "Prêmios", "Tickets", "Notificações", "Afiliado"], "minha conta premium");
includesAll(affiliates, ["affiliate-premium", "data-premium-surface=\"affiliate\"", "Painel de Afiliado"], "area do afiliado premium");
includesAll(affiliates, ["data-affiliate-premium=\"dashboard-metrics\"", "Comissões Totais", "Clientes Indicados", "Conversão"], "dashboard afiliado responsivo");
includesAll(affiliates, ["data-affiliate-premium=\"link-center\"", "Central de Links", "QRCodeSVG", "Compartilhar link"], "central de links responsiva");
includesAll(affiliates, ["data-affiliate-premium=\"marketing-materials\"", "Texto pronto para WhatsApp", "Texto pronto para Instagram", "Texto curto para Status", "Texto de chamada para Facebook"], "materiais responsivos");
includesAll(affiliates, ["data-affiliate-premium=\"commissions-withdrawals\"", "ResponsiveDataTable", "md:hidden", "Solicitar saque"], "comissoes e saques desktop/mobile");
includesAll(affiliates, ["data-affiliate-premium=\"gamification\"", "Conquistas", "Próxima recompensa", "Meta do mês"], "gamificacao responsiva");
includesAll(affiliates, ["data-affiliate-premium=\"performance-bonus\"", "data-affiliate-premium=\"rewards-wallet\"", "Raspadinha", "Roleta", "Super cota", "Número bônus"], "bonus e recompensas responsivos");
includesAll(navbar, ["Afiliado", "public-mobile-bottom-nav", "grid-cols-5", "bg-[#22C55E]"], "menu mobile com afiliado");
includesAll(css, [".checkout-modal-shell", ".checkout-receipt-shell", ".checkout-primary-button"], "checkout e PIX recebem tema premium");

const diff = (() => {
  try {
    return execSync("git diff --name-only", { encoding: "utf8" });
  } catch {
    return "";
  }
})();
const changed = diff.split(/\r?\n/).filter(Boolean).map(file => file.replace(/\\/g, "/"));
const forbiddenChanged = changed.filter(file => (
  file === "server.ts" ||
  file.startsWith("src/server/") ||
  file.startsWith("src/integrations/") ||
  file.startsWith("supabase/") ||
  /payment|gateway|billing|whatsapp|ticket|crm/i.test(file)
));
assert(forbiddenChanged.length === 0, `Arquivos sensiveis alterados indevidamente: ${forbiddenChanged.join(", ")}`);
assert(packageJson.includes("test:public-affiliate-ux-premium-hard"), "script npm hard deve estar registrado");
assert(server.includes("/api/affiliates"), "endpoints de afiliado devem permanecer no backend existente");
assert(!receipt.includes("createPixPayment"), "recibo visual nao deve criar pagamento diretamente");

console.log("PASS: UX premium publica, cliente e afiliados validada sem alterar regras sensiveis.");
