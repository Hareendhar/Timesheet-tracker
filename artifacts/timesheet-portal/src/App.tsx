import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Login } from "@/pages/login";
import { AppLayout } from "@/components/layout/app-layout";

import Dashboard from "@/pages/dashboard";
import Timesheets from "@/pages/timesheets";
import TimesheetNew from "@/pages/timesheet-new";
import TimesheetDetail from "@/pages/timesheet-detail";
import Approvals from "@/pages/approvals";
import Employees from "@/pages/employees";
import EmployeeProfile from "@/pages/employee-profile";
import Clients from "@/pages/clients";
import Projects from "@/pages/projects";
import Activities from "@/pages/activities";
import Notifications from "@/pages/notifications";
import AuditLogs from "@/pages/audit-logs";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/timesheets" component={Timesheets} />
            <Route path="/timesheets/new" component={TimesheetNew} />
            <Route path="/timesheets/:id" component={TimesheetDetail} />
            <Route path="/approvals" component={Approvals} />
            <Route path="/employees" component={Employees} />
            <Route path="/employees/:id" component={EmployeeProfile} />
            <Route path="/clients" component={Clients} />
            <Route path="/projects" component={Projects} />
            <Route path="/activities" component={Activities} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/audit-logs" component={AuditLogs} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
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
