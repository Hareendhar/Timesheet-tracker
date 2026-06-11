import { useState } from "react";
import { useListClients, useCreateClient, useUpdateClient } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Edit } from "lucide-react";
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

type ClientRow = { id: string; clientCode: string; name: string; status: string };

export default function Clients() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: clients, isLoading } = useListClients({ pageSize: 100 });
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [dialog, setDialog] = useState<{ open: boolean; editing: ClientRow | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ clientCode: "", name: "", status: "Active" });

  const openCreate = () => {
    setForm({ clientCode: "", name: "", status: "Active" });
    setDialog({ open: true, editing: null });
  };

  const openEdit = (c: ClientRow) => {
    setForm({ clientCode: c.clientCode, name: c.name, status: c.status });
    setDialog({ open: true, editing: c });
  };

  const handleSave = async () => {
    try {
      if (dialog.editing) {
        await updateClient.mutateAsync({ clientId: dialog.editing.id, data: form as any });
        toast({ title: "Client updated" });
      } else {
        await createClient.mutateAsync({ data: form as any });
        toast({ title: "Client created" });
      }
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      setDialog({ open: false, editing: null });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to save client", variant: "destructive" });
    }
  };

  const filtered = (clients?.data ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.clientCode.toLowerCase().includes(search.toLowerCase())
  );
  const isPending = createClient.isPending || updateClient.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage client organizations and statuses.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Client
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Client Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search clients..." className="w-full pl-9"
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
                    <TableHead>Client Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-mono text-sm">{client.clientCode}</TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {client.status === "Active"
                          ? <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Active</Badge>
                          : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon"
                          onClick={() => openEdit({ id: client.id, clientCode: client.clientCode, name: client.name, status: client.status })}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No clients found.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => { if (!open) setDialog({ open: false, editing: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client Code</Label>
              <Input placeholder="e.g. CLI001" value={form.clientCode} onChange={(e) => setForm({ ...form, clientCode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Client name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
            <Button onClick={handleSave} disabled={!form.clientCode.trim() || !form.name.trim() || isPending}>
              {dialog.editing ? "Save Changes" : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
