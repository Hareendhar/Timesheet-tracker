import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateTimesheet, useListProjects, useListActivities, useGetCurrentUser, useCopyPreviousWeek } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function emptyRow() {
  return { id: crypto.randomUUID(), projectId: "", activityId: "", monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0, comments: "" };
}

export default function TimesheetNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: projects } = useListProjects({ pageSize: 100 });
  const { data: activities } = useListActivities();
  const createTimesheet = useCreateTimesheet();
  const copyPrevious = useCopyPreviousWeek();

  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const [rows, setRows] = useState<any[]>([emptyRow()]);

  const addRow = () => setRows([...rows, emptyRow()]);

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const duplicateRow = (id: string) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    const idx = rows.findIndex(r => r.id === id);
    const copy = { ...row, id: crypto.randomUUID() };
    const newRows = [...rows];
    newRows.splice(idx + 1, 0, copy);
    setRows(newRows);
  };

  const updateRow = (id: string, field: string, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const calculateRowTotal = (row: any) =>
    DAYS.reduce((sum, d) => sum + (Number(row[d]) || 0), 0);

  const calculateGrandTotal = () =>
    rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);

  const buildPayloadRows = () =>
    rows.map(({ id, ...rest }) => ({
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

  const handleSaveDraft = async () => {
    if (!user?.id) return;
    try {
      const data = {
        employeeId: user.id,
        weekStartDate: format(weekStart, "yyyy-MM-dd"),
        status: "Draft" as const,
        rows: buildPayloadRows(),
      };
      const res = await createTimesheet.mutateAsync({ data });
      toast({ title: "Draft saved successfully" });
      setLocation(`/timesheets/${res.id}`);
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    }
  };

  const handleCopyPrevious = async () => {
    if (!user?.id) return;
    try {
      const res = await copyPrevious.mutateAsync({
        data: {
          employeeId: user.id,
          sourceWeekStartDate: format(subWeeks(weekStart, 1), "yyyy-MM-dd"),
          targetWeekStartDate: format(weekStart, "yyyy-MM-dd"),
        }
      });
      toast({ title: "Previous week copied" });
      setLocation(`/timesheets/${res.id}`);
    } catch {
      toast({ title: "Failed to copy previous week", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">New Timesheet</h1>
          <p className="text-muted-foreground mt-1">Enter your hours for the week.</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-md border shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>&larr;</Button>
          <span className="font-medium whitespace-nowrap">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>&rarr;</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Time Entry Grid</CardTitle>
            <CardDescription>Log your hours against projects and activities.</CardDescription>
          </div>
          <Button variant="outline" onClick={handleCopyPrevious} disabled={copyPrevious.isPending}>
            <Copy className="mr-2 h-4 w-4" /> Copy Previous Week
          </Button>
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
                  <th className="p-3 w-20 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-2">
                      <Select value={row.projectId} onValueChange={(val) => updateRow(row.id, "projectId", val)}>
                        <SelectTrigger className="w-full h-8">
                          <SelectValue placeholder="Select Project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects?.data?.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Select value={row.activityId} onValueChange={(val) => updateRow(row.id, "activityId", val)}>
                        <SelectTrigger className="w-full h-8">
                          <SelectValue placeholder="Select Activity" />
                        </SelectTrigger>
                        <SelectContent>
                          {activities?.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    {DAYS.map(day => (
                      <td key={day} className="p-2">
                        <Input
                          type="number" min="0" max="24" step="0.5"
                          className="w-14 h-8 text-center px-1"
                          value={row[day] || ""}
                          onChange={(e) => updateRow(row.id, day, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="p-3 text-right font-semibold text-primary">
                      {calculateRowTotal(row)}
                    </td>
                    <td className="p-2">
                      <Input
                        placeholder="Optional comments..."
                        className="h-8 text-xs"
                        value={row.comments || ""}
                        onChange={(e) => updateRow(row.id, "comments", e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Duplicate row" onClick={() => duplicateRow(row.id)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete row" onClick={() => removeRow(row.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
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
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Button variant="outline" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Add Row
            </Button>
          </div>

          <div className="mt-8 flex justify-end gap-4 border-t pt-6">
            <Button variant="outline" onClick={() => setLocation("/timesheets")}>Cancel</Button>
            <Button onClick={handleSaveDraft} disabled={createTimesheet.isPending}>
              Save Draft
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
