import { useState, useRef } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useBulkUploadEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Search, Eye, Edit, Upload } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

type EmpRow = { id: string; employeeId: string; name: string; email: string; department: string; designation: string; role: string; status: string; managerId?: string | null };

const emptyForm = () => ({ employeeId: "", name: "", email: "", department: "", designation: "", role: "Employee", status: "Active", managerId: "" });

export default function Employees() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: employees, isLoading } = useListEmployees({ search: search || undefined, pageSize: 50 });
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const bulkUpload = useBulkUploadEmployees();

  const [dialog, setDialog] = useState<{ open: boolean; editing: EmpRow | null }>({ open: false, editing: null });
  const [form, setForm] = useState(emptyForm());

  const openCreate = () => {
    setForm(emptyForm());
    setDialog({ open: true, editing: null });
  };

  const openEdit = (e: EmpRow) => {
    setForm({ employeeId: e.employeeId, name: e.name, email: e.email, department: e.department, designation: e.designation, role: e.role, status: e.status, managerId: e.managerId ?? "" });
    setDialog({ open: true, editing: e });
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, managerId: form.managerId || null };
      if (dialog.editing) {
        await updateEmployee.mutateAsync({ employeeId: dialog.editing.id, data: payload as any });
        toast({ title: "Employee updated" });
      } else {
        await createEmployee.mutateAsync({ data: payload as any });
        toast({ title: "Employee created" });
      }
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      setDialog({ open: false, editing: null });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to save employee", variant: "destructive" });
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast({ title: "CSV must have a header row and at least one data row", variant: "destructive" }); return; }
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const row: any = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
        return row;
      });
      const result = await bulkUpload.mutateAsync({ data: { rows } });
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: `Uploaded: ${result.successCount} created, ${result.errorCount} errors` });
    } catch (err: any) {
      toast({ title: err?.message || "Upload failed", variant: "destructive" });
    }
  };

  const isPending = createEmployee.isPending || updateEmployee.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage personnel, roles, and access.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={bulkUpload.isPending}>
            <Upload className="mr-2 h-4 w-4" /> Bulk Upload CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search employees..." className="w-full pl-9"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : employees?.data && employees.data.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.data.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary">{emp.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm leading-none mb-1">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">{emp.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.role}</TableCell>
                      <TableCell>
                        {emp.status === "Active"
                          ? <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Active</Badge>
                          : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/employees/${emp.id}`}>
                            <Button variant="ghost" size="icon" title="View Profile">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" title="Edit"
                            onClick={() => openEdit({ id: emp.id, employeeId: emp.employeeId, name: emp.name, email: emp.email, department: emp.department, designation: emp.designation, role: emp.role, status: emp.status, managerId: emp.managerId })}>
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No employees found.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => { if (!open) setDialog({ open: false, editing: null }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Employee ID</Label>
              <Input placeholder="EMP001" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} disabled={!!dialog.editing} />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="employee@versatileit.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="e.g. Engineering" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Input placeholder="e.g. Senior Developer" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
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
            <Button onClick={handleSave}
              disabled={!form.employeeId.trim() || !form.name.trim() || !form.email.trim() || isPending}>
              {dialog.editing ? "Save Changes" : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
