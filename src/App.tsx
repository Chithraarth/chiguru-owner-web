import { Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SyncProvider } from "@/lib/sync-manager";
import { LanguageProvider } from "@/lib/i18n";
import { EstateProvider } from "@/lib/use-estate";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { DeviceGate } from "@/components/device-gate";
import { lazyWithReload } from "@/lib/lazy-with-reload";
import { SidebarProvider } from "@/lib/sidebar-context";
import { Sidebar } from "@/components/sidebar";
import SignInPage from "@/pages/sign-in";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

const Dashboard = lazyWithReload(() => import("@/pages/dashboard"));
const HelpPage = lazyWithReload(() => import("@/pages/help"));
const Onboarding = lazyWithReload(() => import("@/pages/onboarding"));
const Workers = lazyWithReload(() => import("@/pages/workers"));
const LabourRecords = lazyWithReload(() => import("@/pages/labour-records"));
const WorkGroups = lazyWithReload(() => import("@/pages/work-groups"));
const AttendancePage = lazyWithReload(() => import("@/pages/attendance"));
const Expenses = lazyWithReload(() => import("@/pages/expenses"));
const Sprays = lazyWithReload(() => import("@/pages/sprays"));
const Harvests = lazyWithReload(() => import("@/pages/harvests"));
const Crops = lazyWithReload(() => import("@/pages/crops"));
const Loans = lazyWithReload(() => import("@/pages/loans"));
const Reports = lazyWithReload(() => import("@/pages/reports"));
const AgriAI = lazyWithReload(() => import("@/pages/agri-ai"));
const Disease = lazyWithReload(() => import("@/pages/disease"));
const Shop = lazyWithReload(() => import("@/pages/shop"));
const DailyUpdate = lazyWithReload(() => import("@/pages/daily-update"));
const NurseryAdmin = lazyWithReload(() => import("@/pages/nursery-admin"));
const NurseryShop = lazyWithReload(() => import("@/pages/nursery"));
const AgriDoctor = lazyWithReload(() => import("@/pages/agri-doctor"));
const Subscription = lazyWithReload(() => import("@/pages/subscription"));
const SubscriptionSuccess = lazyWithReload(() => import("@/pages/subscription-success"));
const Marketplace = lazyWithReload(() => import("@/pages/marketplace"));
const MandiPrices = lazyWithReload(() => import("@/pages/mandi"));
const Equipment = lazyWithReload(() => import("@/pages/equipment"));
const ManagerDevices = lazyWithReload(() => import("@/pages/manager-devices"));
const SyncLog = lazyWithReload(() => import("@/pages/sync-log"));
const FarmAccounts = lazyWithReload(() => import("@/pages/farm-accounts"));
const AccountsScan = lazyWithReload(() => import("@/pages/accounts-scan"));
const SettingsPage = lazyWithReload(() => import("@/pages/settings"));
const BinPage = lazyWithReload(() => import("@/pages/bin"));
const MyAdsPage = lazyWithReload(() => import("@/pages/my-ads"));
const ProfilePage = lazyWithReload(() => import("@/pages/profile"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount) => {
        if (!navigator.onLine) return false;
        return failureCount < 2;
      },
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Keeps the query cache from leaking data across account switches (e.g. signing
// out and into a different Owner on the same device).
function AuthQueryClientCacheInvalidator() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const prevUidRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const uid = user?.uid ?? null;
    if (prevUidRef.current !== undefined && prevUidRef.current !== uid) {
      qc.clear();
    }
    prevUidRef.current = uid;
  }, [user?.uid, qc]);

  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-primary text-sm animate-pulse">Loading…</div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/workers" component={Workers} />
        <Route path="/labour-records" component={LabourRecords} />
        <Route path="/work-groups" component={WorkGroups} />
        <Route path="/work-groups/:id/attendance" component={AttendancePage} />
        <Route path="/crops" component={Crops} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/sprays" component={Sprays} />
        <Route path="/harvests" component={Harvests} />
        <Route path="/loans" component={Loans} />
        <Route path="/reports" component={Reports} />
        <Route path="/agri-ai" component={AgriAI} />
        <Route path="/disease" component={Disease} />
        <Route path="/shop" component={Shop} />
        <Route path="/daily-update" component={DailyUpdate} />
        <Route path="/bin" component={BinPage} />
        <Route path="/my-ads" component={MyAdsPage} />
        <Route path="/nursery-admin" component={NurseryAdmin} />
        <Route path="/nursery" component={NurseryShop} />
        <Route path="/agri-doctor" component={AgriDoctor} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/subscription/success" component={SubscriptionSuccess} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/mandi" component={MandiPrices} />
        <Route path="/equipment" component={Equipment} />
        <Route path="/manager-devices" component={ManagerDevices} />
        <Route path="/sync-log" component={SyncLog} />
        <Route path="/farm-accounts" component={FarmAccounts} />
        <Route path="/accounts-scan" component={AccountsScan} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/help" component={HelpPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Signed-out visitors see the marketing landing page at "/"; its "Sign In" /
// "Sign Up" CTAs are real, deep-linkable routes rather than local UI state,
// so a bookmarked or shared /login or /signup link works on its own.
function UnauthenticatedGate() {
  const [, navigate] = useLocation();

  return (
    <Switch>
      <Route path="/login"><SignInPage initialMode="signin" /></Route>
      <Route path="/signup"><SignInPage initialMode="signup" /></Route>
      <Route>
        <Landing onNavigate={(target) => navigate(`/${target}`)} />
      </Route>
    </Switch>
  );
}

// Mandatory sign-in gate: every route above is unreachable until Firebase
// reports a signed-in user. No onboarding/estate/subscription step is forced
// here — a fresh Owner lands straight on the Dashboard, which shows its own
// empty state until they create an estate.
function Gated() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <UnauthenticatedGate />;

  return (
    <ErrorBoundary>
      <DeviceGate>
        <SidebarProvider>
          <div className="flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              <Router />
            </div>
          </div>
        </SidebarProvider>
      </DeviceGate>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <EstateProvider>
            <SyncProvider>
              <AuthProvider>
                <AuthQueryClientCacheInvalidator />
                <WouterRouter base={basePath}>
                  <Gated />
                </WouterRouter>
                <Toaster />
              </AuthProvider>
            </SyncProvider>
          </EstateProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
