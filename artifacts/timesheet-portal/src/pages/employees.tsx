import { useState, useRef } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useBulkUploadEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Search, Eye, Edit, Upload, Download } from "lucide-react";
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
  const [uploadResult, setUploadResult] = useState<{ open: boolean; totalRows: number; successCount: number; errorCount: number; errors: { row: number; message: string }[] }>({ open: false, totalRows: 0, successCount: 0, errorCount: 0, errors: [] });

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
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const result = await bulkUpload.mutateAsync({ data: { xlsxBase64: base64 } as any });
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      setUploadResult({
        open: true,
        totalRows: result.totalRows ?? 0,
        successCount: result.successCount ?? 0,
        errorCount: result.errorCount ?? 0,
        errors: (result.errors as any[]) ?? [],
      });
    } catch (err: any) {
      toast({ title: err?.message || "Upload failed", variant: "destructive" });
    }
  };

  const handleDownloadTemplate = () => {
    window.open("/api/employees/bulk-upload-template", "_blank");
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
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBulkUpload} />
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download Template
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={bulkUpload.isPending}>
            <Upload className="mr-2 h-4 w-4" /> Bulk Upload Excel
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

      {/* Bulk Upload Results Dialog */}
      <Dialog open={uploadResult.open} onOpenChange={(open) => { if (!open) setUploadResult((r) => ({ ...r, open: false })); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Results</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6 py-2 text-sm">
            <span>Total rows: <strong>{uploadResult.totalRows}</strong></span>
            <span className="text-green-700">Created: <strong>{uploadResult.successCount}</strong></span>
            {uploadResult.errorCount > 0 && (
              <span className="text-destructive">Errors: <strong>{uploadResult.errorCount}</strong></span>
            )}
          </div>
          {uploadResult.errors.length > 0 ? (
            <div className="rounded-md border overflow-y-auto max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadResult.errors.map((err: any, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{err.row ?? i + 1}</TableCell>
                      <TableCell className="text-sm text-destructive">{err.message ?? JSON.stringify(err)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">All rows imported successfully.</p>
          )}
          <DialogFooter>
            <Button onClick={() => setUploadResult((r) => ({ ...r, open: false }))}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <SelectItem value="HR">HR</SelectItem>
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
