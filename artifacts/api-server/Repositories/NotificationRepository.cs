using Microsoft.EntityFrameworkCore;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly AppDbContext _db;
    public NotificationRepository(AppDbContext db) { _db = db; }

    public async Task<(List<object> Data, int Total, int Page, int PageSize, int UnreadCount)> FindAll(
        string userId, bool unreadOnly, int page, int pageSize)
    {
        var offset = (page - 1) * pageSize;
        var query = _db.Notifications.Where(n => n.UserId == userId);
        if (unreadOnly) query = query.Where(n => !n.IsRead);

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip(offset).Take(pageSize)
            .ToListAsync();

        var unreadCount = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .CountAsync();

        var data = rows.Select(ToObj).ToList<object>();
        return (data, total, page, pageSize, unreadCount);
    }

    public async Task<string> Create(Dictionary<string, object?> data)
    {
        var n = new Notification
        {
            Id = IdGenerator.NewId(),
            UserId = data.TryGetValue("userId", out var uid) ? uid?.ToString() ?? "" : "",
            Type = data.TryGetValue("type", out var t) ? t?.ToString() ?? "" : "",
            Title = data.TryGetValue("title", out var title) ? title?.ToString() ?? "" : "",
            Message = data.TryGetValue("message", out var msg) ? msg?.ToString() ?? "" : "",
            IsRead = data.TryGetValue("isRead", out var r) && r is bool b ? b : false,
            RelatedId = data.TryGetValue("relatedId", out var rel) ? rel?.ToString() : null,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Notifications.Add(n);
        await _db.SaveChangesAsync();
        return n.Id;
    }

    public async Task<bool> MarkRead(string id, string userId)
    {
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (n == null) return false;
        n.IsRead = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task MarkAllRead(string userId)
    {
        await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
    }

    private static object ToObj(Notification n) => new
    {
        id = n.Id,
        userId = n.UserId,
        type = n.Type,
        title = n.Title,
        message = n.Message,
        isRead = n.IsRead,
        relatedId = n.RelatedId,
        createdAt = n.CreatedAt,
    };
}
