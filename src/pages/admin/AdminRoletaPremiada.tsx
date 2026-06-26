import { BadgeCheck, Gift, History, Percent, RotateCw, ScrollText } from "lucide-react";
import { AdminPageShell } from "./AdminPageShell";

export function AdminRoletaPremiada() {
  return (
    <AdminPageShell
      title="Roleta Premiada"
      description="Area propria para operacao da Roleta Premiada com visual premium padrao."
      migrationNote="Controles permanecem informativos ate a integracao segura com a configuracao existente."
      sections={[
        { title: "Ativacao e vinculo", description: "Status e campanha vinculada da Roleta.", icon: BadgeCheck },
        { title: "Premios e chances", description: "Premios, probabilidades e quantidade de giros.", icon: Percent },
        { title: "Regras", description: "Criterios operacionais da modalidade.", icon: ScrollText },
        { title: "Historico", description: "Giros e resultados registrados.", icon: History },
        { title: "Status", description: "Situacao operacional atual da Roleta.", icon: RotateCw },
        { title: "Premios cadastrados", description: "Catalogo de premios da modalidade.", icon: Gift }
      ]}
    />
  );
}