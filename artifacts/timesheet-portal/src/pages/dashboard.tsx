import {
  useGetDashboardStats, useGetTimesheetStatusBreakdown, useGetRecentActivity,
  useGetComplianceOverview, useGetCurrentUser, useGetDashboardMyStats,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, CheckCircle, AlertTriangle, XCircle, FileText, User, Send, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

function EmployeeDashboard({ userName }: { userName: string }) {
  const { data: my, isLoading } = useGetDashboardMyStats();

  const stats = [
    { label: "Total Timesheets", value: my?.total ?? 0, icon: FileText, color: "text-primary" },
    { label: "Approved", value: my?.approved ?? 0, icon: CheckCircle, color: "text-green-600" },
    { label: "Submitted", value: my?.submitted ?? 0, icon: Send, color: "text-blue-600" },
    { label: "Rejected", value: my?.rejected ?? 0, icon: XCircle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {userName}.</p>
        </div>
        <Link href="/timesheets/new">
          <Button>
            <Clock className="mr-2 h-4 w-4" /> New Timesheet
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Hours Logged</CardTitle>
            <CardDescription>Across all your timesheets.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-12 w-24" /> : (
              <div className="text-4xl font-bold text-primary">{(my?.totalHours ?? 0).toFixed(1)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common timesheet tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/timesheets/new">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="mr-2 h-4 w-4" /> Create New Timesheet
              </Button>
            </Link>
            <Link href="/timesheets">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" /> View My Timesheets
              </Button>
            </Link>
            {(my?.rejected ?? 0) > 0 && (
              <Link href="/timesheets">
                <Button variant="outline" className="w-full justify-start text-destructive border-destructive/40 hover:bg-destructive/10">
                  <RotateCcw className="mr-2 h-4 w-4" /> Fix Rejected Timesheets ({my?.rejected})
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sidebar">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {userName}. Here's what's happening.</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.pendingApprovals}</div>
              <p className="text-xs text-muted-foreground mt-1">Timesheets awaiting review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Timesheets Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.timesheetsApproved}</div>
              <p className="text-xs text-muted-foreground mt-1">Total approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalEmployees}</div>
              <p className="text-xs text-muted-foreground mt-1">Active staff</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Rate</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.complianceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Submission compliance</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary">{activity.employeeName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none mb-1">
                        <span className="font-semibold">{activity.employeeName}</span> {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">No recent activity.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Overview</CardTitle>
            <CardDescription>Submission rates by department.</CardDescription>
          </CardHeader>
          <CardContent>
            {complianceLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : compliance && compliance.length > 0 ? (
              <div className="space-y-4">
                {compliance.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="font-medium text-sm">{item.department}</div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${item.complianceRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">{item.complianceRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">No compliance data available.</div>
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
