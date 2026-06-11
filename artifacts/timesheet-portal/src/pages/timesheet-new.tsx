import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateTimesheet, useListProjects, useListActivities, useGetCurrentUser, useCopyPreviousWeek } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

export default function TimesheetNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: projects } = useListProjects({ pageSize: 100 });
  const { data: activities } = useListActivities();
  const createTimesheet = useCreateTimesheet();
  const copyPrevious = useCopyPreviousWeek();

  // Basic weekly selection
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const [rows, setRows] = useState<any[]>([
    { id: crypto.randomUUID(), projectId: "", activityId: "", monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0, comments: "" }
  ]);

  const addRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), projectId: "", activityId: "", monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0, comments: "" }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: string, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const calculateRowTotal = (row: any) => {
    return (Number(row.monday) || 0) + (Number(row.tuesday) || 0) + (Number(row.wednesday) || 0) + (Number(row.thursday) || 0) + (Number(row.friday) || 0) + (Number(row.saturday) || 0) + (Number(row.sunday) || 0);
  };

  const calculateGrandTotal = () => {
    return rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);
  };

  const handleSaveDraft = async () => {
    if (!user?.employeeId) return;
    try {
      const data = {
        employeeId: user.id,
        weekStartDate: format(weekStart, "yyyy-MM-dd"),
        status: "Draft" as const,
        rows: rows.map(({ id, ...rest }) => ({
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
      
      const res = await createTimesheet.mutateAsync({ data });
      toast({ title: "Draft saved successfully" });
      setLocation(`/timesheets/${res.id}`);
    } catch (err) {
      toast({ title: "Failed to save draft", variant: "destructive" });
    }
  };

  const handleCopyPrevious = async () => {
    if (!user?.employeeId) return;
    try {
      const sourceWeek = format(subWeeks(weekStart, 1), "yyyy-MM-dd");
      const targetWeek = format(weekStart, "yyyy-MM-dd");
      
      const res = await copyPrevious.mutateAsync({ 
        data: { 
          employeeId: user.id, 
          sourceWeekStartDate: sourceWeek, 
          targetWeekStartDate: targetWeek 
        } 
      });
      toast({ title: "Previous week copied" });
      setLocation(`/timesheets/${res.id}`);
    } catch (err) {
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
                  <th className="p-3 w-12 text-center"></th>
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
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                      <td key={day} className="p-2">
                        <Input 
                          type="number" 
                          min="0" 
                          max="24" 
                          step="0.5"
                          className="w-16 h-8 text-center px-1" 
                          value={row[day] || ""} 
                          onChange={(e) => updateRow(row.id, day, e.target.value)} 
                        />
                      </td>
                    ))}
                    <td className="p-3 text-right font-semibold text-primary">
                      {calculateRowTotal(row)}
                    </td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeRow(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
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
                  <td></td>
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