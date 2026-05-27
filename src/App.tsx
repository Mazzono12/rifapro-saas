import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { SupportChat } from "./components/SupportChat";
import { PremiumAtmosphere } from "./components/PremiumAtmosphere";
import { ThemeProvider } from "./context/theme/ThemeContext";
import { AuthProvider } from "./context/auth/AuthContext";
import { TenantBrandingProvider } from "./context/tenant-branding/TenantBrandingContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { useCustomerStore } from "./store/useCustomerStore";

// Track Ref Custom Hook
function GlobalTracking() {
  const location = useLocation();
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("refCode", ref);
      fetch(`/api/affiliates/${ref}/click`, { method: 'POST' }).catch(console.error);
    }
  }, [location]);

  return null;
}

function MobilePreviewMode() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("preview") === "mobile") {
      document.documentElement.dataset.preview = "mobile";
      return;
    }
    delete document.documentElement.dataset.preview;
  }, [location.search]);

  return null;
}

function GlobalVideoGuard() {
  useEffect(() => {
    const silenceOtherVideos = (activeVideo?: HTMLVideoElement | null) => {
      document.querySelectorAll("video").forEach(video => {
        if (video === activeVideo) return;
        video.muted = true;
        if (!video.paused) video.pause();
      });
    };

    const onPlay = (event: Event) => {
      const video = event.target instanceof HTMLVideoElement ? event.target : null;
      if (video?.dataset.rifaproMuted) {
        video.muted = video.dataset.rifaproMuted === "true";
      }
      silenceOtherVideos(video);
    };

    const onStoryOpen = () => silenceOtherVideos(null);

    document.addEventListener("play", onPlay, true);
    window.addEventListener("rifapro:story-open", onStoryOpen);
    const interval = window.setInterval(() => {
      const playing = Array.from(document.querySelectorAll("video")).filter(video => !video.paused);
      playing.slice(1).forEach(video => {
        video.muted = true;
        video.pause();
      });
    }, 600);

    return () => {
      document.removeEventListener("play", onPlay, true);
      window.removeEventListener("rifapro:story-open", onStoryOpen);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}

const Home = lazy(() => import("./pages/Home").then(module => ({ default: module.Home })));
const RaffleDetails = lazy(() => import("./pages/RaffleDetails").then(module => ({ default: module.RaffleDetails })));
const Fazendinha = lazy(() => import("./pages/Fazendinha").then(module => ({ default: module.Fazendinha })));
const NumberModePage = lazy(() => import("./pages/NumberModePage").then(module => ({ default: module.NumberModePage })));
const Affiliates = lazy(() => import("./pages/Affiliates").then(module => ({ default: module.Affiliates })));
const Login = lazy(() => import("./pages/auth/Login").then(module => ({ default: module.Login })));
const Signup = lazy(() => import("./pages/auth/Signup").then(module => ({ default: module.Signup })));
const RecoverPassword = lazy(() => import("./pages/auth/RecoverPassword").then(module => ({ default: module.RecoverPassword })));
const Profile = lazy(() => import("./pages/auth/Profile").then(module => ({ default: module.Profile })));
const UserDashboard = lazy(() => import("./pages/Dashboard").then(module => ({ default: module.Dashboard })));
const Messages = lazy(() => import("./pages/Messages").then(module => ({ default: module.Messages })));
const NotFoundPage = lazy(() => import("./pages/SystemStatus").then(module => ({ default: module.NotFoundPage })));

// Admin
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then(module => ({ default: module.AdminLayout })));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then(module => ({ default: module.AdminDashboard })));
const AdminRaffles = lazy(() => import("./pages/admin/AdminRaffles").then(module => ({ default: module.AdminRaffles })));
const AdminStories = lazy(() => import("./pages/admin/AdminStories").then(module => ({ default: module.AdminStories })));
const AdminWinners = lazy(() => import("./pages/admin/AdminWinners").then(module => ({ default: module.AdminWinners })));
const AdminInstantPrizes = lazy(() => import("./pages/admin/AdminInstantPrizes").then(module => ({ default: module.AdminInstantPrizes })));
const AdminSales = lazy(() => import("./pages/admin/AdminSales").then(module => ({ default: module.AdminSales })));
const AdminConfig = lazy(() => import("./pages/admin/AdminConfig").then(module => ({ default: module.AdminConfig })));
const AdminPaymentGateways = lazy(() => import("./pages/admin/AdminPaymentGateways").then(module => ({ default: module.AdminPaymentGateways })));
const AdminFazendinha = lazy(() => import("./pages/admin/AdminFazendinha").then(module => ({ default: module.AdminFazendinha })));
const AdminModalidades = lazy(() => import("./pages/admin/AdminModalidades").then(module => ({ default: module.AdminModalidades })));
const AdminLootboxes = lazy(() => import("./pages/admin/AdminLootboxes").then(module => ({ default: module.AdminLootboxes })));
const AdminGamification = lazy(() => import("./pages/admin/AdminGamification").then(module => ({ default: module.AdminGamification })));
const AdminLiveDraw = lazy(() => import("./pages/admin/AdminLiveDraw").then(module => ({ default: module.AdminLiveDraw })));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages").then(module => ({ default: module.AdminMessages })));
const AdminUsers = lazy(() => import("./pages/admin/AdminCRM").then(module => ({ default: module.AdminUsers })));
const AdminReports = lazy(() => import("./pages/admin/AdminReports").then(module => ({ default: module.AdminReports })));
const AdminOperations = lazy(() => import("./pages/admin/AdminOperations").then(module => ({ default: module.AdminOperations })));
const AdminIntegrations = lazy(() => import("./pages/admin/AdminIntegrations").then(module => ({ default: module.AdminIntegrations })));
const AdminDomains = lazy(() => import("./pages/admin/AdminDomains").then(module => ({ default: module.AdminDomains })));
const SuperAdminLayout = lazy(() => import("./pages/superadmin/SuperAdminLayout").then(module => ({ default: module.SuperAdminLayout })));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard").then(module => ({ default: module.SuperAdminDashboard })));
const SuperAdminIntegrations = lazy(() => import("./pages/superadmin/SuperAdminIntegrations").then(module => ({ default: module.SuperAdminIntegrations })));
const SuperAdminDomains = lazy(() => import("./pages/superadmin/SuperAdminDomains").then(module => ({ default: module.SuperAdminDomains })));
const SuperAdminAudit = lazy(() => import("./pages/superadmin/SuperAdminAudit").then(module => ({ default: module.SuperAdminAudit })));
const SuperAdminTenantDetail = lazy(() => import("./pages/superadmin/SuperAdminTenantDetail").then(module => ({ default: module.SuperAdminTenantDetail })));
const SuperAdminTenantBranding = lazy(() => import("./pages/superadmin/SuperAdminTenantBranding").then(module => ({ default: module.SuperAdminTenantBranding })));
const Transparency = lazy(() => import("./pages/Transparency").then(module => ({ default: module.Transparency })));

import { useDynamicBackground } from "./hooks/useDynamicBackground";

function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthRoute = ["/login", "/cadastro", "/recuperar-senha"].includes(location.pathname);
  const isAdminRoute = isAuthRoute || location.pathname.startsWith('/admin') || location.pathname.startsWith('/superadmin') || location.pathname.startsWith('/perfil-saas');
  const isPaymentRoute = location.pathname.startsWith('/raffle/') || ["/fazendinha", "/dezena", "/centena", "/milhar"].includes(location.pathname);
  const isRaffleRoute = location.pathname.startsWith('/raffle/');
  const [heroVideoCinema, setHeroVideoCinema] = React.useState(false);

  useEffect(() => {
    setHeroVideoCinema(false);
  }, [location.pathname]);

  useEffect(() => {
    const onCinemaMode = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setHeroVideoCinema(active && location.pathname === "/");
    };
    window.addEventListener("rifapro:hero-video-cinema", onCinemaMode);
    return () => window.removeEventListener("rifapro:hero-video-cinema", onCinemaMode);
  }, [location.pathname]);

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <div className={`public-shell min-h-screen flex flex-col transition-[padding] duration-300 ${heroVideoCinema || isRaffleRoute ? "pt-0" : "pt-16"}`}>
      {!isRaffleRoute && <Navbar />}
      <main className="flex-1 w-full relative z-10">
        {children}
      </main>
      <SupportChat />
      {!isPaymentRoute && <Footer />}
    </div>
  );
}

