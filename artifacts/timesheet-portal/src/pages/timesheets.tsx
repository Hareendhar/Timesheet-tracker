import { useListTimesheets, useGetCurrentUser, getListTimesheetsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Eye, MoreHorizontal, Clock } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Timesheets() {
  const { data: user } = useGetCurrentUser();
  const tsParams = { employeeId: user?.id, pageSize: 20 };
  const { data: timesheets, isLoading } = useListTimesheets(
    tsParams,
    { query: { enabled: !!user?.id, queryKey: getListTimesheetsQueryKey(tsParams) } }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved": return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Approved</Badge>;
      case "Submitted": return <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-200">Submitted</Badge>;
      case "Rejected": return <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-200">Rejected</Badge>;
      case "Draft": return <Badge variant="secondary" className="border-gray-200">Draft</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">My Timesheets</h1>
          <p className="text-muted-foreground mt-1">Manage and submit your weekly timesheets.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/timesheets/new">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> New Timesheet
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Timesheets</CardTitle>
          <CardDescription>Your timesheets from recent weeks.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : timesheets?.data && timesheets.data.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week Of</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead>Submitted On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.data.map((ts) => (
                    <TableRow key={ts.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(ts.weekStartDate), "MMM d, yyyy")} - {format(parseISO(ts.weekEndDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(ts.status)}</TableCell>
                      <TableCell className="text-right">{ts.totalHours}</TableCell>
                      <TableCell>
                        {ts.submittedAt ? format(parseISO(ts.submittedAt), "MMM d, yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/timesheets/${ts.id}`} className="flex w-full items-center">
                                {ts.status === "Draft" || ts.status === "Rejected" ? (
                                  <><Edit className="mr-2 h-4 w-4" /> Edit</>
                                ) : (
                                  <><Eye className="mr-2 h-4 w-4" /> View</>
                                )}
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">No timesheets found</h3>
              <p className="text-muted-foreground mt-1 mb-4">You haven't created any timesheets yet.</p>
              <Link href="/timesheets/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Create your first timesheet
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}