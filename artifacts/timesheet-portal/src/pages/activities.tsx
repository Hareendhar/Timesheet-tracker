import { useState } from "react";
import { useListActivities, useCreateActivity, useUpdateActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ActivityRow = { id: string; name: string; status: string };

export default function Activities() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: activities, isLoading } = useListActivities();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();

  const [dialog, setDialog] = useState<{ open: boolean; editing: ActivityRow | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ name: "", status: "Active" });

  const openCreate = () => {
    setForm({ name: "", status: "Active" });
    setDialog({ open: true, editing: null });
  };

  const openEdit = (a: ActivityRow) => {
    setForm({ name: a.name, status: a.status });
    setDialog({ open: true, editing: a });
  };

  const handleSave = async () => {
    try {
      if (dialog.editing) {
        await updateActivity.mutateAsync({ activityId: dialog.editing.id, data: form as any });
        toast({ title: "Activity updated" });
      } else {
        await createActivity.mutateAsync({ data: form as any });
        toast({ title: "Activity created" });
      }
      qc.invalidateQueries({ queryKey: ["/api/activities"] });
      setDialog({ open: false, editing: null });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to save activity", variant: "destructive" });
    }
  };

  const isPending = createActivity.isPending || updateActivity.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Activities</h1>
          <p className="text-muted-foreground mt-1">Manage billable and non-billable activity types.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Activity
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Types</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (activities?.length ?? 0) > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(activities ?? []).map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">{activity.name}</TableCell>
                      <TableCell>
                        {activity.status === "Active"
                          ? <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Active</Badge>
                          : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon"
                          onClick={() => openEdit({ id: activity.id, name: activity.name, status: activity.status })}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No activities found.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => { if (!open) setDialog({ open: false, editing: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Activity" : "Add Activity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Development, Testing, Meetings" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || isPending}>
              {dialog.editing ? "Save Changes" : "Create Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
