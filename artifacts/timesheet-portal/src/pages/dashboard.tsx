import {
  useGetDashboardStats, useGetTimesheetStatusBreakdown, useGetRecentActivity,
  useGetComplianceOverview, useGetCurrentUser, useGetDashboardMyStats,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, CheckCircle, XCircle, FileText, User, Send, RotateCcw, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

function EmployeeDashboard({ userName }: { userName: string }) {
  const { data: my, isLoading } = useGetDashboardMyStats();

  const stats = [
    { label: "Total Timesheets", value: my?.total ?? 0, icon: FileText, iconBg: "bg-primary/10", iconColor: "text-primary" },
    { label: "Approved", value: my?.approved ?? 0, icon: CheckCircle, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Submitted", value: my?.submitted ?? 0, icon: Send, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Rejected", value: my?.rejected ?? 0, icon: XCircle, iconBg: "bg-red-50", iconColor: "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-sidebar">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back, {userName}.</p>
        </div>
        <Link href="/timesheets/new">
          <Button className="rounded-xl gap-2 shadow-sm">
            <Clock className="h-4 w-4" /> New Timesheet
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <Card key={label} className="rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
                    <div className="text-3xl font-bold tracking-tight">{value}</div>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold">Total Hours Logged</CardTitle>
            <CardDescription className="text-xs">Across all your timesheets.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-12 w-24" /> : (
              <div className="flex items-end gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-primary">{(my?.totalHours ?? 0).toFixed(1)}</span>
                <span className="text-sm text-muted-foreground mb-1.5 font-medium">hrs</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Common timesheet tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/timesheets/new">
              <Button variant="outline" className="w-full justify-start rounded-xl text-sm gap-2.5 h-9">
                <Clock className="h-4 w-4 text-primary" /> Create New Timesheet
              </Button>
            </Link>
            <Link href="/timesheets">
              <Button variant="outline" className="w-full justify-start rounded-xl text-sm gap-2.5 h-9">
                <FileText className="h-4 w-4 text-muted-foreground" /> View My Timesheets
              </Button>
            </Link>
            {(my?.rejected ?? 0) > 0 && (
              <Link href="/timesheets">
                <Button variant="outline" className="w-full justify-start rounded-xl text-sm gap-2.5 h-9 text-red-600 border-red-200 hover:bg-red-50">
                  <RotateCcw className="h-4 w-4" /> Fix Rejected ({my?.rejected})
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ManagerDashboard({ userName }: { userName: string }) {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 });
  const { data: compliance, isLoading: complianceLoading } = useGetComplianceOverview();

  const statCards = [
    { label: "Pending Approvals", value: stats?.pendingApprovals ?? 0, icon: Clock, iconBg: "bg-amber-50", iconColor: "text-amber-500", sub: "Awaiting review" },
    { label: "Approved", value: stats?.timesheetsApproved ?? 0, icon: CheckCircle, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", sub: "Total approved" },
    { label: "Total Employees", value: stats?.totalEmployees ?? 0, icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-600", sub: "Active staff" },
    { label: "Compliance Rate", value: `${stats?.complianceRate ?? 0}%`, icon: TrendingUp, iconBg: "bg-violet-50", iconColor: "text-violet-600", sub: "Submission rate" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-sidebar">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Welcome back, {userName}. Here's what's happening.</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, iconBg, iconColor, sub }) => (
            <Card key={label} className="rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
                    <div className="text-3xl font-bold tracking-tight">{value}</div>
                    <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold">Recent Activity</CardTitle>
            <CardDescription className="text-xs">Latest actions in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold">{activity.employeeName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-snug">
                        <span className="font-semibold">{activity.employeeName}</span>{" "}
                        <span className="text-muted-foreground font-normal">{activity.action}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No recent activity.</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold">Compliance Overview</CardTitle>
            <CardDescription className="text-xs">Submission rates by department.</CardDescription>
          </CardHeader>
          <CardContent>
            {complianceLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-full rounded-lg" />)}
              </div>
            ) : compliance && compliance.length > 0 ? (
              <div className="space-y-3.5">
                {compliance.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium">{item.department}</span>
                      <span className="text-[13px] font-semibold tabular-nums">{item.complianceRate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-primary to-[#29ABE2] h-1.5 rounded-full transition-all"
                        style={{ width: `${item.complianceRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">No compliance data available.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: user, isLoading } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (user.role === "Employee") {
    return <EmployeeDashboard userName={user.name} />;
  }

  return <ManagerDashboard userName={user.name} />;
}
