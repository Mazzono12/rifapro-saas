import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
};

const app = read("src/App.tsx");
const whatsapp = read("src/pages/admin/AdminWhatsApp.tsx");
const crm = read("src/pages/admin/AdminCRM.tsx");
const atendimento = read("src/pages/admin/AdminAtendimento.tsx");
const sendpulse = read("src/pages/admin/AdminSendPulse.tsx");
const integracoes = read("src/pages/admin/AdminIntegracoes.tsx");

const routes = [
  ["whatsapp", "AdminWhatsApp"],
  ["crm", "AdminCRM"],
  ["atendimento", "AdminAtendimento"],
  ["afiliados", "AdminAfiliados"],
  ["sendpulse", "AdminSendPulse"],
  ["integracoes", "AdminIntegracoes"]
];

for (const [path, component] of routes) {
  assert(app.includes(`path="${path}"`) && app.includes(`<${component} />`), `/admin/${path} aponta para ${component}`);
}

assert(whatsapp.includes("Canal de comunicacao") && whatsapp.includes("/api/admin/whatsapp-center/numbers"), "WhatsApp abre como modulo de canal");
assert(whatsapp.includes("QR Code") && whatsapp.includes("Pairing Code") && whatsapp.includes("Numero conectado"), "WhatsApp cobre conexao, pareamento e numero");
assert(!whatsapp.includes("Pipeline") && !whatsapp.includes("Lead") && !whatsapp.includes("TicketCard") && !whatsapp.includes("AdminTickets"), "WhatsApp nao inclui CRM, leads ou tickets");

assert(crm.includes("Base de relacionamento") && crm.includes("Etapas comerciais") && crm.includes("Novo contato"), "CRM manteve leads, clientes, pipeline e relacionamento");
assert(!crm.includes('title="Tickets"') && !crm.includes('title="WhatsApp"') && !crm.includes("supportTicketCounters"), "CRM nao renderiza blocos internos de tickets/WhatsApp");
assert(!crm.includes("QR Code") && !crm.includes("Pairing Code") && !crm.includes("SendPulse"), "CRM nao contem conexao WhatsApp ou configuracao SendPulse");

assert(atendimento.includes("AdminTickets") && atendimento.includes("return <AdminTickets />"), "Atendimento usa modulo proprio de tickets/suporte");
assert(!atendimento.includes("AdminCRM") && !atendimento.includes("AdminWhatsApp"), "Atendimento nao depende visualmente de CRM ou WhatsApp");

assert(sendpulse.includes("Marketing") && sendpulse.includes("SendPulse") && sendpulse.includes("/api/admin/integrations/global"), "SendPulse abre como modulo de marketing");
assert(!sendpulse.includes("WhatsApp") && !sendpulse.includes("CRM") && !sendpulse.includes("Atendimento"), "SendPulse nao mistura WhatsApp, CRM ou Atendimento");

assert(integracoes.includes("Hub") && integracoes.includes("/admin/whatsapp") && integracoes.includes("/admin/sendpulse") && integracoes.includes("/admin/pagamentos-gateways"), "Integracoes virou hub com atalhos");
assert(!integracoes.includes("fetch(") && !integracoes.includes("Set-Content") && !integracoes.includes("apiKey"), "Hub de integracoes nao configura credenciais nem chama APIs");

const protectedFiles = ["src/pages/CheckoutOrderResume.tsx", "src/pages/RaffleDetails.tsx", "server.ts"];
for (const file of protectedFiles) {
  assert(read(file).length > 0, `${file} permanece presente`);
}

console.log("Fase 7 static checks completed.");
