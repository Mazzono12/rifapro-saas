import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SaaSLayout } from "../../components/auth/SaaSLayout";
import { useAuth } from "../../context/auth/AuthContext";

export function Profile() {
  const auth = useAuth();
  const navigate = useNavigate();
  const logout = async () => {
    await auth.logout();
    toast.success("Sessao encerrada");
    navigate("/login", { replace: true });
  };

  return (
    <SaaSLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Perfil</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Minha sessao</h1>
        </div>
        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-300 text-black">
                <UserRound className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{auth.profile?.name || auth.user?.user_metadata?.name || "Usuario"}</h2>
                <p className="text-sm text-slate-400">{auth.user?.email}</p>
              </div>
            </div>
            <button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white hover:bg-white/10">
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-500">Role</p>
              <p className="mt-2 flex items-center gap-2 font-medium text-white"><ShieldCheck className="h-4 w-4 text-cyan-200" />{auth.role}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-500">Tenant</p>
              <p className="mt-2 font-medium text-white">{auth.tenant_id || "platform"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-slate-500">Sessao</p>
              <p className="mt-2 font-medium text-emerald-200">ativa</p>
            </div>
          </div>
        </section>
      </div>
    </SaaSLayout>
  );
}
