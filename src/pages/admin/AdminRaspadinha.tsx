import { BadgeCheck, Gift, History, Layers3, ScrollText } from "lucide-react";
import { AdminPageShell } from "./AdminPageShell";

export function AdminRaspadinha() {
  return (
    <AdminPageShell
      title="Raspadinha"
      description="Area propria para configurar e acompanhar a Raspadinha."
      migrationNote="Controles permanecem informativos ate a integracao segura com a configuracao existente."
      sections={[
        { title: "Ativacao e vinculo", description: "Status e campanha vinculada da Raspadinha.", icon: BadgeCheck },
        { title: "Premios", description: "Premios exclusivos da modalidade.", icon: Gift },
        { title: "Quantidade", description: "Quantidade operacional de raspadinhas.", icon: Layers3 },
        { title: "Regras", description: "Criterios de concessao e uso.", icon: ScrollText },
        { title: "Historico e status", description: "Eventos e situacao operacional da modalidade.", icon: History }
      ]}
    />
  );
}