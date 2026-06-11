import { useParams, useLocation } from "wouter";
import { useGetTimesheet, useUpdateTimesheet, useSubmitTimesheet, useListProjects, useListActivities, useGetCurrentUser, getGetTimesheetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Send, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function emptyRow() {
  return { rowId: crypto.randomUUID(), projectId: "", activityId: "", monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0, comments: "" };
}

export default function TimesheetDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: timesheet, isLoading } = useGetTimesheet(id || "", { query: { enabled: !!id, queryKey: getGetTimesheetQueryKey(id || "") } });
  const { data: projects } = useListProjects({ pageSize: 100 });
  const { data: activities } = useListActivities();

  const updateTimesheet = useUpdateTimesheet();
  const submitTimesheet = useSubmitTimesheet();

  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (timesheet?.rows) {
      setRows(timesheet.rows.map(r => ({ ...r, rowId: crypto.randomUUID() })));
    }
  }, [timesheet]);

  const isEditable = timesheet?.status === "Draft" || timesheet?.status === "Rejected";

  const addRow = () => setRows([...rows, emptyRow()]);

  const removeRow = (rowId: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.rowId !== rowId));
  };

  const duplicateRow = (rowId: string) => {
    const row = rows.find(r => r.rowId === rowId);
    if (!row) return;
    const idx = rows.findIndex(r => r.rowId === rowId);
    const copy = { ...row, rowId: crypto.randomUUID() };
    const newRows = [...rows];
    newRows.splice(idx + 1, 0, copy);
    setRows(newRows);
  };

  const updateRow = (rowId: string, field: string, value: any) => {
    setRows(rows.map(r => r.rowId === rowId ? { ...r, [field]: value } : r));
  };

  const calculateRowTotal = (row: any) =>
    DAYS.reduce((sum, d) => sum + (Number(row[d]) || 0), 0);

  const calculateGrandTotal = () =>
    rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);

  const buildPayloadRows = () =>
    rows.map(({ rowId, ...rest }) => ({
      projectId: rest.projectId,
      activityId: rest.activityId,
      comments: rest.comments || "",
      monday: Number(rest.monday) || 0,
      tuesday: Number(rest.tuesday) || 0,
      wednesday: Number(rest.wednesday) || 0,
      thursday: Number(rest.thursday) || 0,
      friday: Number(rest.friday) || 0,
      saturday: Number(rest.saturday) || 0,
      sunday: Number(rest.sunday) || 0,
    }));

  const handleSave = async (): Promise<boolean> => {
    if (!id || !timesheet) return false;
    try {
      await updateTimesheet.mutateAsync({ timesheetId: id, data: { rows: buildPayloadRows() } });
      toast({ title: "Timesheet saved successfully" });
      return true;
    } catch {
      toast({ title: "Failed to save timesheet", variant: "destructive" });
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      const saved = await handleSave();
      if (!saved) return;
      await submitTimesheet.mutateAsync({ timesheetId: id });
      toast({ title: "Timesheet submitted for approval" });
      setLocation("/timesheets");
    } catch {
      toast({ title: "Failed to submit timesheet", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;
  if (!timesheet) return <div className="p-8 text-muted-foreground">Timesheet not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Timesheet Detail</h1>
            <Badge variant="outline" className="text-sm px-2 py-0.5">{timesheet.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Week of {format(parseISO(timesheet.weekStartDate), "MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {timesheet.rejectionComment && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
          <h4 className="font-semibold text-sm mb-1">Rejection Reason</h4>
          <p className="text-sm">{timesheet.rejectionComment}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Time Entry Grid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-medium">
                <tr>
                  <th className="p-3 w-44 min-w-[180px]">Project</th>
                  <th className="p-3 w-44 min-w-[180px]">Activity</th>
                  {DAY_LABELS.map(d => (
                    <th key={d} className="p-3 w-14 text-center">{d}</th>
                  ))}
                  <th className="p-3 w-20 text-right font-bold">Total</th>
                  <th className="p-3 min-w-[160px]">Comments</th>
                  {isEditable && <th className="p-3 w-20 text-center"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.rowId} className="hover:bg-muted/50 transition-colors">
                    <td className="p-2">
                      {isEditable ? (
                        <Select value={row.projectId} onValueChange={(val) => updateRow(row.rowId, "projectId", val)}>
                          <SelectTrigger className="w-full h-8"><SelectValue placeholder="Select Project" /></SelectTrigger>
                          <SelectContent>
                            {projects?.data?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="px-3 text-sm">{row.projectName}</div>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditable ? (
                        <Select value={row.activityId} onValueChange={(val) => updateRow(row.rowId, "activityId", val)}>
                          <SelectTrigger className="w-full h-8"><SelectValue placeholder="Select Activity" /></SelectTrigger>
                          <SelectContent>
                            {activities?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="px-3 text-sm">{row.activityName}</div>
                      )}
                    </td>
                    {DAYS.map(day => (
                      <td key={day} className="p-2">
                        {isEditable ? (
                          <Input
                            type="number" min="0" max="24" step="0.5" className="w-14 h-8 text-center px-1"
                            value={row[day] || ""} onChange={(e) => updateRow(row.rowId, day, e.target.value)}
                          />
                        ) : (
                          <div className="text-center">{row[day] || 0}</div>
                        )}
                      </td>
                    ))}
                    <td className="p-3 text-right font-semibold text-primary">
                      {calculateRowTotal(row)}
                    </td>
                    <td className="p-2">
                      {isEditable ? (
                        <Input
                          placeholder="Optional comments..."
                          className="h-8 text-xs"
                          value={row.comments || ""}
                          onChange={(e) => updateRow(row.rowId, "comments", e.target.value)}
                        />
                      ) : (
                        <div className="px-3 text-xs text-muted-foreground">{row.comments}</div>
                      )}
                    </td>
                    {isEditable && (
                      <td className="p-2 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Duplicate row" onClick={() => duplicateRow(row.rowId)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete row" onClick={() => removeRow(row.rowId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td colSpan={2} className="p-3 text-right">Grand Total:</td>
                  {DAYS.map(day => (
                    <td key={day} className="p-3 text-center">
                      {rows.reduce((sum, row) => sum + (Number(row[day]) || 0), 0)}
                    </td>
                  ))}
                  <td className="p-3 text-right text-lg text-primary">{calculateGrandTotal()}</td>
                  <td colSpan={isEditable ? 2 : 1}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {isEditable && (
            <div className="mt-4">
              <Button variant="outline" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" /> Add Row
              </Button>
            </div>
          )}

          <div className="mt-8 flex justify-end gap-4 border-t pt-6">
            <Button variant="outline" onClick={() => setLocation("/timesheets")}>Back</Button>
            {isEditable && (
              <>
                <Button variant="secondary" onClick={handleSave} disabled={updateTimesheet.isPending}>
                  Save Draft
                </Button>
                <Button onClick={handleSubmit} disabled={submitTimesheet.isPending || updateTimesheet.isPending}>
                  <Send className="mr-2 h-4 w-4" /> Submit for Approval
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
