import { useListTimesheets, useBulkTimesheetAction } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Eye, Check, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Approvals() {
  const { toast } = useToast();
  const { data: timesheets, isLoading, refetch } = useListTimesheets({ status: "Submitted", pageSize: 50 });
  const bulkAction = useBulkTimesheetAction();

  const [rejectDialogState, setRejectDialogState] = useState<{ open: boolean, timesheetId?: string }>({ open: false });
  const [rejectComment, setRejectComment] = useState("");

  const handleApprove = async (id: string) => {
    try {
      await bulkAction.mutateAsync({ data: { timesheetIds: [id], action: "approve" } });
      toast({ title: "Timesheet approved successfully" });
      refetch();
    } catch (err) {
      toast({ title: "Failed to approve timesheet", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectDialogState.timesheetId) return;
    try {
      await bulkAction.mutateAsync({ data: { timesheetIds: [rejectDialogState.timesheetId], action: "reject", comment: rejectComment } });
      toast({ title: "Timesheet rejected successfully" });
      setRejectDialogState({ open: false });
      setRejectComment("");
      refetch();
    } catch (err) {
      toast({ title: "Failed to reject timesheet", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sidebar">Approval Queue</h1>
        <p className="text-muted-foreground mt-1">Review and approve submitted timesheets.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Timesheets awaiting your review.</CardDescription>
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
                    <TableHead>Employee</TableHead>
                    <TableHead>Week Of</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead>Submitted On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.data.map((ts) => (
                    <TableRow key={ts.id}>
                      <TableCell className="font-medium">
                        <div>{ts.employeeName}</div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(ts.weekStartDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">{ts.totalHours}</TableCell>
                      <TableCell>
                        {ts.submittedAt ? format(parseISO(ts.submittedAt), "MMM d, yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/timesheets/${ts.id}`}>
                            <Button variant="ghost" size="icon" title="View details">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="outline" 
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                            size="icon" 
                            title="Approve"
                            onClick={() => handleApprove(ts.id)}
                            disabled={bulkAction.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800"
                            size="icon" 
                            title="Reject"
                            onClick={() => setRejectDialogState({ open: true, timesheetId: ts.id })}
                            disabled={bulkAction.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Check className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">All caught up!</h3>
              <p className="text-muted-foreground mt-1 mb-4">There are no pending timesheets to review.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogState.open} onOpenChange={(open) => setRejectDialogState(open ? { open } : { open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this timesheet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogState({ open: false })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectComment.trim() || bulkAction.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}