import { Lock, Settings, SlidersHorizontal } from "lucide-react";
import { AdminPageShell } from "./AdminPageShell";

export function AdminConfiguracoes() {
  return (
    <AdminPageShell
      title="Configurações"
      description="Pagina estrutural para preferencias gerais do Admin, separada de aparencia, integracoes e pagamentos."
      migrationNote="Pagina em migracao: configuracoes antigas continuam preservadas ate a separacao por dominio."
      sections={[
        { title: "Preferencias gerais", description: "Espaco para configuracoes administrativas de baixo risco.", icon: Settings },
        { title: "Controles operacionais", description: "Area futura para parametros internos sem alterar campanhas.", icon: SlidersHorizontal },
        { title: "Seguranca", description: "Preparada para organizacao de acessos e politicas administrativas.", icon: Lock }
      ]}
    />
  );
}

