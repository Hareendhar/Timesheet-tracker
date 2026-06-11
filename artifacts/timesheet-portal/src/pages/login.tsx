import { useLocation } from "wouter";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export function Login() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetCurrentUser({
    query: {
      retry: false,
      queryKey: getGetCurrentUserQueryKey(),
    }
  });

  useEffect(() => {
    if (user && !isLoading) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  const handleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  // Read error from OAuth redirect query param
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const errorMessages: Record<string, string> = {
    not_configured: "Your account is not registered in the system. Please contact your administrator.",
    token_exchange_failed: "Authentication failed. Please try again.",
    invalid_state: "Authentication request expired or invalid. Please try again.",
    auth_error: "An error occurred during sign-in. Please try again.",
    no_code: "Sign-in was cancelled. Please try again.",
  };
  const errorMessage = error ? (errorMessages[error] ?? "An unexpected error occurred.") : null;

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar text-sidebar-foreground">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
      
      <Card className="w-full max-w-md border-0 shadow-2xl bg-card/95 backdrop-blur-sm z-10">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-xl bg-primary flex items-center justify-center shadow-lg mb-2">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Versatile IT</CardTitle>
          <CardDescription className="text-base">
            Enterprise Workforce Timesheet Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button 
            className="w-full h-12 text-base font-medium shadow-sm" 
            onClick={handleLogin}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Secure access for Versatile IT employees and contractors.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}