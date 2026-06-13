using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationRepository _notificationRepo;
    public NotificationsController(INotificationRepository notificationRepo) { _notificationRepo = notificationRepo; }

    [HttpGet("notifications")]
    [RequireAuth]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var (data, total, pg, ps, unreadCount) = await _notificationRepo.FindAll(user.Id, unreadOnly, page, pageSize);
            return Ok(new { data, total, page = pg, pageSize = ps, unreadCount });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPatch("notifications/read-all")]
    [RequireAuth]
    public async Task<IActionResult> MarkAllRead()
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            await _notificationRepo.MarkAllRead(user.Id);
            return Ok(new { ok = true });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPatch("notifications/{notificationId}/read")]
    [RequireAuth]
    public async Task<IActionResult> MarkRead(string notificationId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            await _notificationRepo.MarkRead(notificationId, user.Id);
            return Ok(new { ok = true });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }
}
