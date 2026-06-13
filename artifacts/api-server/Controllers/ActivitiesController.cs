using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class ActivitiesController : ControllerBase
{
    private readonly IActivityRepository _activityRepo;
    private readonly IAuditRepository _auditRepo;

    public ActivitiesController(IActivityRepository activityRepo, IAuditRepository auditRepo)
    {
        _activityRepo = activityRepo;
        _auditRepo = auditRepo;
    }

    [HttpGet("activities")]
    [RequireAuth]
    public async Task<IActionResult> GetActivities()
    {
        try { return Ok(await _activityRepo.FindAll()); }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("activities")]
    [RequireRole("Admin")]
    public async Task<IActionResult> CreateActivity([FromBody] Dictionary<string, object?> body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var activity = await _activityRepo.Create(body);
            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Activity Created", ["entityType"] = "Activity",
                ["entityId"] = GetId(activity), ["newValue"] = System.Text.Json.JsonSerializer.Serialize(body),
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });
            return StatusCode(201, activity);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPatch("activities/{activityId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> UpdateActivity(string activityId, [FromBody] Dictionary<string, object?> body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _activityRepo.FindById(activityId);
            var activity = await _activityRepo.Update(activityId, body);
            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Activity Updated", ["entityType"] = "Activity", ["entityId"] = activityId,
                ["oldValue"] = System.Text.Json.JsonSerializer.Serialize(old),
                ["newValue"] = System.Text.Json.JsonSerializer.Serialize(body),
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });
            return Ok(activity);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpDelete("activities/{activityId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> DeleteActivity(string activityId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _activityRepo.FindById(activityId);
            await _activityRepo.Delete(activityId);
            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Activity Deleted", ["entityType"] = "Activity", ["entityId"] = activityId,
                ["oldValue"] = System.Text.Json.JsonSerializer.Serialize(old),
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });
            return Ok(new { ok = true });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    private static string? GetId(object? obj)
    {
        if (obj == null) return null;
        var prop = obj.GetType().GetProperty("id") ?? obj.GetType().GetProperty("Id");
        return prop?.GetValue(obj)?.ToString();
    }
}
