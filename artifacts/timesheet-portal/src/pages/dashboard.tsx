import { useGetDashboardStats, useGetTimesheetStatusBreakdown, useGetRecentActivity, useGetComplianceOverview, useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, CheckCircle, AlertTriangle, XCircle, FileText, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Dashboard() {
  const { data: user } = useGetCurrentUser();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: breakdown, isLoading: breakdownLoading } = useGetTimesheetStatusBreakdown();
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 });
  const { data: compliance, isLoading: complianceLoading } = useGetComplianceOverview();

  const isManager = user?.role === "Manager" || user?.role === "Admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sidebar">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {user?.name}. Here's what's happening.</p>
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
        <Card className="col-span-1">
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

        {isManager && (
          <Card className="col-span-1">
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
        )}
      </div>
    </div>
  );
}