function RouteAtmosphere() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/superadmin") || ["/login", "/cadastro", "/recuperar-senha", "/perfil-saas"].includes(location.pathname)) return null;
  return <PremiumAtmosphere />;
}

function AdminRouteFallback() {
  return (
    <div className="min-h-screen grid place-items-center bg-black">
      <div className="glass-card flex items-center gap-3 rounded-3xl p-5 text-sm text-slate-300">
        <div className="h-6 w-6 rounded-full border-2 border-cyan-400/20 border-t-cyan-300 animate-spin" />
        Carregando painel admin...
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="glass-card flex items-center gap-3 rounded-3xl p-5 text-sm text-slate-300">
        <div className="h-6 w-6 rounded-full border-2 border-cyan-400/20 border-t-cyan-300 animate-spin" />
        Carregando...
      </div>
    </div>
  );
}

export default function App() {
  useDynamicBackground("dynamic-bg");
  const hydrateCustomer = useCustomerStore(state => state.hydrate);

  useEffect(() => {
    hydrateCustomer();
  }, [hydrateCustomer]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantBrandingProvider>
        <Router>
          <RouteAtmosphere />
          <Toaster 
            theme="dark"
            toastOptions={{
              className: "glass-card !border-white/10 !text-slate-300 font-mono shadow-[0_4px_30px_rgba(0,0,0,0.5)] !rounded-xl backdrop-blur-2xl",
              style: {
                fontFamily: "var(--font-sans)",
                background: "var(--theme-surface-strong)",
              }
            }}
          />
          <GlobalTracking />
          <MobilePreviewMode />
          <GlobalVideoGuard />
          <MainLayout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/raffle/:id" element={<RaffleDetails />} />
              <Route path="/fazendinha" element={<Fazendinha />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Signup />} />
              <Route path="/recuperar-senha" element={<RecoverPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute roles={["admin", "superadmin"]}><UserDashboard /></ProtectedRoute>} />
              <Route path="/painel" element={<ProtectedRoute roles={["operador", "admin", "superadmin"]}><UserDashboard /></ProtectedRoute>} />
              <Route path="/perfil-saas" element={<ProtectedRoute roles={["superadmin", "admin", "operador", "afiliado"]}><Profile /></ProtectedRoute>} />
              <Route path="/minhas-cotas" element={<UserDashboard />} />
              <Route path="/perfil" element={<UserDashboard />} />
              <Route path="/afiliado" element={<ProtectedRoute roles={["afiliado", "admin", "superadmin"]}><Affiliates /></ProtectedRoute>} />
              <Route path="/afiliados" element={<Affiliates />} />
              <Route path="/mensagens" element={<Messages />} />
              <Route path="/transparencia" element={<Transparency />} />
              <Route path="/caixinhas" element={<Navigate to="/" replace />} />
              <Route path="/:mode" element={<NumberModePage />} />
            
              <Route path="/admin" element={<ProtectedRoute roles={["superadmin", "admin"]}><Suspense fallback={<AdminRouteFallback />}><AdminLayout /></Suspense></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="crm" element={<Navigate to="/admin/usuarios" replace />} />
                <Route path="usuarios" element={<AdminUsers />} />
                <Route path="rifas" element={<AdminRaffles />} />
                <Route path="stories" element={<AdminStories />} />
                <Route path="ganhadores" element={<AdminWinners />} />
                <Route path="cotas" element={<AdminInstantPrizes />} />
                <Route path="vendas" element={<AdminSales />} />
                <Route path="pagamentos" element={<AdminPaymentGateways />} />
                <Route path="fazendinha" element={<AdminFazendinha />} />
                <Route path="caixinhas" element={<AdminLootboxes />} />
                <Route path="gamificacao" element={<AdminGamification />} />
                <Route path="modalidades" element={<AdminModalidades />} />
                <Route path="sorteio" element={<AdminLiveDraw />} />
                <Route path="mensagens" element={<AdminMessages />} />
                <Route path="relatorios" element={<AdminReports />} />
                <Route path="operacoes" element={<AdminOperations />} />
                <Route path="integracoes" element={<AdminIntegrations />} />
                <Route path="dominios" element={<AdminDomains />} />
                <Route path="config" element={<AdminConfig />} />
                <Route path="config/aparencia" element={<AdminConfig initialTab="branding" />} />
              </Route>
              <Route path="/superadmin" element={<ProtectedRoute roles={["superadmin"]}><Suspense fallback={<AdminRouteFallback />}><SuperAdminLayout /></Suspense></ProtectedRoute>}>
                <Route index element={<SuperAdminDashboard />} />
                <Route path="integracoes" element={<SuperAdminIntegrations />} />
                <Route path="dominios" element={<SuperAdminDomains />} />
                <Route path="auditoria" element={<SuperAdminAudit />} />
                <Route path="tenants/:tenantId/financeiro" element={<SuperAdminTenantDetail />} />
                <Route path="tenants/:tenantId/aparencia" element={<SuperAdminTenantBranding />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </MainLayout>
        </Router>
        </TenantBrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
