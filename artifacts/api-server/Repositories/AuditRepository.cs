using Microsoft.EntityFrameworkCore;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Repositories;

public class AuditRepository : IAuditRepository
{
    private readonly AppDbContext _db;
    public AuditRepository(AppDbContext db) { _db = db; }

    public async Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? userId,
        string? action, string? role, string? dateFrom, string? dateTo)
    {
        var offset = (page - 1) * pageSize;
        var query = _db.AuditLogs.AsQueryable();
        if (!string.IsNullOrEmpty(userId)) query = query.Where(a => a.UserId == userId);
        if (!string.IsNullOrEmpty(action)) query = query.Where(a => a.Action == action);
        if (!string.IsNullOrEmpty(role)) query = query.Where(a => a.Role == role);
        if (!string.IsNullOrEmpty(dateFrom) && DateTime.TryParse(dateFrom, out var df))
            query = query.Where(a => a.CreatedAt >= df);
        if (!string.IsNullOrEmpty(dateTo) && DateTime.TryParse(dateTo, out var dt))
            query = query.Where(a => a.CreatedAt <= dt);

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip(offset).Take(pageSize)
            .ToListAsync();

        return new PaginatedResult<object>(rows.Select(ToObj).ToList(), total, page, pageSize);
    }

    public async Task<string> Create(Dictionary<string, object?> data)
    {
        var log = new AuditLog
        {
            Id = IdGenerator.NewId(),
            UserId = data.TryGetValue("userId", out var uid) ? uid?.ToString() ?? "" : "",
            UserName = data.TryGetValue("userName", out var un) ? un?.ToString() : null,
            Role = data.TryGetValue("role", out var r) ? r?.ToString() ?? "" : "",
            Action = data.TryGetValue("action", out var a) ? a?.ToString() ?? "" : "",
            EntityType = data.TryGetValue("entityType", out var et) ? et?.ToString() ?? "" : "",
            EntityId = data.TryGetValue("entityId", out var eid) ? eid?.ToString() : null,
            OldValue = data.TryGetValue("oldValue", out var ov) ? ov?.ToString() : null,
            NewValue = data.TryGetValue("newValue", out var nv) ? nv?.ToString() : null,
            IpAddress = data.TryGetValue("ipAddress", out var ip) ? ip?.ToString() : null,
            CreatedAt = DateTime.UtcNow,
        };
        _db.AuditLogs.Add(log);
        await _db.SaveChangesAsync();
        return log.Id;
    }

    public async Task<List<object>> FindAllExport(string? dateFrom, string? dateTo)
    {
        var query = _db.AuditLogs.AsQueryable();
        if (!string.IsNullOrEmpty(dateFrom) && DateTime.TryParse(dateFrom, out var df))
            query = query.Where(a => a.CreatedAt >= df);
        if (!string.IsNullOrEmpty(dateTo) && DateTime.TryParse(dateTo, out var dt))
            query = query.Where(a => a.CreatedAt <= dt);

        var rows = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        return rows.Select(ToObj).ToList<object>();
    }

    private static object ToObj(AuditLog a) => new
    {
        id = a.Id,
        userId = a.UserId,
        userName = a.UserName,
        role = a.Role,
        action = a.Action,
        entityType = a.EntityType,
        entityId = a.EntityId,
        oldValue = a.OldValue,
        newValue = a.NewValue,
        ipAddress = a.IpAddress,
        createdAt = a.CreatedAt,
    };
}
