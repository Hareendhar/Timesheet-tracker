using Microsoft.EntityFrameworkCore;
using Npgsql;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Repositories;

public class ActivityRepository : IActivityRepository
{
    private readonly AppDbContext _db;
    private readonly string _cs;

    public ActivityRepository(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cs = cfg["ConnectionStrings:Default"]!;
    }

    public async Task<List<object>> FindAll()
    {
        var rows = await _db.Activities.OrderBy(a => a.Name).ToListAsync();
        return rows.Select(ToObj).ToList<object>();
    }

    public async Task<object?> FindById(string id)
    {
        var a = await _db.Activities.FirstOrDefaultAsync(x => x.Id == id);
        return a == null ? null : ToObj(a);
    }

    public async Task<object?> Create(Dictionary<string, object?> data)
    {
        var id = IdGenerator.NewId();
        var name = data.TryGetValue("name", out var n) ? n?.ToString() ?? "" : "";
        var status = data.TryGetValue("status", out var s) && s != null &&
                     new[] { "Active", "Inactive" }.Contains(s.ToString()) ? s.ToString()! : "Active";
        var now = DateTime.UtcNow;

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO activities (id, name, status, created_at) VALUES ($1, $2, $3::activity_status, $4)", conn);
        cmd.Parameters.AddWithValue(id);
        cmd.Parameters.AddWithValue(name);
        cmd.Parameters.AddWithValue(status);
        cmd.Parameters.AddWithValue(now);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(id);
    }

    public async Task<object?> Update(string id, Dictionary<string, object?> data)
    {
        var a = await _db.Activities.FirstOrDefaultAsync(x => x.Id == id);
        if (a == null) return null;
        if (data.TryGetValue("name", out var n) && n != null) a.Name = n.ToString()!;
        if (data.TryGetValue("status", out var s) && s != null &&
            new[] { "Active", "Inactive" }.Contains(s.ToString()))
            a.Status = s.ToString()!;

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE activities SET name=$1, status=$2::activity_status WHERE id=$3", conn);
        cmd.Parameters.AddWithValue(a.Name);
        cmd.Parameters.AddWithValue(a.Status);
        cmd.Parameters.AddWithValue(id);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(id);
    }

    public async Task<bool> Delete(string id)
    {
        var a = await _db.Activities.FirstOrDefaultAsync(x => x.Id == id);
        if (a == null) return false;
        _db.Activities.Remove(a);
        await _db.SaveChangesAsync();
        return true;
    }

    private static object ToObj(Activity a) => new
    {
        id = a.Id,
        name = a.Name,
        status = a.Status,
        createdAt = a.CreatedAt,
    };
}
