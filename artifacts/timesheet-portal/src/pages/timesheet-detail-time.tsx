import { useParams, useLocation } from "wouter";
import { useGetTimesheet, useUpdateTimesheet, useSubmitTimesheet, useListProjects, useListActivities, useGetCurrentUser, getGetTimesheetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Send, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, addDays, startOfWeek } from "date-fns";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
    rowId: crypto.randomUUID(),
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

function rowFromApi(r: any) {
  return {
    rowId: crypto.randomUUID(),
    projectId: r.projectId || "",
    activityId: r.activityId || "",
    comments: r.comments || "",
    projectName: r.projectName,
    activityName: r.activityName,
    mondayStart: r.mondayStart || "",
    mondayEnd: r.mondayEnd || "",
    tuesdayStart: r.tuesdayStart || "",
    tuesdayEnd: r.tuesdayEnd || "",
    wednesdayStart: r.wednesdayStart || "",
    wednesdayEnd: r.wednesdayEnd || "",
    thursdayStart: r.thursdayStart || "",
    thursdayEnd: r.thursdayEnd || "",
    fridayStart: r.fridayStart || "",
    fridayEnd: r.fridayEnd || "",
    saturdayStart: r.saturdayStart || "",
    saturdayEnd: r.saturdayEnd || "",
    sundayStart: r.sundayStart || "",
    sundayEnd: r.sundayEnd || "",
    monday: r.monday || 0,
    tuesday: r.tuesday || 0,
    wednesday: r.wednesday || 0,
    thursday: r.thursday || 0,
    friday: r.friday || 0,
    saturday: r.saturday || 0,
    sunday: r.sunday || 0,
  };
}

export default function TimesheetDetailTime() {
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
      setRows(timesheet.rows.map(rowFromApi));
    }
  }, [timesheet]);

  const isEditable = timesheet?.status === "Draft" || timesheet?.status === "Rejected";

  const weekStart = timesheet?.weekStartDate ? parseISO(timesheet.weekStartDate) : null;

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

  const getRowHours = (row: any, day: string) => {
    const start = row[`${day}Start`];
    const end = row[`${day}End`];
    if (start && end) return hoursFromTimes(start, end);
    return row[day] || 0;
  };

  const getRowTotal = (row: any) =>
    DAYS.reduce((sum, d) => sum + getRowHours(row, d), 0);

  const getDayTotal = (day: string) =>
    rows.reduce((sum, row) => sum + getRowHours(row, day), 0);

  const getGrandTotal = () =>
    rows.reduce((sum, row) => sum + getRowTotal(row), 0);

  const buildPayloadRows = () =>
    rows.map(({ rowId, projectName, activityName, ...rest }) => ({
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
          <CardTitle>Time Entry</CardTitle>
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
                      {weekStart && (
                        <div className="text-xs font-normal text-muted-foreground">
                          {format(addDays(weekStart, i), "MMM d")}
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="p-3 text-right border-b border-r min-w-[70px]">Total</th>
                  <th className="p-3 border-b border-r min-w-[140px]">Comments</th>
                  {isEditable && <th className="p-3 border-b w-16 text-center"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.rowId} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2 border-r">
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
                    <td className="p-2 border-r">
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
                    {DAYS.map(day => {
                      const hours = getRowHours(row, day);
                      const hasTime = row[`${day}Start`] || row[`${day}End`];
                      return (
                        <td key={day} className="p-2 border-r">
                          {isEditable ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground w-6 shrink-0">from</span>
                                <input
                                  type="time"
                                  className="w-full h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={row[`${day}Start`] || ""}
                                  onChange={(e) => updateRow(row.rowId, `${day}Start`, e.target.value)}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground w-6 shrink-0">to</span>
                                <input
                                  type="time"
                                  className="w-full h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={row[`${day}End`] || ""}
                                  onChange={(e) => updateRow(row.rowId, `${day}End`, e.target.value)}
                                />
                              </div>
                              {hours > 0 && (
                                <div className="text-center text-[11px] font-semibold text-primary bg-primary/8 rounded px-1 py-0.5">
                                  {hours}h
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center space-y-0.5">
                              {hasTime ? (
                                <>
                                  <div className="text-xs text-muted-foreground">{row[`${day}Start`]} – {row[`${day}End`]}</div>
                                  {hours > 0 && <div className="text-xs font-semibold text-primary">{hours}h</div>}
                                </>
                              ) : hours > 0 ? (
                                <div className="text-xs font-semibold">{hours}h</div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-right font-semibold text-primary border-r">
                      {getRowTotal(row).toFixed(1)}h
                    </td>
                    <td className="p-2 border-r">
                      {isEditable ? (
                        <Input
                          placeholder="Optional..."
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
                  <td colSpan={isEditable ? 2 : 1}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {isEditable && (
            <div className="mt-4">
              <Button variant="outline" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" /> Add Project Row
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
