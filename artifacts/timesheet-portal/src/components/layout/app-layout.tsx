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
  LayoutDashboard, Clock, ClipboardCheck, Users, Building2, Briefcase,
  Activity, Bell, Search, Settings, LogOut, FileText, X, ChevronRight,
  ChevronDown, Database, Send,
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
      window.location.replace("/login");
    }
  }, [isLoading, isError, user]);

  const handleLogout = async () => {
    try { await logout.mutateAsync(undefined); } catch { /* ignore */ }
    window.location.href = "/login";
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-12 w-12 rounded-full" /></div>;
  }

  if (!user) return null;

  const isAdmin = user.role === "Admin";
  const isHR = user.role === "HR";
  const isManager = user.role === "Manager" || isAdmin;
  const canSeeMasters = isAdmin || isHR;

  const mastersInPath = ["/employees", "/clients", "/projects", "/activities"].some(
    p => location === p || location.startsWith(p + "/")
  );

  const mastersItems = [
    { icon: Users, label: "Employees", href: "/employees", color: "text-emerald-400", adminOnly: false },
    ...(isAdmin ? [
      { icon: Building2, label: "Clients", href: "/clients", color: "text-sky-400", adminOnly: true },
      { icon: Briefcase, label: "Projects", href: "/projects", color: "text-orange-400", adminOnly: true },
      { icon: Activity, label: "Activities", href: "/activities", color: "text-pink-400", adminOnly: true },
    ] : []),
  ];

  const topNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/", color: "text-[#29ABE2]" },
    { icon: Clock, label: "My Timesheets", href: "/timesheets", color: "text-violet-400" },
    ...(isManager ? [{ icon: ClipboardCheck, label: "Approvals", href: "/approvals", color: "text-amber-400" }] : []),
    ...(isHR ? [{ icon: Send, label: "Client Submissions", href: "/client-submissions", color: "text-teal-400" }] : []),
  ];

  const bottomNavItems = [
    ...((isAdmin || isHR) ? [{ icon: FileText, label: "Audit Logs", href: "/audit-logs", color: "text-slate-300" }] : []),
  ];

  const SidebarNav = () => {
    const [mastersOpen, setMastersOpen] = useState(mastersInPath);

    return (
      <nav className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto">
        {topNavItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-primary/90 text-white shadow-md shadow-sidebar-primary/20"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isActive ? "bg-white/15" : "bg-sidebar-accent/40 group-hover:bg-sidebar-accent/70"
              }`}>
                <item.icon className={`h-[15px] w-[15px] ${isActive ? "text-white" : item.color}`} />
              </div>
              <span className="flex-1 tracking-[-0.01em]">{item.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          );
        })}

        {canSeeMasters && (
          <div>
            <button
              onClick={() => setMastersOpen(o => !o)}
              className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                mastersInPath && !mastersOpen
                  ? "bg-sidebar-primary/90 text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                mastersInPath && !mastersOpen ? "bg-white/15" : "bg-sidebar-accent/40 group-hover:bg-sidebar-accent/70"
              }`}>
                <Database className={`h-[15px] w-[15px] ${mastersInPath && !mastersOpen ? "text-white" : "text-teal-400"}`} />
              </div>
              <span className="flex-1 tracking-[-0.01em] text-left">Masters</span>
              <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${mastersOpen ? "rotate-180" : ""}`} />
            </button>

            {mastersOpen && (
              <div className="ml-4 mt-0.5 pl-3 border-l border-sidebar-border/30 space-y-0.5">
                {mastersItems.map((item) => {
                  const isActive = location === item.href || location.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-sidebar-primary/90 text-white shadow-md shadow-sidebar-primary/20"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? "bg-white/15" : "bg-sidebar-accent/40 group-hover:bg-sidebar-accent/70"
                      }`}>
                        <item.icon className={`h-[13px] w-[13px] ${isActive ? "text-white" : item.color}`} />
                      </div>
                      <span className="flex-1 tracking-[-0.01em]">{item.label}</span>
                      {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {bottomNavItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-primary/90 text-white shadow-md shadow-sidebar-primary/20"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isActive ? "bg-white/15" : "bg-sidebar-accent/40 group-hover:bg-sidebar-accent/70"
              }`}>
                <item.icon className={`h-[15px] w-[15px] ${isActive ? "text-white" : item.color}`} />
              </div>
              <span className="flex-1 tracking-[-0.01em]">{item.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-sidebar-border/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1C75BC] to-[#29ABE2] flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-[#29ABE2]/20">
            V
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-[15px] tracking-tight text-white">Versatile IT</span>
            <span className="text-[10px] text-sidebar-foreground/40 uppercase tracking-widest mt-0.5">Solutions</span>
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 py-4 border-b border-sidebar-border/40 mx-3 mt-3 rounded-xl bg-sidebar-accent/40">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-sidebar-primary/40">
              <AvatarFallback className="bg-gradient-to-br from-[#1C75BC] to-[#29ABE2] text-white font-bold text-sm">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold text-white leading-none truncate">{user.name}</span>
              <span className="text-[11px] text-sidebar-foreground/50 mt-1">{user.role}</span>
            </div>
          </div>
        </div>

        <SidebarNav />

        {/* Settings footer */}
        <div className="p-3 border-t border-sidebar-border/40">
          <Link
            href="/settings"
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
              location === "/settings"
                ? "bg-sidebar-primary/90 text-white"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              location === "/settings" ? "bg-white/15" : "bg-sidebar-accent/40 group-hover:bg-sidebar-accent/70"
            }`}>
              <Settings className="h-[15px] w-[15px] text-slate-300" />
            </div>
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-card/80 backdrop-blur-sm border-b border-border/60 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0 shadow-sm">
          <div className="flex items-center gap-3 flex-1">
            {/* Global Search */}
            <div ref={searchRef} className="relative w-full max-w-sm hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              <Input
                type="search"
                placeholder="Search people, projects, timesheets…"
                className="w-full pl-9 pr-8 h-9 text-sm bg-muted/40 border-transparent rounded-xl focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/50"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(e.target.value.length >= 2);
                }}
                onFocus={() => { if (searchQuery.length >= 2) setSearchOpen(true); }}
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {searchOpen && debouncedQuery.length >= 2 && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border/60 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                  {!hasResults ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No results for &ldquo;{debouncedQuery}&rdquo;</p>
                  ) : (
                    <div className="p-1.5">
                      {(searchResults?.employees?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground/70 px-2.5 py-1.5 uppercase tracking-widest">People</p>
                          {searchResults!.employees!.map((emp: any) => (
                            <button
                              key={emp.id}
                              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/60 text-left text-sm transition-colors"
                              onClick={() => handleSearchNav((isAdmin || isHR) ? `/employees/${emp.id}` : "/timesheets")}
                            >
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{emp.name?.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <span className="font-medium text-[13px]">{emp.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">{emp.email}</span>
                              </div>
                              <Badge variant="outline" className="ml-auto text-[10px] shrink-0">{emp.department}</Badge>
                            </button>
                          ))}
                        </div>
                      )}

                      {(searchResults?.projects?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground/70 px-2.5 py-1.5 uppercase tracking-widest">Projects</p>
                          {searchResults!.projects!.map((proj: any) => (
                            <button
                              key={proj.id}
                              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/60 text-left text-sm transition-colors"
                              onClick={() => handleSearchNav("/projects")}
                            >
                              <div className="w-6 h-6 rounded-md bg-orange-100 flex items-center justify-center shrink-0">
                                <Briefcase className="h-3.5 w-3.5 text-orange-500" />
                              </div>
                              <span className="font-medium text-[13px]">{proj.name}</span>
                              <span className="text-muted-foreground text-xs ml-1">({proj.projectCode})</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {(searchResults?.clients?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground/70 px-2.5 py-1.5 uppercase tracking-widest">Clients</p>
                          {searchResults!.clients!.map((client: any) => (
                            <button
                              key={client.id}
                              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/60 text-left text-sm transition-colors"
                              onClick={() => handleSearchNav("/clients")}
                            >
                              <div className="w-6 h-6 rounded-md bg-sky-100 flex items-center justify-center shrink-0">
                                <Building2 className="h-3.5 w-3.5 text-sky-500" />
                              </div>
                              <span className="font-medium text-[13px]">{client.name}</span>
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

          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors">
              <Bell className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              {notifications?.unreadCount && notifications.unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-card" />
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 hover:ring-2 hover:ring-primary/20 transition-all">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-[#1C75BC] to-[#29ABE2] text-white font-bold text-xs">{user.name.charAt(0)}</AvatarFallback>
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
