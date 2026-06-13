---
name: ASP.NET + Npgsql PostgreSQL enum handling
description: How to correctly handle PostgreSQL enum types in EF Core / Npgsql without hitting "operator does not exist: enum_type = integer/text" errors
---

## The Problem
EF Core LINQ WHERE clauses on PostgreSQL enum columns fail at runtime:
- `WHERE status = $1` with `$1` as integer (C# enum default) → `operator does not exist: timesheet_status = integer`
- `WHERE status = $1` with `$1` as text (string conversion) → `operator does not exist: employee_status = text`
PostgreSQL has no implicit operator for comparing its enum types to integer or text in WHERE clauses.

## The Solution (what actually works)

### 1. Entity models: use `string` for all PostgreSQL enum properties
```csharp
public string Status { get; set; } = "Active";   // NOT EmployeeStatus Status
public string Role { get; set; } = "Employee";   // NOT EmployeeRole Role
```

### 2. AppDbContext: configure as text columns
```csharp
entity.Property(e => e.Status).HasColumnType("text");
```

### 3. Program.cs: enable unmapped types on the data source
```csharp
var dsBuilder = new NpgsqlDataSourceBuilder(connectionString);
dsBuilder.EnableUnmappedTypes();   // allows reading pg enums as text labels
// Do NOT call dsBuilder.MapEnum<T>(...)
var ds = dsBuilder.Build();
```

### 4. Filtered queries (WHERE on enum columns): raw SQL with ::text cast
```csharp
conditions.Add($"e.status::text = ${idx++}");
values.Add(status);   // string value, e.g. "Active"
```

### 5. Write operations (INSERT/UPDATE): explicit cast in the SQL
```csharp
cmd = new NpgsqlCommand("INSERT INTO employees (..., status) VALUES (..., $1::employee_status)", conn);
cmd.Parameters.AddWithValue("Active");
```

**Why:** PostgreSQL assignment casts (for INSERT/UPDATE SET) allow text→enum, but comparison operators in WHERE clauses do not. Casting the column (`col::text = $1`) sidesteps this by doing the comparison in text space.

**How to apply:** Whenever writing a repository that touches a table with PostgreSQL enum columns: use raw NpgsqlConnection with `::text` casts for WHERE clauses, and explicit `::enum_type` casts for INSERT/UPDATE values.
