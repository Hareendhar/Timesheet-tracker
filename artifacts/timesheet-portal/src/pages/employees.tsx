import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Search, Eye, Edit, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce"; // We'll create this if it doesn't exist, or just use a local state without debounce for now
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Employees() {
  const [search, setSearch] = useState("");
  
  const { data: employees, isLoading } = useListEmployees({ 
    search: search || undefined,
    pageSize: 50 
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage personnel, roles, and access.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search employees..."
                className="w-full pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : employees?.items && employees.items.length > 0 ? (
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
                  {employees.items.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {emp.name.charAt(0)}
                            </AvatarFallback>
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
                        {emp.status === "Active" ? (
                          <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/employees/${emp.id}`}>
                            <Button variant="ghost" size="icon" title="View Profile">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" title="Edit">
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
            <div className="text-center py-12 text-muted-foreground">
              No employees found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}