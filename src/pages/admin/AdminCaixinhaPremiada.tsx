import { BadgeCheck, Boxes, Gift, History, ScrollText } from "lucide-react";
import { AdminPageShell } from "./AdminPageShell";

export function AdminCaixinhaPremiada() {
  return (
    <AdminPageShell
      title="Caixinha Premiada"
      description="Area propria para configurar e acompanhar a Caixinha Premiada."
      migrationNote="Controles permanecem informativos ate a integracao segura com a configuracao existente."
      sections={[
        { title: "Ativacao e vinculo", description: "Status e campanha vinculada da Caixinha.", icon: BadgeCheck },
        { title: "Premios", description: "Premios exclusivos da modalidade.", icon: Gift },
        { title: "Quantidade", description: "Quantidade operacional de caixinhas.", icon: Boxes },
        { title: "Regras", description: "Criterios de concessao e uso.", icon: ScrollText },
        { title: "Historico e status", description: "Eventos e situacao operacional da modalidade.", icon: History }
      ]}
    />
  );
}