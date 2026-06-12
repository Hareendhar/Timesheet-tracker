import { useLocation } from "wouter";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type EmployeeOption = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Employee";
  department: string;
  designation: string;
};

const roleBadge: Record<string, string> = {
  Admin: "bg-[#1F2B5B] text-white",
  Manager: "bg-[#1C75BC] text-white",
  Employee: "bg-[#29ABE2]/20 text-[#1C75BC]",
};

export function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: authLoading } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() },
  });

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirected = useRef(false);
  useEffect(() => {
    if (user && !authLoading && !redirected.current) {
      redirected.current = true;
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    fetch("/api/auth/users")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data as EmployeeOption[]).sort((a, b) => {
          const order = { Admin: 0, Manager: 1, Employee: 2 };
          return (order[a.role] ?? 3) - (order[b.role] ?? 3);
        });
        setEmployees(sorted);
      })
      .catch(() => setError("Failed to load employee list."))
      .finally(() => setListLoading(false));
  }, []);

  const handleSelect = async (emp: EmployeeOption) => {
    setSigningIn(emp.id);
    setError(null);
    try {
      const res = await fetch("/api/auth/select-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Login failed");
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      setLocation("/");
    } catch {
      setError("Could not sign in. Please try again.");
      setSigningIn(null);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sidebar text-sidebar-foreground px-4 py-10">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none" />

      <div className="z-10 w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-xl bg-primary flex items-center justify-center shadow-lg mb-3">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Versatile IT</h1>
          <p className="text-white/60">Enterprise Workforce Timesheet Portal</p>
        </div>

        {/* Card */}
        <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select your account</CardTitle>
            <CardDescription>Choose who you are to continue to the portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 text-sm">
                {error}
              </div>
            )}

            {listLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading employees…</span>
              </div>
            ) : employees.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No active employees found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleSelect(emp)}
                    disabled={!!signingIn}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background hover:bg-accent hover:border-primary/40 transition-all px-4 py-3 text-left group disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      {signingIn === emp.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{emp.name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${roleBadge[emp.role] ?? "bg-muted text-muted-foreground"}`}>
                          {emp.role}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{emp.designation} · {emp.department}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/40">
          Secure access for Versatile IT employees and contractors.
        </p>
      </div>
    </div>
  );
}
