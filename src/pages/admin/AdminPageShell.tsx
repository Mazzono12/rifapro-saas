import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { AdminAlert, AdminBadge, AdminCard, AdminPage, AdminPageHeader } from "../../components/ui/admin/AdminDesignSystem";

type AdminPageShellProps = {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    description: string;
    icon: LucideIcon;
  }>;
  migrationNote?: string;
};

export function AdminPageShell({ title, description, sections, migrationNote }: AdminPageShellProps) {
  return (
    <AdminPage>
      <AdminPageHeader
        title={title}
        description={description}
        eyebrow={<span>RifaPro Admin</span>}
        actions={<AdminBadge tone="slate"><AlertCircle className="h-3.5 w-3.5" /> Estrutura inicial</AdminBadge>}
      />

      {migrationNote ? <AdminAlert>{migrationNote}</AdminAlert> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map(section => {
          const Icon = section.icon;
          return (
            <AdminCard key={section.title}>
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-[8px] border border-[#dbeafe] bg-[#eff6ff] text-[#2563eb]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">{section.description}</p>
            </AdminCard>
          );
        })}
      </section>
    </AdminPage>
  );
}