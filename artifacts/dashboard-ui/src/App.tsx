import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import UserWorkflowPage from "@/pages/user-workflow";
import UserProtectPage from "@/pages/user-protect";
import UserScanPage from "@/pages/user-scan";
import Overview from "@/pages/overview";
import Forensic from "@/pages/forensic";
import Audit from "@/pages/audit";
import BotTrap from "@/pages/bot-trap";
import DataCloak from "@/pages/data-cloak";
import Radar from "@/pages/radar";
import DistributionMap from "@/pages/distribution-map";
import Settings from "@/pages/settings";
import LastVideoTestPage from "@/pages/last-video-test";
import NewMiniTestPage from "@/pages/new-mini-test";
import TestHistoryPage from "@/pages/test-history";
import LearningSummaryPage from "@/pages/learning-summary";
import ImprovementSuggestionsPage from "@/pages/improvement-suggestions";
import ZehirReportPage from "@/pages/zehir-report";
import SecureRoomReportPage from "@/pages/secure-room-report";
import DiscoveryProviderSetupPage from "@/pages/discovery-provider-setup";
import LiveRealLabReadinessPage from "@/pages/live-real-lab-readiness";
import CanonicalDnaPage from "@/pages/dna-canonical";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={UserWorkflowPage} />
        <Route path="/protect-file" component={UserProtectPage} />
        <Route path="/scan-leak" component={UserScanPage} />
        <Route path="/overview" component={Overview} />
        <Route path="/forensic" component={Forensic} />
        <Route path="/audit" component={Audit} />
        <Route path="/bot-trap" component={BotTrap} />
        <Route path="/data-cloak" component={DataCloak} />
        <Route path="/radar" component={Radar} />
        <Route path="/distribution-map" component={DistributionMap} />
        <Route path="/new-mini-test" component={NewMiniTestPage} />
        <Route path="/last-video-test" component={LastVideoTestPage} />
        <Route path="/test-history" component={TestHistoryPage} />
        <Route path="/learning-summary" component={LearningSummaryPage} />
        <Route path="/dna-canonical" component={CanonicalDnaPage} />
        <Route path="/improvement-suggestions" component={ImprovementSuggestionsPage} />
        <Route path="/secure-room-report" component={SecureRoomReportPage} />
        <Route path="/discovery-provider-setup" component={DiscoveryProviderSetupPage} />
        <Route path="/live-readiness" component={LiveRealLabReadinessPage} />
        <Route path="/zehir-report" component={ZehirReportPage} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
