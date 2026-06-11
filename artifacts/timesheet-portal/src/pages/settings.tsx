import { useGetCurrentUser, useGetEmployeeProfile, getGetEmployeeProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Briefcase, Building, Shield, Download } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const { data: user } = useGetCurrentUser();
  const { data: profile, isLoading } = useGetEmployeeProfile(user?.employeeId || "", {
    query: { enabled: !!user?.employeeId, queryKey: getGetEmployeeProfileQueryKey(user?.employeeId || "") }
  });

  const isAdmin = user?.role === "Admin";

  const handleExport = (type: string) => {
    // In a real app, this would trigger the export endpoints via window.open
    window.open(`/api/export/${type}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sidebar">Settings & Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and system settings.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your personal details and organizational role.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ) : user && profile ? (
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 border-2 border-border">
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold">{user.name}</h3>
                    <p className="text-muted-foreground">{profile.employee.designation}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Building className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Department</p>
                      <p className="text-sm font-medium">{profile.employee.department}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">System Role</p>
                      <p className="text-sm font-medium">{user.role}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Manager</p>
                      <p className="text-sm font-medium">{profile.employee.managerId || "None"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Theme</CardTitle>
              <CardDescription>Customize your interface.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Currently using system default. (Theme toggle functionality would be here)
              </p>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Data Exports</CardTitle>
                <CardDescription>Export system data to CSV.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={() => handleExport("employees")}>
                  <Download className="mr-2 h-4 w-4" /> Export Employees
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleExport("timesheets")}>
                  <Download className="mr-2 h-4 w-4" /> Export Timesheets
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleExport("audit-logs")}>
                  <Download className="mr-2 h-4 w-4" /> Export Audit Logs
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}