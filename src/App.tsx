import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Navbar } from "./components/Navbar";
import { PublicBottomNav } from "./components/PublicBottomNav";
import { SupportChat } from "./components/SupportChat";
import { PremiumAtmosphere } from "./components/PremiumAtmosphere";
import { ThemeProvider } from "./context/theme/ThemeContext";
import { AuthProvider } from "./context/auth/AuthContext";
import { TenantBrandingProvider } from "./context/tenant-branding/TenantBrandingContext";
import { VideoPlaybackProvider } from "./context/video-playback/VideoPlaybackContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PwaInstallPrompt } from "./components/pwa/PwaInstallPrompt";
import { useCustomerStore } from "./store/useCustomerStore";
import { AdminSectionBoundary } from "./components/admin/AdminSectionBoundary";

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

    return () => {
      document.removeEventListener("play", onPlay, true);
      window.removeEventListener("rifapro:story-open", onStoryOpen);
    };
  }, []);

  return null;
}

const Home = lazy(() => import("./pages/Home").then(module => ({ default: module.Home })));
const Sorteios = lazy(() => import("./pages/Sorteios").then(module => ({ default: module.Sorteios })));
const RaffleDetails = lazy(() => import("./pages/RaffleDetails").then(module => ({ default: module.RaffleDetails })));
const Fazendinha = lazy(() => import("./pages/Fazendinha").then(module => ({ default: module.Fazendinha })));
const Winners = lazy(() => import("./pages/Winners").then(module => ({ default: module.Winners })));
const NumberModePage = lazy(() => import("./pages/NumberModePage").then(module => ({ default: module.NumberModePage })));
const CheckoutOrderResume = lazy(() => import("./pages/CheckoutOrderResume").then(module => ({ default: module.CheckoutOrderResume })));
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
const AdminPromotions = lazy(() => import("./pages/admin/AdminPromotions").then(module => ({ default: module.AdminPromotions })));
const AdminLiveDraw = lazy(() => import("./pages/admin/AdminLiveDraw").then(module => ({ default: module.AdminLiveDraw })));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages").then(module => ({ default: module.AdminMessages })));
const AdminWhatsAppCenter = lazy(() => import("./pages/admin/AdminWhatsAppCenter").then(module => ({ default: module.AdminWhatsAppCenter })));
const AdminTickets = lazy(() => import("./pages/admin/AdminTickets").then(module => ({ default: module.AdminTickets })));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications").then(module => ({ default: module.AdminNotifications })));
const AdminPushNotifications = lazy(() => import("./pages/admin/AdminPushNotifications").then(module => ({ default: module.AdminPushNotifications })));
const AdminUsers = lazy(() => import("./pages/admin/AdminCRM").then(module => ({ default: module.AdminUsers })));
const AdminCRM = lazy(() => import("./pages/admin/AdminCRM").then(module => ({ default: module.AdminCRM })));
const AdminReports = lazy(() => import("./pages/admin/AdminReports").then(module => ({ default: module.AdminReports })));
const AdminOperations = lazy(() => import("./pages/admin/AdminOperations").then(module => ({ default: module.AdminOperations })));
const AdminIntegrations = lazy(() => import("./pages/admin/AdminIntegrations").then(module => ({ default: module.AdminIntegrations })));
const AdminAutomations = lazy(() => import("./pages/admin/AdminAutomations").then(module => ({ default: module.AdminAutomations })));
const AdminDomains = lazy(() => import("./pages/admin/AdminDomains").then(module => ({ default: module.AdminDomains })));
const AdminComplianceCenter = lazy(() => import("./pages/admin/AdminComplianceCenter").then(module => ({ default: module.AdminComplianceCenter })));
const AdminMyPlan = lazy(() => import("./pages/admin/AdminMyPlan").then(module => ({ default: module.AdminMyPlan })));
const AdminPlatformBilling = lazy(() => import("./pages/admin/AdminPlatformBilling").then(module => ({ default: module.AdminPlatformBilling })));
const AdminWhiteLabel = lazy(() => import("./pages/admin/AdminWhiteLabel").then(module => ({ default: module.AdminWhiteLabel })));
const SuperAdminLayout = lazy(() => import("./pages/superadmin/SuperAdminLayout").then(module => ({ default: module.SuperAdminLayout })));
const SuperAdminDashboard = lazy(() => import("./pages/superadmin/SuperAdminDashboard").then(module => ({ default: module.SuperAdminDashboard })));
const SuperAdminClients = lazy(() => import("./pages/superadmin/SuperAdminClients").then(module => ({ default: module.SuperAdminClients })));
const SuperAdminIntegrations = lazy(() => import("./pages/superadmin/SuperAdminIntegrations").then(module => ({ default: module.SuperAdminIntegrations })));
const SuperAdminWhatsAppNumbers = lazy(() => import("./pages/superadmin/SuperAdminWhatsAppNumbers").then(module => ({ default: module.SuperAdminWhatsAppNumbers })));
const SuperAdminTickets = lazy(() => import("./pages/superadmin/SuperAdminTickets").then(module => ({ default: module.SuperAdminTickets })));
const SuperAdminPush = lazy(() => import("./pages/superadmin/SuperAdminPush").then(module => ({ default: module.SuperAdminPush })));
const SuperAdminDomains = lazy(() => import("./pages/superadmin/SuperAdminDomains").then(module => ({ default: module.SuperAdminDomains })));
const SuperAdminAudit = lazy(() => import("./pages/superadmin/SuperAdminAudit").then(module => ({ default: module.SuperAdminAudit })));
const SuperAdminReports = lazy(() => import("./pages/superadmin/SuperAdminReports").then(module => ({ default: module.SuperAdminReports })));
const SuperAdminAntifraud = lazy(() => import("./pages/superadmin/SuperAdminAntifraud").then(module => ({ default: module.SuperAdminAntifraud })));
const SuperAdminTenantDetail = lazy(() => import("./pages/superadmin/SuperAdminTenantDetail").then(module => ({ default: module.SuperAdminTenantDetail })));
const SuperAdminTenantBranding = lazy(() => import("./pages/superadmin/SuperAdminTenantBranding").then(module => ({ default: module.SuperAdminTenantBranding })));
const SuperAdminTenantPlanResources = lazy(() => import("./pages/superadmin/SuperAdminTenantPlanResources").then(module => ({ default: module.SuperAdminTenantPlanResources })));
const SuperAdminPlatformBilling = lazy(() => import("./pages/superadmin/SuperAdminPlatformBilling").then(module => ({ default: module.SuperAdminPlatformBilling })));
const SuperAdminWhiteLabel = lazy(() => import("./pages/superadmin/SuperAdminWhiteLabel").then(module => ({ default: module.SuperAdminWhiteLabel })));
const Transparency = lazy(() => import("./pages/Transparency").then(module => ({ default: module.Transparency })));
const DrawAudit = lazy(() => import("./pages/DrawAudit").then(module => ({ default: module.DrawAudit })));

