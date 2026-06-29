import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type EmployeeOption = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: "HR" | "Manager" | "Employee";
  department: string;
  designation: string;
};

const roleBadge: Record<string, string> = {
  HR: "bg-[#1F2B5B] text-white",
  Manager: "bg-[#1C75BC] text-white",
  Employee: "bg-[#29ABE2]/20 text-[#1C75BC]",
};

const DEV_MODE_AVAILABLE = import.meta.env.VITE_AUTH_DEV_MODE === "true";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  invalid_state: "Your sign-in session expired. Please try again.",
  oauth_failed: "Something went wrong talking to Google. Please try again.",
  domain_not_allowed: "Only company Google accounts can sign in.",
  not_authorized: "Your Google account isn't registered as an employee. Contact HR.",
};

function useLoginError(): string | null {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again.");
  }, []);
  return error;
}

function GoogleSignIn({ error }: { error: string | null }) {
  return (
    <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Sign in</CardTitle>
        <CardDescription>Use your company Google account to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 rounded-lg border border-border bg-background hover:bg-accent hover:border-primary/40 transition-all px-4 py-3 font-medium text-sm text-foreground"
        >
          <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.8 14-5l-6.5-5.3C29.6 35.4 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.7 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.5 5.3C40.9 36.4 44 31 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Sign in with Google
        </a>
      </CardContent>
    </Card>
  );
}

function DevEmployeePicker() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/users")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data as EmployeeOption[]).sort((a, b) => {
          const order: Record<string, number> = { HR: 0, Manager: 1, Employee: 2 };
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
      // Hard navigation so the entire app re-initialises with a fresh session
      window.location.href = "/";
    } catch {
      setError("Could not sign in. Please try again.");
      setSigningIn(null);
    }
  };

  return (
    <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Select your account</CardTitle>
        <CardDescription>Dev mode — choose who you are to continue to the portal.</CardDescription>
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
  );
}

export function Login() {
  const { data: user, isLoading: authLoading } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() },
  });
  const loginError = useLoginError();
  const [mode, setMode] = useState<"prod" | "dev">("prod");

  // If already authenticated, hard-navigate to dashboard (avoids React Router loop)
  useEffect(() => {
    if (!authLoading && user) {
      window.location.replace("/");
    }
  }, [authLoading, user]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sidebar text-sidebar-foreground px-4 py-10">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none" />

      <div className="z-10 w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-xl bg-primary flex items-center justify-center shadow-lg mb-3">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Versatile IT</h1>
          <p className="text-white/60">Enterprise Workforce Timesheet Portal</p>
        </div>

        {DEV_MODE_AVAILABLE && (
          <div className="flex justify-center">
            <div className="inline-flex rounded-lg border border-white/20 bg-white/5 p-1 text-xs">
              <button
                onClick={() => setMode("prod")}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === "prod" ? "bg-white text-sidebar" : "text-white/70"}`}
              >
                Prod mode
              </button>
              <button
                onClick={() => setMode("dev")}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === "dev" ? "bg-white text-sidebar" : "text-white/70"}`}
              >
                Dev mode
              </button>
            </div>
          </div>
        )}

        {mode === "dev" && DEV_MODE_AVAILABLE ? <DevEmployeePicker /> : <GoogleSignIn error={loginError} />}

        <p className="text-center text-xs text-white/40">
          Secure access for Versatile IT employees and contractors.
        </p>
      </div>
    </div>
  );
}
