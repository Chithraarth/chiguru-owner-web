import { Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SyncProvider } from "@/lib/sync-manager";
import { LanguageProvider } from "@/lib/i18n";
import { EstateProvider, useEstate } from "@/lib/use-estate";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { DeviceGate } from "@/components/device-gate";
import { lazyWithReload } from "@/lib/lazy-with-reload";
import { SidebarProvider } from "@/lib/sidebar-context";
import { Sidebar } from "@/components/sidebar";
import SignInPage from "@/pages/sign-in";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import { TermsPage, PrivacyPage, DeleteAccountPage } from "@/pages/legal";

const Dashboard = lazyWithReload(() => import("@/pages/dashboard"));
const HelpPage = lazyWithReload(() => import("@/pages/help"));
const Onboarding = lazyWithReload(() => import("@/pages/onboarding"));
const WelcomePage = lazyWithReload(() => import("@/pages/welcome"));
const Workers = lazyWithReload(() => import("@/pages/workers"));
const LabourRecords = lazyWithReload(() => import("@/pages/labour-records"));
const LabourAttendance = lazyWithReload(() => import("@/pages/labour-attendance"));
const OldLedger = lazyWithReload(() => import("@/pages/old-ledger"));
const WorkGroups = lazyWithReload(() => import("@/pages/work-groups"));
const AttendancePage = lazyWithReload(() => import("@/pages/attendance"));
const Expenses = lazyWithReload(() => import("@/pages/expenses"));
const Sprays = lazyWithReload(() => import("@/pages/sprays"));
const Harvests = lazyWithReload(() => import("@/pages/harvests"));
const YearPlan = lazyWithReload(() => import("@/pages/year-plan"));
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
const ChooseEstate = lazyWithReload(() => import("@/pages/choose-estate"));
const PendingInvites = lazyWithReload(() => import("@/pages/pending-invites"));
const InviteeApp = lazyWithReload(() => import("@/invitee/InviteeApp").then((m) => ({ default: m.InviteeApp })));

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
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const { resetEstateChoice } = useEstate();
  const prevUidRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // While Firebase restores the session on load, user is briefly null -
    // that's not a sign-out, so don't treat it as an account change.
    if (loading) return;
    const uid = user?.uid ?? null;
    if (prevUidRef.current !== undefined && prevUidRef.current !== uid) {
      qc.clear();
      // The chosen farm belongs to the previous sign-in too - the next one
      // picks again on Choose Estate.
      resetEstateChoice();
    }
    prevUidRef.current = uid;
  }, [user?.uid, loading, qc, resetEstateChoice]);

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
        <Route path="/welcome" component={WelcomePage} />
        <Route path="/workers" component={Workers} />
        <Route path="/labour-records" component={LabourRecords} />
        <Route path="/labour-payments" component={LabourRecords} />
        <Route path="/labour-attendance" component={LabourAttendance} />
        <Route path="/old-ledger" component={OldLedger} />
        <Route path="/work-groups" component={WorkGroups} />
        <Route path="/work-groups/:id/attendance" component={AttendancePage} />
        <Route path="/crops" component={Crops} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/sprays" component={Sprays} />
        <Route path="/harvests" component={Harvests} />
        <Route path="/year-plan" component={YearPlan} />
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
// so a bookmarked or shared /login or /signup link works on its own. Same
// goes for /terms and /privacy, e.g. for app store listing links.
function UnauthenticatedGate() {
  const [, navigate] = useLocation();

  return (
    <Switch>
      <Route path="/login"><SignInPage initialMode="signin" /></Route>
      <Route path="/signup"><SignInPage initialMode="signup" /></Route>
      <Route path="/terms"><TermsPage /></Route>
      <Route path="/privacy"><PrivacyPage /></Route>
      <Route path="/delete-account"><DeleteAccountPage /></Route>
      <Route>
        <Landing onNavigate={(target) => navigate(`/${target}`)} />
      </Route>
    </Switch>
  );
}

// Routes that only make sense while signed out — if a login/signup succeeds
// while the URL is still sitting on one of these, they'd otherwise 404
// against the authenticated Router() below, which doesn't register them.
const SIGNED_OUT_ONLY_PATHS = new Set(["/login", "/signup"]);

// Mandatory sign-in gate: every route above is unreachable until Firebase
// reports a signed-in user. No onboarding/subscription step is forced here —
// a fresh Owner lands straight on the Dashboard, which shows its own empty
// state until they create an estate. The one exception is Choose Estate,
// below: someone with more than one estate relationship (their own farm(s)
// and/or one or more they're invited to) must pick which one to work on
// before anything else can load, since X-Estate-Id is what the API uses to
// resolve which Owner every subsequent request acts for.
function Gated() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();
  const { myEstates, myEstatesLoading, activeEstateId, activeRelationship, ownFarmSetup } = useEstate();
  const qc = useQueryClient();

  // Checked once per sign-in, before anything else can render - an invite
  // gives no access at all until explicitly accepted (see
  // PendingInvites and the backend's routes/invites.ts).
  const myInvitesQuery = useQuery<{ id: number }[]>({
    queryKey: ["my-invites"],
    queryFn: () => apiFetch("/me/invites"),
    enabled: !!user,
  });

  useEffect(() => {
    if (user && SIGNED_OUT_ONLY_PATHS.has(location)) {
      navigate("/", { replace: true });
    }
  }, [user, location, navigate]);

  if (loading) return <PageLoader />;
  if (!user) return <UnauthenticatedGate />;
  if (SIGNED_OUT_ONLY_PATHS.has(location)) return <PageLoader />;

  if (myEstatesLoading || myInvitesQuery.isLoading) return <PageLoader />;

  // Any invite this person hasn't yet accepted/declined must be resolved
  // before anything else - it never contributes to myEstates until then, so
  // showing this first (rather than after Choose Estate) means a first-time
  // invitee is never asked to "choose" between farms they haven't agreed to
  // help with yet.
  if ((myInvitesQuery.data?.length ?? 0) > 0) {
    return (
      <PendingInvites
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["my-estates"] });
        }}
      />
    );
  }

  // Skipped while setting up your own farm from invitee mode - no farm is
  // active on purpose until the new one is created.
  // Anyone with more than one farm, or any invited farm, picks which one
  // to work on first - only a plain Owner with a single farm goes straight in.
  const needsEstateChoice =
    !ownFarmSetup &&
    (myEstates.length > 1 || myEstates.some((e) => e.relationship === "invited")) &&
    !myEstates.some((e) => e.id === activeEstateId);
  if (needsEstateChoice) return <ChooseEstate />;

  // A farm you were invited to gets exactly the old Manager app; your own
  // farm gets the full Owner app below.
  if (activeRelationship === "invited") {
    return (
      <ErrorBoundary>
        <DeviceGate>
          <Suspense fallback={<PageLoader />}>
            <InviteeApp />
          </Suspense>
        </DeviceGate>
      </ErrorBoundary>
    );
  }

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
