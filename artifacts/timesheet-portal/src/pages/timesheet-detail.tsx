import { useParams, useLocation } from "wouter";
import { useGetTimesheet, useUpdateTimesheet, useSubmitTimesheet, useListProjects, useListActivities, useGetCurrentUser, getGetTimesheetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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

  const addRow = () => {
    setRows([...rows, { rowId: crypto.randomUUID(), projectId: "", activityId: "", monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0, comments: "" }]);
  };

  const removeRow = (rowId: string) => {
    setRows(rows.filter(r => r.rowId !== rowId));
  };

  const updateRow = (rowId: string, field: string, value: any) => {
    setRows(rows.map(r => r.rowId === rowId ? { ...r, [field]: value } : r));
  };

  const calculateRowTotal = (row: any) => {
    return (Number(row.monday) || 0) + (Number(row.tuesday) || 0) + (Number(row.wednesday) || 0) + (Number(row.thursday) || 0) + (Number(row.friday) || 0) + (Number(row.saturday) || 0) + (Number(row.sunday) || 0);
  };

  const calculateGrandTotal = () => {
    return rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);
  };

  const handleSave = async () => {
    if (!id || !user?.employeeId || !timesheet) return;
    try {
      const data = {
        rows: rows.map(({ rowId, ...rest }) => ({
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
        }))
      };
      
      await updateTimesheet.mutateAsync({ timesheetId: id, data });
      toast({ title: "Timesheet saved successfully" });
    } catch (err) {
      toast({ title: "Failed to save timesheet", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await handleSave(); // Save first
      await submitTimesheet.mutateAsync({ timesheetId: id });
      toast({ title: "Timesheet submitted for approval" });
      setLocation("/timesheets");
    } catch (err) {
      toast({ title: "Failed to submit timesheet", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;
  if (!timesheet) return <div>Timesheet not found</div>;

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
                  <th className="p-3 w-48 min-w-[200px]">Project</th>
                  <th className="p-3 w-48 min-w-[200px]">Activity</th>
                  <th className="p-3 w-16 text-center">Mon</th>
                  <th className="p-3 w-16 text-center">Tue</th>
                  <th className="p-3 w-16 text-center">Wed</th>
                  <th className="p-3 w-16 text-center">Thu</th>
                  <th className="p-3 w-16 text-center">Fri</th>
                  <th className="p-3 w-16 text-center">Sat</th>
                  <th className="p-3 w-16 text-center">Sun</th>
                  <th className="p-3 w-20 text-right font-bold">Total</th>
                  {isEditable && <th className="p-3 w-12 text-center"></th>}
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
                        <div className="px-3">{row.projectName}</div>
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
                        <div className="px-3">{row.activityName}</div>
                      )}
                    </td>
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                      <td key={day} className="p-2">
                        {isEditable ? (
                          <Input 
                            type="number" min="0" max="24" step="0.5" className="w-16 h-8 text-center px-1" 
                            value={row[day] || ""} onChange={(e) => updateRow(row.rowId, day, e.target.value)} 
                          />
                        ) : (
                          <div className="text-center">{row[day]}</div>
                        )}
                      </td>
                    ))}
                    <td className="p-3 text-right font-semibold text-primary">
                      {calculateRowTotal(row)}
                    </td>
                    {isEditable && (
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeRow(row.rowId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td colSpan={2} className="p-3 text-right">Grand Total:</td>
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <td key={day} className="p-3 text-center">
                      {rows.reduce((sum, row) => sum + (Number(row[day]) || 0), 0)}
                    </td>
                  ))}
                  <td className="p-3 text-right text-lg text-primary">{calculateGrandTotal()}</td>
                  {isEditable && <td></td>}
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