import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthRole, roleHome } from "../../lib/authSession";
import { useAuth } from "../../context/auth/AuthContext";

function AuthSkeleton() {
  return (
    <div className="min-h-screen bg-[#05070d] text-white grid place-items-center">
      <div className="w-[min(420px,90vw)] rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
        <div className="h-3 w-28 rounded-full bg-cyan-300/30 animate-pulse" />
        <div className="mt-6 h-8 w-3/4 rounded-xl bg-white/10 animate-pulse" />
        <div className="mt-3 h-4 w-full rounded-xl bg-white/10 animate-pulse" />
        <div className="mt-8 h-12 w-full rounded-xl bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: AuthRole[] }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) return <AuthSkeleton />;
  if (!auth.authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles?.length && (!auth.role || !roles.includes(auth.role))) {
    return <Navigate to={roleHome(auth.role)} replace />;
  }
  return <>{children}</>;
}

export function RoleGuard({ children, roles, fallback = null }: { children: React.ReactNode; roles: AuthRole[]; fallback?: React.ReactNode }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
