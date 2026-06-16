import { useState, useCallback } from "react";
import { useListProjects, useListEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Download, Search, Filter, X, RefreshCw, CheckSquare } from "lucide-react";

type SubmissionRow = {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  managerName: string | null;
  projectNames: string | null;
  projectCodes: string | null;
  clientNames: string | null;
  clientManagerNames: string | null;
  clientManagerEmails: string | null;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  status: string;
  approvedAt: string | null;
  clientSubmittedAt: string | null;
  clientSubmittedBy: string | null;
};

const API_BASE = "/api";

function statusBadge(status: string) {
  if (status === "Approved")
    return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/25">Ready for Client</Badge>;
  if (status === "ClientSubmitted")
    return <Badge className="bg-teal-500/15 text-teal-700 border-teal-200 hover:bg-teal-500/25">Sent to Client</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function ClientSubmissions() {
  const { toast } = useToast();
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: managers } = useListEmployees({ pageSize: 200 });

  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState({
    projectId: "",
    clientManagerEmail: "",
    managerId: "",
    status: "",
  });
  const [applied, setApplied] = useState({ ...filters });

  const PAGE_SIZE = 25;

  const managerEmployees = (managers?.data ?? []).filter(
    (e: any) => e.role === "Manager" || e.role === "Admin"
  );

  const fetchData = useCallback(async (f: typeof filters, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.clientManagerEmail ? { clientManagerEmail: f.clientManagerEmail } : {}),
        ...(f.managerId ? { managerId: f.managerId } : {}),
        ...(f.status ? { status: f.status } : {}),
      });
      const res = await fetch(`${API_BASE}/client-submissions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: "Failed to load timesheets", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const applyFilters = () => {
    setApplied({ ...filters });
    setPage(1);
    fetchData(filters, 1);
  };

  const clearFilters = () => {
    const empty = { projectId: "", clientManagerEmail: "", managerId: "", status: "" };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
    fetchData(empty, 1);
  };

  const goPage = (p: number) => {
    setPage(p);
    fetchData(applied, p);
  };

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(r => r.id)));
    }
  };

  const selectedApproved = rows.filter(r => selected.has(r.id) && r.status === "Approved");

  const handleSubmit = async () => {
    if (selectedApproved.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/client-submissions/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timesheetIds: selectedApproved.map(r => r.id) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      toast({ title: `${json.submitted} timesheet(s) sent to client manager` });
      fetchData(applied, page);
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleDownload = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const url = `${API_BASE}/client-submissions/download?ids=${ids.join(",")}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `timesheets_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Client Submissions</h1>
          <p className="text-muted-foreground mt-1">
            Review manager-approved timesheets and submit to client managers for final approval.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchData(applied, page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Project</label>
              <Select value={filters.projectId} onValueChange={v => setFilters(f => ({ ...f, projectId: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All projects</SelectItem>
                  {(projects?.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Internal Manager</label>
              <Select value={filters.managerId} onValueChange={v => setFilters(f => ({ ...f, managerId: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All managers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All managers</SelectItem>
                  {managerEmployees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Client Manager Email</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="h-9 pl-8 text-sm"
                  placeholder="Search email..."
                  value={filters.clientManagerEmail}
                  onChange={e => setFilters(f => ({ ...f, clientManagerEmail: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") applyFilters(); }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v === "_all" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All statuses</SelectItem>
                  <SelectItem value="Approved">Ready for Client</SelectItem>
                  <SelectItem value="ClientSubmitted">Sent to Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={applyFilters}>
              <Search className="mr-1.5 h-3.5 w-3.5" /> Search
            </Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border/60 shadow-xl rounded-2xl px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="h-4 w-px bg-border" />
          {selectedApproved.length > 0 && (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setConfirmOpen(true)} disabled={submitting}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Submit to Client ({selectedApproved.length})
            </Button>
          )}
          <Button size="sm" variant="outline"
            onClick={() => handleDownload([...selected])}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download Excel
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              Approved Timesheets
              {total > 0 && (
                <Badge variant="secondary" className="font-mono">{total}</Badge>
              )}
            </CardTitle>
            {rows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                {selected.size === rows.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No timesheets found</p>
              <p className="text-sm mt-1">
                {total === 0 && !loading
                  ? "Click Refresh or apply filters to load manager-approved timesheets."
                  : "Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={selected.size > 0 && selected.size === rows.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Project(s)</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Client Manager</TableHead>
                    <TableHead>Internal Manager</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id} className={selected.has(row.id) ? "bg-primary/5" : "hover:bg-muted/30"}>
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={() => toggleRow(row.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{row.employeeName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{row.employeeCode}</div>
                        {row.department && <div className="text-xs text-muted-foreground">{row.department}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{row.weekStartDate}</div>
                        <div className="text-xs text-muted-foreground">to {row.weekEndDate}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[160px] truncate" title={row.projectNames ?? ""}>
                          {row.projectNames ?? <span className="text-muted-foreground italic">—</span>}
                        </div>
                        {row.projectCodes && (
                          <div className="text-xs font-mono text-muted-foreground">{row.projectCodes}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[120px] truncate" title={row.clientNames ?? ""}>
                          {row.clientNames ?? <span className="text-muted-foreground italic">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.clientManagerNames ? (
                          <div>
                            <div className="text-sm">{row.clientManagerNames}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[140px]" title={row.clientManagerEmails ?? ""}>
                              {row.clientManagerEmails}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {row.managerName ?? <span className="text-muted-foreground italic">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-sm">
                        {row.totalHours.toFixed(1)}h
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          variant="ghost" size="icon"
                          title="Download Excel for this timesheet"
                          onClick={() => handleDownload([row.id])}>
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border/40">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm submit dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit to Client Manager?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to submit <strong>{selectedApproved.length}</strong> timesheet(s) to the client manager(s) for final approval.
              Their status will change to <strong>Sent to Client</strong> and an email notification will be triggered.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Confirm Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
