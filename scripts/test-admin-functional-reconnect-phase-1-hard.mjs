import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = file => readFileSync(resolve(root, file), 'utf8');
const checks = [];
function check(name, condition) { checks.push({ name, condition: Boolean(condition) }); }
function has(file, pattern) { return pattern.test(read(file)); }

const campaigns = 'src/pages/admin/AdminRaffles.tsx';
const orders = 'src/pages/admin/AdminPedidos.tsx';
const payments = 'src/pages/admin/AdminPagamentos.tsx';
const affiliates = 'src/pages/admin/AdminAfiliados.tsx';
const consolidation = 'src/pages/admin/adminDataConsolidation.ts';

check('Campanhas carrega endpoint real /api/admin/raffles', has(campaigns, /fetch\("\/api\/admin\/raffles"/));
check('Campanhas cria campanha por POST real', has(campaigns, /method:\s*isEdit \? "PUT" : "POST"/) && has(campaigns, /"\/api\/admin\/raffles"/));
check('Campanhas salva edicao por PUT real', has(campaigns, /`\/api\/admin\/raffles\/\$\{draft\.id\}`/));
check('Campanhas exclui campanha por DELETE real', has(campaigns, /method:\s*"DELETE"/));
check('Campanhas possui botao Nova campanha com handler', has(campaigns, /onClick=\{startCreate\}/));
check('Campanhas nao renderiza dados financeiros mockados', !has(campaigns, /52\.487|iPhone 15|Maria Oliveira|João Silva/));

check('Pedidos usa hook real de compras administrativas', has(orders, /useAdminConsolidatedData\(\)/));
check('Pedidos possui reload real no botao atualizar', has(orders, /await reload\(\)/));
check('Pedidos possui filtros funcionais de busca/status/campanha', has(orders, /setQuery/) && has(orders, /setStatusFilter/) && has(orders, /setCampaignFilter/));
check('Pedidos abre link real do pedido', has(orders, /\/checkout\/pedido\//));
check('Pedidos remove datas mockadas fixas', !has(orders, /01\/05\/2025|31\/05\/2025/));

check('Pagamentos carrega configuração real de gateways', has(payments, /fetch\("\/api\/admin\/gateways"/));
check('Pagamentos salva Asaas em endpoint real', has(payments, /method:\s*"PUT"/) && has(payments, /paymentGatewayConfigs/));
check('Pagamentos testa Asaas em endpoint real', has(payments, /\/api\/admin\/gateways\/test/));
check('Pagamentos usa filas reais de pagamento', has(payments, /\/api\/admin\/payments\/queues/));
check('Pagamentos nao lista gateways fake como conectados', !has(payments, /Mercado Pago", "PagSeguro", "Stripe|Saldo disponivel.*index/s));

check('Afiliados usa dados consolidados reais', has(affiliates, /useAdminConsolidatedData\(\)/));
check('Afiliados cadastra manualmente em endpoint real', has(affiliates, /\/api\/admin\/affiliates\/manual/));
check('Afiliados atualiza carteira em endpoint real', has(affiliates, /\/api\/admin\/affiliates\/\$\{selected\.refCode\}\/wallet/));
check('Afiliados carrega saques reais', has(affiliates, /\/api\/admin\/affiliates\/withdrawals/));
check('Afiliados remove fontes de trafego mockadas', !has(affiliates, /Instagram|WhatsApp"\)\}|Site \/ Blog|45,2%|28,7%/));

check('Hook consolidado expõe reload para páginas reconectadas', has(consolidation, /reload: \(\) => Promise<void>/) && has(consolidation, /const reload = useCallback/));
check('Nenhum mock financeiro enganoso nas páginas do escopo', ![campaigns, orders, payments, affiliates].some(file => /R\$\s*52\.487|12,5% vs periodo anterior|45,2%|28,7%|15,1%/.test(read(file))));

const failed = checks.filter(item => !item.condition);
for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} checks passed.`);