function adminSection(section: string, children: React.ReactNode) {
  return <AdminSectionBoundary section={section}>{children}</AdminSectionBoundary>;
}

import { useDynamicBackground } from "./hooks/useDynamicBackground";

function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthRoute = ["/login", "/cadastro", "/recuperar-senha"].includes(location.pathname);
  const isAdminRoute = isAuthRoute || location.pathname.startsWith('/admin') || location.pathname.startsWith('/superadmin') || location.pathname.startsWith('/perfil-saas');
  const isRaffleRoute = /^\/(raffle|rifa|sorteio)\/[^/]+\/?$/.test(location.pathname);
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
    <div className="public-shell min-h-screen flex flex-col">
      {!isRaffleRoute && <Navbar />}
      <main className="flex-1 w-full relative z-10">
        <TenantOperationalGate>{children}</TenantOperationalGate>
      </main>
      {isRaffleRoute && <PublicBottomNav />}
      <SupportChat />
    </div>
  );
}

function TenantOperationalGate({ children }: { children: React.ReactNode }) {
  const [governance, setGovernance] = React.useState<any>(null);

  useEffect(() => {
    fetch("/api/public/tenant-governance")
      .then(res => res.ok ? res.json() : null)
      .then(setGovernance)
      .catch(() => null);
  }, []);

  if (governance?.maintenance || governance?.blocked) {
    const title = governance.maintenance ? "Ambiente Premium em manutenção" : "Ambiente Premium temporariamente indisponível";
    const message = governance.maintenance
      ? "Estamos realizando ajustes operacionais. Tente novamente em instantes."
      : "Este ambiente está com checkout e acesso público temporariamente indisponíveis pelo status operacional.";
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <div className="glass-card max-w-xl rounded-3xl p-8 text-center">
          <p className="text-sm font-bold uppercase text-amber-200">Status: {governance.status}</p>
          <h1 className="mt-3 text-3xl font-black text-white">{title}</h1>
          <p className="mt-3 text-slate-300">{message}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
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

function AffiliateAccessRoute() {
  return <Affiliates />;
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
        <VideoPlaybackProvider>
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
          <PwaInstallPrompt />
          <MainLayout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/raffle/:id" element={<RaffleDetails />} />
              <Route path="/rifa/:id" element={<RaffleDetails />} />
              <Route path="/sorteio/:id" element={<RaffleDetails />} />
              <Route path="/checkout/orders/:orderId" element={<CheckoutOrderResume />} />
              <Route path="/campanhas" element={<Navigate to="/" replace />} />
              <Route path="/sorteios" element={<Sorteios />} />
              <Route path="/fazendinha" element={<Fazendinha />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Signup />} />
              <Route path="/recuperar-senha" element={<RecoverPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute roles={["admin", "superadmin"]}><UserDashboard /></ProtectedRoute>} />
              <Route path="/painel" element={<ProtectedRoute roles={["operador", "admin", "superadmin"]}><UserDashboard /></ProtectedRoute>} />
              <Route path="/perfil-saas" element={<ProtectedRoute roles={["superadmin", "admin", "operador", "afiliado"]}><Profile /></ProtectedRoute>} />
              <Route path="/minhas-cotas" element={<UserDashboard />} />
              <Route path="/meus-bilhetes" element={<UserDashboard />} />
              <Route path="/meus-numeros" element={<UserDashboard />} />
              <Route path="/meus-jogos" element={<UserDashboard />} />
              <Route path="/perfil" element={<UserDashboard />} />
              <Route path="/afiliado" element={<Navigate to="/afiliados" replace />} />
              <Route path="/afiliados" element={<AffiliateAccessRoute />} />
              <Route path="/mensagens" element={<Messages />} />
              <Route path="/contato" element={<Messages />} />
              <Route path="/transparencia" element={<Transparency />} />
              <Route path="/termos" element={<Transparency />} />
              <Route path="/termos-de-uso" element={<Transparency />} />
              <Route path="/ganhadores" element={<Winners />} />
              <Route path="/sorteio/:raffleId/auditoria" element={<DrawAudit />} />
              <Route path="/caixinhas" element={<Navigate to="/" replace />} />
              <Route path="/:mode" element={<NumberModePage />} />
            
              <Route path="/admin/whatsapp-center" element={<ProtectedRoute roles={["superadmin", "admin", "operador"]}><Suspense fallback={<AdminRouteFallback />}><AdminLayout /></Suspense></ProtectedRoute>}>
                <Route index element={adminSection("Central WhatsApp", <AdminWhatsAppCenter />)} />
              </Route>
              <Route path="/admin/notificacoes" element={<ProtectedRoute roles={["superadmin", "admin", "operador"]}><Suspense fallback={<AdminRouteFallback />}><AdminLayout /></Suspense></ProtectedRoute>}>
                <Route index element={adminSection("Notificações", <AdminNotifications />)} />
              </Route>
              <Route path="/admin" element={<ProtectedRoute roles={["superadmin", "admin"]}><Suspense fallback={<AdminRouteFallback />}><AdminLayout /></Suspense></ProtectedRoute>}>
                <Route index element={adminSection("Dashboard", <AdminDashboard />)} />
                <Route path="crm" element={adminSection("CRM", <AdminCRM />)} />
                <Route path="crm/:contactId" element={adminSection("CRM", <AdminCRM />)} />
                <Route path="crm/pipeline" element={adminSection("CRM Pipeline", <AdminCRM />)} />
                <Route path="crm/segmentos" element={adminSection("CRM Segmentos", <AdminCRM />)} />
                <Route path="usuarios" element={adminSection("Clientes", <AdminUsers />)} />
                <Route path="rifas" element={adminSection("Rifas", <AdminRaffles />)} />
                <Route path="stories" element={adminSection("Stories", <AdminStories />)} />
                <Route path="ganhadores" element={adminSection("Ganhadores", <AdminWinners />)} />
                <Route path="cotas" element={adminSection("Super Cotas", <AdminInstantPrizes />)} />
                <Route path="vendas" element={adminSection("Vendas", <AdminSales />)} />
                <Route path="pagamentos" element={adminSection("Pagamentos", <AdminPaymentGateways />)} />
                <Route path="fazendinha" element={adminSection("Fazendinha", <AdminFazendinha />)} />
                <Route path="caixinhas" element={adminSection("Roleta Premiada", <AdminLootboxes />)} />
                <Route path="gamificacao" element={adminSection("Gamificação", <AdminGamification />)} />
                <Route path="promocoes" element={adminSection("Promoções", <AdminPromotions />)} />
                <Route path="modalidades" element={adminSection("Modalidades", <AdminModalidades />)} />
                <Route path="sorteio" element={adminSection("Sorteio Ao Vivo", <AdminLiveDraw />)} />
                <Route path="mensagens" element={adminSection("Mensagens", <AdminMessages />)} />
                <Route path="tickets" element={adminSection("Tickets", <AdminTickets />)} />
                <Route path="whatsapp-center" element={adminSection("Central WhatsApp", <AdminWhatsAppCenter />)} />
                <Route path="notificacoes" element={adminSection("Notificações", <AdminNotifications />)} />
                <Route path="push-notifications" element={adminSection("Push Notifications", <AdminPushNotifications />)} />
                <Route path="relatorios" element={adminSection("Relatórios e Afiliados", <AdminReports />)} />
                <Route path="operacoes" element={adminSection("Operações", <AdminOperations />)} />
                <Route path="integracoes" element={adminSection("Integrações", <AdminIntegrations />)} />
                <Route path="automacoes" element={adminSection("Automações", <AdminAutomations />)} />
                <Route path="dominios" element={adminSection("Domínios", <AdminDomains />)} />
                <Route path="auditoria" element={adminSection("Auditoria", <AdminComplianceCenter view="audit" />)} />
                <Route path="compliance" element={adminSection("Compliance", <AdminComplianceCenter view="compliance" />)} />
                <Route path="antifraude" element={adminSection("Antifraude", <AdminComplianceCenter view="antifraud" />)} />
                <Route path="gerenciar-cotas" element={adminSection("Gerenciar Cotas", <AdminComplianceCenter view="tickets" />)} />
                <Route path="meu-plano" element={adminSection("Meu Plano", <AdminMyPlan />)} />
                <Route path="custos-plataforma" element={adminSection("Custos da Plataforma", <AdminPlatformBilling />)} />
                <Route path="marca-dominio" element={adminSection("Marca e Domínio", <AdminWhiteLabel />)} />
                <Route path="config" element={adminSection("Configurações", <AdminConfig />)} />
                <Route path="config/aparencia" element={adminSection("Aparência", <AdminConfig initialTab="branding" />)} />
              </Route>
              <Route path="/superadmin" element={<ProtectedRoute roles={["superadmin"]}><Suspense fallback={<AdminRouteFallback />}><SuperAdminLayout /></Suspense></ProtectedRoute>}>
                <Route index element={<SuperAdminDashboard />} />
                <Route path="clientes" element={<SuperAdminClients />} />
                <Route path="integracoes" element={<SuperAdminIntegrations />} />
                <Route path="whatsapp-enterprise" element={<SuperAdminWhatsAppNumbers />} />
                <Route path="tickets" element={<SuperAdminTickets />} />
                <Route path="push" element={<SuperAdminPush />} />
                <Route path="notificacoes" element={<AdminNotifications />} />
                <Route path="dominios" element={<SuperAdminDomains />} />
                <Route path="auditoria" element={<SuperAdminAudit />} />
                <Route path="relatorios" element={<SuperAdminReports />} />
                <Route path="platform-billing" element={<SuperAdminPlatformBilling />} />
                <Route path="white-label" element={<SuperAdminWhiteLabel />} />
                <Route path="antifraude" element={<SuperAdminAntifraud />} />
                <Route path="aparencia" element={<SuperAdminTenantBranding />} />
                <Route path="tenants/:tenantId/financeiro" element={<SuperAdminTenantDetail />} />
                <Route path="tenants/:tenantId/aparencia" element={<SuperAdminTenantBranding />} />
                <Route path="tenants/:tenantId/plano" element={<SuperAdminTenantPlanResources />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </MainLayout>
        </Router>
        </VideoPlaybackProvider>
        </TenantBrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
