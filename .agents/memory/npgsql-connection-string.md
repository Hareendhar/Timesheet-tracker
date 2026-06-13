---
name: Npgsql connection string format
description: Npgsql rejects the postgres:// URI format; must convert to key=value format before passing to NpgsqlDataSourceBuilder
---

## The Problem
`NpgsqlDataSourceBuilder("postgres://user:pass@host/db?sslmode=require")` throws:
```
System.ArgumentException: Couldn't set postgresql://... (Parameter 'postgresql://...')
```

## The Fix
Convert the URI at startup before constructing the data source:

```csharp
static string ConvertConnectionString(string cs)
{
    if (!cs.StartsWith("postgres://") && !cs.StartsWith("postgresql://"))
        return cs;  // already key=value format

    var uri = new Uri(cs);
    var user = Uri.UnescapeDataString(uri.UserInfo.Split(':')[0]);
    var pass = uri.UserInfo.Contains(':')
        ? Uri.UnescapeDataString(uri.UserInfo[(uri.UserInfo.IndexOf(':') + 1)..])
        : "";
    var host = uri.Host;
    var port = uri.Port > 0 ? uri.Port : 5432;
    var db = uri.AbsolutePath.TrimStart('/');
    var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
    var sslMode = query["sslmode"] ?? "prefer";
    return $"Host={host};Port={port};Database={db};Username={user};Password={pass};SSL Mode={sslMode};Trust Server Certificate=true";
}
```

**Why:** Replit's DATABASE_URL environment variable is always in `postgres://` URI format, but Npgsql only accepts the ADO.NET key=value format.

**How to apply:** Call this helper at the very start of `Program.cs` before building the NpgsqlDataSource. Also store the converted string in `builder.Configuration["ConnectionStrings:Default"]` so repositories can read it via IConfiguration.
