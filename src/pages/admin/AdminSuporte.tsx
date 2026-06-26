import { BookOpen, LifeBuoy, Ticket } from "lucide-react";
import { AdminPageShell } from "./AdminPageShell";

export function AdminSuporte() {
  return (
    <AdminPageShell
      title="Suporte"
      description="Pagina estrutural para suporte operacional, orientacoes e atalhos de atendimento."
      migrationNote="Pagina em migracao: a central antiga de suporte permanece preservada."
      sections={[
        { title: "Ajuda operacional", description: "Espaco para orientacoes de uso e triagem.", icon: LifeBuoy },
        { title: "Tickets", description: "Area futura para acompanhar chamados relacionados.", icon: Ticket },
        { title: "Base interna", description: "Preparada para conteudos e procedimentos do tenant.", icon: BookOpen }
      ]}
    />
  );
}

