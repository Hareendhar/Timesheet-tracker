import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser, useLogout, useListNotifications, useGlobalSearch,
  getGetCurrentUserQueryKey, getListNotificationsQueryKey, getGlobalSearchQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, Clock, CheckSquare, Users, Building, Briefcase,
  Activity, Bell, Search, Settings, LogOut, FileText, Menu, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AppLayoutProps {
  children: ReactNode;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() },
  });
  const logout = useLogout();
  const queryClient = useQueryClient();

  const { data: notifications } = useListNotifications(
    { unreadOnly: true, pageSize: 5 },
    { query: { enabled: !!user, queryKey: getListNotificationsQueryKey({ unreadOnly: true, pageSize: 5 }) } }
  );

  // Global search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = useGlobalSearch(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length >= 2, queryKey: getGlobalSearchQueryKey({ q: debouncedQuery }) } }
  );

  const hasResults = searchResults && (
    (searchResults.employees?.length ?? 0) > 0 ||
    (searchResults.projects?.length ?? 0) > 0 ||
    (searchResults.clients?.length ?? 0) > 0
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchNav = (path: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setLocation(path);
  };

  useEffect(() => {
    if (!isLoading && (!user || isError)) {
      setLocation("/login");
    }
  }, [isLoading, isError, user, setLocation]);

  const handleLogout = async () => {
    await logout.mutateAsync(undefined);
    // Clear all cached data so the login page doesn't see stale user state
    queryClient.clear();
    setLocation("/login");
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-12 w-12 rounded-full" /></div>;
  }

  if (!user) return null;

  const isAdmin = user.role === "Admin";
  const isManager = user.role === "Manager" || isAdmin;

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Clock, label: "My Timesheets", href: "/timesheets" },
    ...(isManager ? [{ icon: CheckSquare, label: "Approvals", href: "/approvals" }] : []),
    ...(isAdmin ? [
      { icon: Users, label: "Employees", href: "/employees" },
      { icon: Building, label: "Clients", href: "/clients" },
      { icon: Briefcase, label: "Projects", href: "/projects" },
      { icon: Activity, label: "Activities", href: "/activities" },
      { icon: FileText, label: "Audit Logs", href: "/audit-logs" },
    ] : []),
  ];

  return (
    <div className="min-h-screen flex bg-secondary/30">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-sm">
        <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center font-bold text-white shadow-sm">
            V
          </div>
          <span className="font-semibold text-lg tracking-tight">Versatile IT</span>
        </div>

        <div className="p-4 pb-2">
          <div className="flex items-center gap-3 mb-6">
            <Avatar className="h-10 w-10 border-2 border-sidebar-border bg-sidebar-accent">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-xs text-sidebar-foreground/70 mt-1">{user.role}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4 flex-1">
            {/* Global Search */}
            <div ref={searchRef} className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search timesheets, projects, people..."
                className="w-full pl-9 pr-8 bg-muted/50 border-transparent focus-visible:bg-background"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(e.target.value.length >= 2);
                }}
                onFocus={() => { if (searchQuery.length >= 2) setSearchOpen(true); }}
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Search Results Dropdown */}
              {searchOpen && debouncedQuery.length >= 2 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-card border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {!hasResults ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No results for "{debouncedQuery}"</p>
                  ) : (
                    <div className="p-1">
                      {(searchResults?.employees?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">People</p>
                          {searchResults!.employees!.map((emp: any) => (
                            <button
                              key={emp.id}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left text-sm"
                              onClick={() => handleSearchNav(isAdmin ? `/employees/${emp.id}` : "/timesheets")}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">{emp.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium">{emp.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">{emp.email}</span>
                              </div>
                              <Badge variant="outline" className="ml-auto text-xs">{emp.department}</Badge>
                            </button>
                          ))}
                        </div>
                      )}

                      {(searchResults?.projects?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">Projects</p>
                          {searchResults!.projects!.map((proj: any) => (
                            <button
                              key={proj.id}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left text-sm"
                              onClick={() => handleSearchNav("/projects")}
                            >
                              <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">{proj.name}</span>
                              <span className="text-muted-foreground text-xs ml-1">({proj.projectCode})</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {(searchResults?.clients?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">Clients</p>
                          {searchResults!.clients!.map((client: any) => (
                            <button
                              key={client.id}
                              className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted text-left text-sm"
                              onClick={() => handleSearchNav("/clients")}
                            >
                              <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">{client.name}</span>
                              <span className="text-muted-foreground text-xs ml-1">({client.clientCode})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
              <Bell className="h-5 w-5" />
              {notifications?.unreadCount && notifications.unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive border-2 border-card" />
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs text-muted-foreground leading-none">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="w-full cursor-pointer flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
