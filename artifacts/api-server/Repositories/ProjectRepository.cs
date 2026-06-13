using Microsoft.EntityFrameworkCore;
using Npgsql;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Repositories;

public class ProjectRepository : IProjectRepository
{
    private readonly AppDbContext _db;
    private readonly string _cs;

    public ProjectRepository(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cs = cfg["ConnectionStrings:Default"]!;
    }

    public async Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? status, string? clientId, string? search)
    {
        var offset = (page - 1) * pageSize;
        var conditions = new List<string>();
        var values = new List<object>();
        int idx = 1;

        if (!string.IsNullOrEmpty(status))
        {
            conditions.Add($"p.status::text = ${idx++}");
            values.Add(status);
        }
        if (!string.IsNullOrEmpty(clientId))
        {
            conditions.Add($"p.client_id = ${idx++}");
            values.Add(clientId);
        }
        if (!string.IsNullOrEmpty(search))
        {
            conditions.Add($"(p.name ILIKE ${idx} OR p.project_code ILIKE ${idx})");
            values.Add($"%{search}%"); idx++;
        }

        var where = conditions.Count > 0 ? " WHERE " + string.Join(" AND ", conditions) : "";
        var baseQ = "SELECT p.*, c.name as client_name FROM projects p LEFT JOIN clients c ON p.client_id = c.id";

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();

        int total;
        await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM ({baseQ}{where}) sub", conn))
        {
            foreach (var v in values) cmd.Parameters.AddWithValue(v);
            total = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        var rows = new List<object>();
        await using (var cmd = new NpgsqlCommand($"{baseQ}{where} ORDER BY p.name LIMIT {pageSize} OFFSET {offset}", conn))
        {
            foreach (var v in values) cmd.Parameters.AddWithValue(v);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                rows.Add(ReadRow(reader));
        }

        return new PaginatedResult<object>(rows, total, page, pageSize);
    }

    public async Task<object?> FindById(string id)
    {
        var p = await _db.Projects.FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return null;
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == p.ClientId);
        return ToObj(p, client?.Name);
    }

    public async Task<object?> Create(Dictionary<string, object?> data)
    {
        var now = DateTime.UtcNow;
        var status = GetValidEnum(data, "status", new[] { "Active", "Inactive" }, "Active");
        var id = IdGenerator.NewId();

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO projects (id, project_code, name, client_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5::project_status, $6, $7)", conn);
        cmd.Parameters.AddWithValue(id);
        cmd.Parameters.AddWithValue(Get(data, "projectCode"));
        cmd.Parameters.AddWithValue(Get(data, "name"));
        cmd.Parameters.AddWithValue(Get(data, "clientId"));
        cmd.Parameters.AddWithValue(status);
        cmd.Parameters.AddWithValue(now);
        cmd.Parameters.AddWithValue(now);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(id);
    }

    public async Task<object?> Update(string id, Dictionary<string, object?> data)
    {
        var p = await _db.Projects.FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return null;
        if (data.TryGetValue("projectCode", out var pc) && pc != null) p.ProjectCode = pc.ToString()!;
        if (data.TryGetValue("name", out var n) && n != null) p.Name = n.ToString()!;
        if (data.TryGetValue("clientId", out var ci) && ci != null) p.ClientId = ci.ToString()!;
        if (data.TryGetValue("status", out var s) && s != null)
            p.Status = GetValidEnum(data, "status", new[] { "Active", "Inactive" }, p.Status);
        p.UpdatedAt = DateTime.UtcNow;

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE projects SET project_code=$1, name=$2, client_id=$3, status=$4::project_status, updated_at=$5 WHERE id=$6", conn);
        cmd.Parameters.AddWithValue(p.ProjectCode);
        cmd.Parameters.AddWithValue(p.Name);
        cmd.Parameters.AddWithValue(p.ClientId);
        cmd.Parameters.AddWithValue(p.Status);
        cmd.Parameters.AddWithValue(p.UpdatedAt);
        cmd.Parameters.AddWithValue(id);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(id);
    }

    public async Task<bool> Delete(string id)
    {
        var p = await _db.Projects.FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return false;
        _db.Projects.Remove(p);
        await _db.SaveChangesAsync();
        return true;
    }

    private static string Get(Dictionary<string, object?> d, string key) =>
        d.TryGetValue(key, out var v) ? v?.ToString() ?? "" : "";

    private static string GetValidEnum(Dictionary<string, object?> data, string key, string[] valid, string def)
    {
        if (data.TryGetValue(key, out var v) && v != null && valid.Contains(v.ToString())) return v.ToString()!;
        return def;
    }

    private static object ReadRow(Npgsql.NpgsqlDataReader r) => new
    {
        id = r.GetString(r.GetOrdinal("id")),
        projectCode = r.GetString(r.GetOrdinal("project_code")),
        name = r.GetString(r.GetOrdinal("name")),
        clientId = r.GetString(r.GetOrdinal("client_id")),
        clientName = r.IsDBNull(r.GetOrdinal("client_name")) ? null : r.GetString(r.GetOrdinal("client_name")),
        status = r.GetString(r.GetOrdinal("status")),
        createdAt = r.GetDateTime(r.GetOrdinal("created_at")),
        updatedAt = r.GetDateTime(r.GetOrdinal("updated_at")),
    };

    private static object ToObj(Project p, string? clientName) => new
    {
        id = p.Id,
        projectCode = p.ProjectCode,
        name = p.Name,
        clientId = p.ClientId,
        clientName,
        status = p.Status,
        createdAt = p.CreatedAt,
        updatedAt = p.UpdatedAt,
    };
}
