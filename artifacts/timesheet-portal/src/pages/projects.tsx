import { useState } from "react";
import { useListProjects, useCreateProject, useUpdateProject, useListClients } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Edit, Mail, User } from "lucide-react";
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

type ProjectRow = {
  id: string;
  projectCode: string;
  name: string;
  clientId: string;
  clientManagerName?: string | null;
  clientManagerEmail?: string | null;
  status: string;
};

export default function Projects() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: projects, isLoading } = useListProjects({ pageSize: 100 });
  const { data: clients } = useListClients({ pageSize: 100 });
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [dialog, setDialog] = useState<{ open: boolean; editing: ProjectRow | null }>({ open: false, editing: null });
  const [form, setForm] = useState({
    projectCode: "", name: "", clientId: "", status: "Active",
    clientManagerName: "", clientManagerEmail: "",
  });

  const openCreate = () => {
    setForm({ projectCode: "", name: "", clientId: "", status: "Active", clientManagerName: "", clientManagerEmail: "" });
    setDialog({ open: true, editing: null });
  };

  const openEdit = (p: ProjectRow) => {
    setForm({
      projectCode: p.projectCode,
      name: p.name,
      clientId: p.clientId,
      status: p.status,
      clientManagerName: p.clientManagerName ?? "",
      clientManagerEmail: p.clientManagerEmail ?? "",
    });
    setDialog({ open: true, editing: p });
  };

  const handleSave = async () => {
    try {
      if (dialog.editing) {
        await updateProject.mutateAsync({ projectId: dialog.editing.id, data: form as any });
        toast({ title: "Project updated" });
      } else {
        await createProject.mutateAsync({ data: form as any });
        toast({ title: "Project created" });
      }
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialog({ open: false, editing: null });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to save project", variant: "destructive" });
    }
  };

  const filtered = (projects?.data ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.projectCode.toLowerCase().includes(search.toLowerCase())
  );
  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage engagements and billing codes.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Project
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Project Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search projects..." className="w-full pl-9"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Client Manager</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((project: any) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-mono text-sm">{project.projectCode}</TableCell>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.clientName}</TableCell>
                      <TableCell>
                        {project.clientManagerName ? (
                          <div>
                            <div className="flex items-center gap-1 text-sm">
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              {project.clientManagerName}
                            </div>
                            {project.clientManagerEmail && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Mail className="h-3 w-3 shrink-0" />
                                {project.clientManagerEmail}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.status === "Active"
                          ? <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Active</Badge>
                          : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon"
                          onClick={() => openEdit({
                            id: project.id,
                            projectCode: project.projectCode,
                            name: project.name,
                            clientId: project.clientId ?? "",
                            clientManagerName: project.clientManagerName,
                            clientManagerEmail: project.clientManagerEmail,
                            status: project.status,
                          })}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No projects found.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => { if (!open) setDialog({ open: false, editing: null }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project Code</Label>
                <Input placeholder="e.g. PRJ001" value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} />
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
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {(clients?.data ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Client Manager (receives timesheet emails)
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    placeholder="Client manager's full name"
                    value={form.clientManagerName}
                    onChange={(e) => setForm({ ...form, clientManagerName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="manager@client.com"
                    value={form.clientManagerEmail}
                    onChange={(e) => setForm({ ...form, clientManagerEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.projectCode.trim() || !form.name.trim() || isPending}>
              {dialog.editing ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
