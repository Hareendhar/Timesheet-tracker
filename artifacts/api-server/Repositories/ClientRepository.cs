using Microsoft.EntityFrameworkCore;
using Npgsql;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly AppDbContext _db;
    private readonly string _cs;

    public ClientRepository(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cs = cfg["ConnectionStrings:Default"]!;
    }

    public async Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? status, string? search)
    {
        var offset = (page - 1) * pageSize;
        var conditions = new List<string>();
        var values = new List<object>();
        int idx = 1;

        if (!string.IsNullOrEmpty(status))
        {
            conditions.Add($"status::text = ${idx++}");
            values.Add(status);
        }
        if (!string.IsNullOrEmpty(search))
        {
            conditions.Add($"(name ILIKE ${idx} OR client_code ILIKE ${idx})");
            values.Add($"%{search}%"); idx++;
        }

        var where = conditions.Count > 0 ? " WHERE " + string.Join(" AND ", conditions) : "";

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();

        int total;
        await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM clients{where}", conn))
        {
            foreach (var v in values) cmd.Parameters.AddWithValue(v);
            total = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        var rows = new List<object>();
        await using (var cmd = new NpgsqlCommand($"SELECT * FROM clients{where} ORDER BY name LIMIT {pageSize} OFFSET {offset}", conn))
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
        var c = await _db.Clients.FirstOrDefaultAsync(x => x.Id == id);
        return c == null ? null : ToObj(c);
    }

    public async Task<object?> Create(Dictionary<string, object?> data)
    {
        var now = DateTime.UtcNow;
        var status = GetValidEnum(data, "status", new[] { "Active", "Inactive" }, "Active");

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        var id = IdGenerator.NewId();
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO clients (id, client_code, name, status, created_at, updated_at) VALUES ($1, $2, $3, $4::client_status, $5, $6)", conn);
        cmd.Parameters.AddWithValue(id);
        cmd.Parameters.AddWithValue(Get(data, "clientCode"));
        cmd.Parameters.AddWithValue(Get(data, "name"));
        cmd.Parameters.AddWithValue(status);
        cmd.Parameters.AddWithValue(now);
        cmd.Parameters.AddWithValue(now);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(id);
    }

    public async Task<object?> Update(string id, Dictionary<string, object?> data)
    {
        var c = await _db.Clients.FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return null;
        if (data.TryGetValue("clientCode", out var cc) && cc != null) c.ClientCode = cc.ToString()!;
        if (data.TryGetValue("name", out var n) && n != null) c.Name = n.ToString()!;
        if (data.TryGetValue("status", out var s) && s != null)
            c.Status = GetValidEnum(data, "status", new[] { "Active", "Inactive" }, c.Status);
        c.UpdatedAt = DateTime.UtcNow;

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE clients SET client_code=$1, name=$2, status=$3::client_status, updated_at=$4 WHERE id=$5", conn);
        cmd.Parameters.AddWithValue(c.ClientCode);
        cmd.Parameters.AddWithValue(c.Name);
        cmd.Parameters.AddWithValue(c.Status);
        cmd.Parameters.AddWithValue(c.UpdatedAt);
        cmd.Parameters.AddWithValue(id);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(id);
    }

    public async Task<bool> Delete(string id)
    {
        var c = await _db.Clients.FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return false;
        _db.Clients.Remove(c);
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
        clientCode = r.GetString(r.GetOrdinal("client_code")),
        name = r.GetString(r.GetOrdinal("name")),
        status = r.GetString(r.GetOrdinal("status")),
        createdAt = r.GetDateTime(r.GetOrdinal("created_at")),
        updatedAt = r.GetDateTime(r.GetOrdinal("updated_at")),
    };

    private static object ToObj(Client c) => new
    {
        id = c.Id,
        clientCode = c.ClientCode,
        name = c.Name,
        status = c.Status,
        createdAt = c.CreatedAt,
        updatedAt = c.UpdatedAt,
    };
}
