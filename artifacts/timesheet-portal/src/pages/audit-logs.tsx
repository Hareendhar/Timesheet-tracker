import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AuditLogs() {
  const { data: logs, isLoading } = useListAuditLogs({ pageSize: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sidebar">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">System-wide activity and security log.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : logs?.items && logs.items.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(parseISO(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell>{log.role}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No audit logs found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}