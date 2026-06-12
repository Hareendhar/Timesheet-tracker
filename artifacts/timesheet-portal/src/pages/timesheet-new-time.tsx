import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateTimesheet, useListProjects, useListActivities, useGetCurrentUser, useCopyPreviousWeek } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays } from "date-fns";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hoursFromTimes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
}

function emptyRow() {
  return {
    id: crypto.randomUUID(),
    projectId: "", activityId: "", comments: "",
    mondayStart: "", mondayEnd: "",
    tuesdayStart: "", tuesdayEnd: "",
    wednesdayStart: "", wednesdayEnd: "",
    thursdayStart: "", thursdayEnd: "",
    fridayStart: "", fridayEnd: "",
    saturdayStart: "", saturdayEnd: "",
    sundayStart: "", sundayEnd: "",
  };
}

export default function TimesheetNewTime() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: projects } = useListProjects({ pageSize: 100 });
  const { data: activities } = useListActivities();
  const createTimesheet = useCreateTimesheet();

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

  const getRowHours = (row: any, day: string) =>
    hoursFromTimes(row[`${day}Start`], row[`${day}End`]);

  const getRowTotal = (row: any) =>
    DAYS.reduce((sum, d) => sum + getRowHours(row, d), 0);

  const getDayTotal = (day: string) =>
    rows.reduce((sum, row) => sum + getRowHours(row, day), 0);

  const getGrandTotal = () =>
    rows.reduce((sum, row) => sum + getRowTotal(row), 0);

  const buildPayloadRows = () =>
    rows.map(({ id, ...rest }) => ({
      projectId: rest.projectId,
      activityId: rest.activityId,
      comments: rest.comments || "",
      monday: getRowHours(rest, "monday"),
      tuesday: getRowHours(rest, "tuesday"),
      wednesday: getRowHours(rest, "wednesday"),
      thursday: getRowHours(rest, "thursday"),
      friday: getRowHours(rest, "friday"),
      saturday: getRowHours(rest, "saturday"),
      sunday: getRowHours(rest, "sunday"),
      mondayStart: rest.mondayStart || null,
      mondayEnd: rest.mondayEnd || null,
      tuesdayStart: rest.tuesdayStart || null,
      tuesdayEnd: rest.tuesdayEnd || null,
      wednesdayStart: rest.wednesdayStart || null,
      wednesdayEnd: rest.wednesdayEnd || null,
      thursdayStart: rest.thursdayStart || null,
      thursdayEnd: rest.thursdayEnd || null,
      fridayStart: rest.fridayStart || null,
      fridayEnd: rest.fridayEnd || null,
      saturdayStart: rest.saturdayStart || null,
      saturdayEnd: rest.saturdayEnd || null,
      sundayStart: rest.sundayStart || null,
      sundayEnd: rest.sundayEnd || null,
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
      setLocation(`/timesheets/${res.id}/time`);
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">New Timesheet</h1>
          <p className="text-muted-foreground mt-1">Select start and end times for each day and project.</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-md border shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>&larr;</Button>
          <span className="font-medium whitespace-nowrap">
            {format(weekStart, "MMM d")} &ndash; {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>&rarr;</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entry</CardTitle>
          <CardDescription>Enter start and end times per day for each project. Hours are calculated automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted text-muted-foreground font-medium">
                <tr>
                  <th className="p-3 min-w-[160px] border-b border-r">Project</th>
                  <th className="p-3 min-w-[160px] border-b border-r">Activity</th>
                  {DAYS.map((day, i) => (
                    <th key={day} className="p-2 text-center border-b border-r min-w-[130px]">
                      <div className="font-semibold">{DAY_SHORT[i]}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {format(addDays(weekStart, i), "MMM d")}
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-right border-b border-r min-w-[70px]">Total</th>
                  <th className="p-3 border-b border-r min-w-[140px]">Comments</th>
                  <th className="p-3 border-b w-16 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2 border-r">
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
                    <td className="p-2 border-r">
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
                    {DAYS.map(day => {
                      const hours = getRowHours(row, day);
                      return (
                        <td key={day} className="p-2 border-r">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground w-6 shrink-0">from</span>
                              <input
                                type="time"
                                className="w-full h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                value={row[`${day}Start`] || ""}
                                onChange={(e) => updateRow(row.id, `${day}Start`, e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground w-6 shrink-0">to</span>
                              <input
                                type="time"
                                className="w-full h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                value={row[`${day}End`] || ""}
                                onChange={(e) => updateRow(row.id, `${day}End`, e.target.value)}
                              />
                            </div>
                            {hours > 0 && (
                              <div className="text-center text-[11px] font-semibold text-primary bg-primary/8 rounded px-1 py-0.5">
                                {hours}h
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-3 text-right font-semibold text-primary border-r">
                      {getRowTotal(row).toFixed(1)}h
                    </td>
                    <td className="p-2 border-r">
                      <Input
                        placeholder="Optional..."
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
                <tr className="bg-muted/40 font-semibold text-sm">
                  <td colSpan={2} className="p-3 text-right border-r text-muted-foreground">Daily Totals</td>
                  {DAYS.map(day => (
                    <td key={day} className="p-2 text-center border-r">
                      {getDayTotal(day) > 0 ? (
                        <span className="text-primary font-bold">{getDayTotal(day).toFixed(1)}h</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  ))}
                  <td className="p-3 text-right text-primary font-bold border-r">
                    {getGrandTotal().toFixed(1)}h
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Button variant="outline" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Add Project Row
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
