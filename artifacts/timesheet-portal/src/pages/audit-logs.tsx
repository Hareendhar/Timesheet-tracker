import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Search, X } from "lucide-react";

export default function AuditLogs() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { data: logs, isLoading } = useListAuditLogs({
    pageSize: 200,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
  });

  const filtered = (logs?.data ?? []).filter((log) => {
    if (userFilter && !log.userName?.toLowerCase().includes(userFilter.toLowerCase())) return false;
    if (actionFilter && !log.action?.toLowerCase().includes(actionFilter.toLowerCase())) return false;
    return true;
  });

  const clearFilters = () => {
    setDateFrom(""); setDateTo(""); setUserFilter(""); setActionFilter("");
  };

  const buildExportUrl = (fmt: "csv" | "xlsx") => {
    const p = new URLSearchParams({ format: fmt });
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo)   p.set("dateTo", dateTo);
    return `/api/export/audit-logs?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">System-wide activity and security log.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(buildExportUrl("csv"), "_blank")}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(buildExportUrl("xlsx"), "_blank")}>
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Date From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">User</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by user..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by action..."
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
          </div>
          {(dateFrom || dateTo || userFilter || actionFilter) && (
            <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" /> Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Activity Log
            {!isLoading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length} entries)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.role}</TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell className="text-sm">{log.entityType}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.ipAddress}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No audit logs match the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
