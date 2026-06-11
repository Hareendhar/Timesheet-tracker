import { useListClients } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Clients() {
  const { data: clients, isLoading } = useListClients({ pageSize: 50 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage client organizations and statuses.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Client
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Client Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search clients..."
                className="w-full pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : clients?.items && clients.items.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.items.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-mono text-sm">{client.clientCode}</TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {client.status === "Active" ? (
                          <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No clients found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}