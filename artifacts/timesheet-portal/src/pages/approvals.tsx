import { useListTimesheets, useBulkTimesheetAction } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Eye, Check, X, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Approvals() {
  const { toast } = useToast();
  const { data: timesheets, isLoading, refetch } = useListTimesheets({ status: "Submitted", pageSize: 50 });
  const bulkAction = useBulkTimesheetAction();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [rejectComment, setRejectComment] = useState("");

  const rows = timesheets?.data ?? [];
  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleApprove = async (ids: string[]) => {
    try {
      await bulkAction.mutateAsync({ data: { timesheetIds: ids, action: "approve" } });
      toast({ title: `${ids.length} timesheet${ids.length > 1 ? "s" : ""} approved` });
      setSelectedIds(new Set());
      refetch();
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    }
  };

  const openRejectDialog = (ids: string[]) => {
    setRejectComment("");
    setRejectDialog({ open: true, ids });
  };

  const handleReject = async () => {
    try {
      await bulkAction.mutateAsync({ data: { timesheetIds: rejectDialog.ids, action: "reject", comment: rejectComment } });
      toast({ title: `${rejectDialog.ids.length} timesheet${rejectDialog.ids.length > 1 ? "s" : ""} rejected` });
      setSelectedIds(new Set());
      setRejectDialog({ open: false, ids: [] });
      setRejectComment("");
      refetch();
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sidebar">Approval Queue</h1>
        <p className="text-muted-foreground mt-1">Review and approve submitted timesheets.</p>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-md px-4 py-3">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              onClick={() => handleApprove(Array.from(selectedIds))} disabled={bulkAction.isPending}>
              <CheckCheck className="mr-2 h-4 w-4" /> Approve Selected
            </Button>
            <Button size="sm" variant="outline" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              onClick={() => openRejectDialog(Array.from(selectedIds))} disabled={bulkAction.isPending}>
              <X className="mr-2 h-4 w-4" /> Reject Selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        </div>
      )}

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
          ) : rows.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Week Of</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead>Submitted On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((ts) => (
                    <TableRow key={ts.id} className={selectedIds.has(ts.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(ts.id)} onCheckedChange={() => toggleOne(ts.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{ts.employeeName}</TableCell>
                      <TableCell>{ts.weekStartDate ? format(parseISO(ts.weekStartDate), "MMM d, yyyy") : "-"}</TableCell>
                      <TableCell className="text-right">{ts.totalHours}</TableCell>
                      <TableCell>
                        {ts.submittedAt ? format(parseISO(ts.submittedAt), "MMM d, yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/timesheets/${ts.id}`}>
                            <Button variant="ghost" size="icon" title="View details"><Eye className="h-4 w-4" /></Button>
                          </Link>
                          <Button variant="outline" size="icon" title="Approve"
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            onClick={() => handleApprove([ts.id])} disabled={bulkAction.isPending}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title="Reject"
                            className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            onClick={() => openRejectDialog([ts.id])} disabled={bulkAction.isPending}>
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
              <h3 className="text-lg font-medium">All caught up!</h3>
              <p className="text-muted-foreground mt-1">There are no pending timesheets to review.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialog.open} onOpenChange={(open) => { if (!open) setRejectDialog({ open: false, ids: [] }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectDialog.ids.length > 1 ? `${rejectDialog.ids.length} Timesheets` : "Timesheet"}</DialogTitle>
            <DialogDescription>Please provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea placeholder="Enter rejection reason..." value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, ids: [] })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectComment.trim() || bulkAction.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
