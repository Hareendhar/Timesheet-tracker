import { useGetEmployeeProfile, useGetDirectReports, getGetEmployeeProfileQueryKey, getGetDirectReportsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Briefcase, Building, CheckCircle, XCircle, Clock } from "lucide-react";
import { useParams } from "wouter";

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: profile, isLoading } = useGetEmployeeProfile(id || "", {
    query: { enabled: !!id, queryKey: getGetEmployeeProfileQueryKey(id || "") }
  });
  
  const { data: reports } = useGetDirectReports(id || "", {
    query: { enabled: !!id, queryKey: getGetDirectReportsQueryKey(id || "") }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile) return <div>Employee not found</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <Avatar className="h-32 w-32 border-4 border-border">
              <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                {profile.employee.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold tracking-tight">{profile.employee.name}</h1>
              <p className="text-lg text-muted-foreground mt-1">{profile.employee.designation}</p>
              
              <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-6">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {profile.employee.email}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  {profile.employee.department}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Role: {profile.employee.role}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold mt-8 mb-4">Timesheet Metrics</h2>
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submitted</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{profile.metrics.totalSubmitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{profile.metrics.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{profile.metrics.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {reports && reports.directReports && reports.directReports.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mt-8 mb-4">Direct Reports</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.directReports.map((report) => (
              <Card key={report.employee.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">{report.employee.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm leading-none mb-1">{report.employee.name}</p>
                    <p className="text-xs text-muted-foreground">{report.employee.designation}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}