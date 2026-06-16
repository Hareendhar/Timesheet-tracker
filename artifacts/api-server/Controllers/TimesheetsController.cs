using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Models;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class TimesheetsController : ControllerBase
{
    private readonly ITimesheetRepository _timesheetRepo;
    private readonly IEmployeeRepository _employeeRepo;
    private readonly INotificationRepository _notificationRepo;
    private readonly IAuditRepository _auditRepo;

    public TimesheetsController(
        ITimesheetRepository timesheetRepo,
        IEmployeeRepository employeeRepo,
        INotificationRepository notificationRepo,
        IAuditRepository auditRepo)
    {
        _timesheetRepo = timesheetRepo;
        _employeeRepo = employeeRepo;
        _notificationRepo = notificationRepo;
        _auditRepo = auditRepo;
    }

    [HttpPost("timesheets/bulk-action")]
    [RequireRole("Manager", "HR")]
    public async Task<IActionResult> BulkAction([FromBody] BulkActionRequest body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            if (body.Action == "reject" && string.IsNullOrWhiteSpace(body.Comment))
                return BadRequest(new { error = "Rejection comment is required" });

            foreach (var id in body.TimesheetIds)
            {
                var ts = await _timesheetRepo.FindById(id);
                if (ts == null) return NotFound(new { error = $"Timesheet {id} not found" });
                if (GetStr(ts, "status") != "Submitted")
                    return BadRequest(new { error = $"Timesheet {id} is in '{GetStr(ts, "status")}' status and cannot be {body.Action}d" });
                if (user.Role == "Manager")
                {
                    var emp = await _employeeRepo.FindById(GetStr(ts, "employeeId") ?? "");
                    if (emp == null || GetStr(emp, "managerId") != user.Id)
                        return StatusCode(403, new { error = "Forbidden: one or more timesheets do not belong to your direct reports" });
                }
            }

            var result = await _timesheetRepo.BulkAction(body.TimesheetIds, body.Action, user.Id, body.Comment);

            foreach (var id in body.TimesheetIds)
            {
                var ts = await _timesheetRepo.FindById(id);
                if (ts != null)
                {
                    await _notificationRepo.Create(new Dictionary<string, object?>
                    {
                        ["userId"] = GetStr(ts, "employeeId"),
                        ["type"] = body.Action == "approve" ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED",
                        ["title"] = body.Action == "approve" ? "Timesheet Approved" : "Timesheet Rejected",
                        ["message"] = body.Action == "approve"
                            ? $"Your timesheet for week of {GetStr(ts, "weekStartDate")} has been approved."
                            : $"Your timesheet for week of {GetStr(ts, "weekStartDate")} was rejected. {body.Comment ?? ""}",
                        ["relatedId"] = id,
                        ["isRead"] = false,
                    });
                }
            }

            return Ok(new { processed = result.Processed, succeeded = result.Succeeded, failed = result.Failed });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("timesheets/copy-previous-week")]
    [RequireAuth]
    public async Task<IActionResult> CopyPreviousWeek([FromBody] CopyWeekRequest body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            string employeeId;
            if (user.Role == "Employee")
            {
                employeeId = user.Id;
            }
            else if (user.Role == "Manager")
            {
                var requested = body.EmployeeId ?? user.Id;
                if (requested != user.Id)
                {
                    var emp = await _employeeRepo.FindById(requested);
                    if (emp == null || GetStr(emp, "managerId") != user.Id)
                        return StatusCode(403, new { error = "Forbidden: not a direct report" });
                }
                employeeId = requested;
            }
            else
            {
                employeeId = body.EmployeeId ?? user.Id;
            }

            var ts = await _timesheetRepo.CopyFromPreviousWeek(employeeId, body.SourceWeekStartDate, body.TargetWeekStartDate);
            return Ok(ts);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("timesheets")]
    [RequireAuth]
    public async Task<IActionResult> GetTimesheets(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? employeeId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? weekStartDate = null,
        [FromQuery] string? managerId = null)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            if (user.Role == "Employee") employeeId = user.Id;
            if (user.Role == "Manager") managerId = user.Id;

            var result = await _timesheetRepo.FindAll(page, pageSize, employeeId, status, weekStartDate, managerId);
            return Ok(new { data = result.Data, total = result.Total, page = result.Page, pageSize = result.PageSize });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("timesheets")]
    [RequireAuth]
    public async Task<IActionResult> CreateTimesheet([FromBody] CreateTimesheetRequest body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            string employeeId;
            if (user.Role == "Employee")
            {
                employeeId = user.Id;
            }
            else if (user.Role == "Manager")
            {
                var requested = body.EmployeeId ?? user.Id;
                if (requested != user.Id)
                {
                    var emp = await _employeeRepo.FindById(requested);
                    if (emp == null || GetStr(emp, "managerId") != user.Id)
                        return StatusCode(403, new { error = "Forbidden: not a direct report" });
                }
                employeeId = requested;
            }
            else
            {
                employeeId = body.EmployeeId ?? user.Id;
            }

            var existing = await _timesheetRepo.FindByEmployeeAndWeek(employeeId, body.WeekStartDate);
            if (existing != null && GetStr(existing, "status") != "Draft")
                return BadRequest(new { error = "A non-draft timesheet for this week already exists" });

            object? ts;
            if (existing != null)
                ts = await _timesheetRepo.Update(GetStr(existing, "id") ?? "", body.Rows ?? new List<Dictionary<string, object?>>());
            else
                ts = await _timesheetRepo.Create(employeeId, body.WeekStartDate, body.Rows ?? new List<Dictionary<string, object?>>());

            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Timesheet Created/Updated", ["entityType"] = "Timesheet",
                ["entityId"] = GetStr(ts, "id"),
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });

            return StatusCode(201, ts);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("timesheets/{timesheetId}")]
    [RequireAuth]
    public async Task<IActionResult> GetTimesheet(string timesheetId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var ts = await _timesheetRepo.FindById(timesheetId);
            if (ts == null) return NotFound(new { error = "Not found" });
            if (user.Role == "Employee" && GetStr(ts, "employeeId") != user.Id)
                return StatusCode(403, new { error = "Forbidden" });
            if (user.Role == "Manager")
            {
                var emp = await _employeeRepo.FindById(GetStr(ts, "employeeId") ?? "");
                if (emp == null || GetStr(emp, "managerId") != user.Id)
                    return StatusCode(403, new { error = "Forbidden" });
            }
            return Ok(ts);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPatch("timesheets/{timesheetId}")]
    [RequireAuth]
    public async Task<IActionResult> UpdateTimesheet(string timesheetId, [FromBody] UpdateTimesheetRequest body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var existing = await _timesheetRepo.FindById(timesheetId);
            if (existing == null) return NotFound(new { error = "Not found" });
            if (user.Role != "HR" && GetStr(existing, "employeeId") != user.Id)
                return StatusCode(403, new { error = "Forbidden" });

            var ts = await _timesheetRepo.Update(timesheetId, body.Rows ?? new List<Dictionary<string, object?>>());
            if (ts == null) return BadRequest(new { error = "Cannot update non-draft timesheet" });

            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Timesheet Updated", ["entityType"] = "Timesheet", ["entityId"] = timesheetId,
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });
            return Ok(ts);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("timesheets/{timesheetId}/submit")]
    [RequireAuth]
    public async Task<IActionResult> Submit(string timesheetId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var existing = await _timesheetRepo.FindById(timesheetId);
            if (existing == null) return NotFound(new { error = "Not found" });
            if (GetStr(existing, "employeeId") != user.Id)
                return StatusCode(403, new { error = "Forbidden" });

            var status = GetStr(existing, "status");
            if (status != "Draft" && status != "Rejected")
                return BadRequest(new { error = $"Cannot submit a timesheet in '{status}' status" });

            var ts = await _timesheetRepo.Submit(timesheetId);
            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Timesheet Submitted", ["entityType"] = "Timesheet", ["entityId"] = timesheetId,
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });

            if (!string.IsNullOrEmpty(user.ManagerId))
            {
                await _notificationRepo.Create(new Dictionary<string, object?>
                {
                    ["userId"] = user.ManagerId,
                    ["type"] = "TIMESHEET_SUBMITTED",
                    ["title"] = "Timesheet Awaiting Approval",
                    ["message"] = $"{user.Name} submitted a timesheet for week of {GetStr(ts, "weekStartDate")}.",
                    ["relatedId"] = timesheetId,
                    ["isRead"] = false,
                });
            }
            return Ok(ts);
        }
        catch (InvalidTransitionException e) { return Conflict(new { error = e.Message }); }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("timesheets/{timesheetId}/approve")]
    [RequireRole("Manager", "HR")]
    public async Task<IActionResult> Approve(string timesheetId, [FromBody] ApproveRejectRequest? body = null)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var existing = await _timesheetRepo.FindById(timesheetId);
            if (existing == null) return NotFound(new { error = "Not found" });

            if (user.Role == "Manager")
            {
                var emp = await _employeeRepo.FindById(GetStr(existing, "employeeId") ?? "");
                if (emp == null || GetStr(emp, "managerId") != user.Id)
                    return StatusCode(403, new { error = "Forbidden" });
            }
            if (GetStr(existing, "status") != "Submitted")
                return BadRequest(new { error = $"Cannot approve a timesheet in '{GetStr(existing, "status")}' status" });

            var ts = await _timesheetRepo.Approve(timesheetId, user.Id, body?.Comment);
            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Timesheet Approved", ["entityType"] = "Timesheet", ["entityId"] = timesheetId,
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });

            await _notificationRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = GetStr(existing, "employeeId"),
                ["type"] = "TIMESHEET_APPROVED",
                ["title"] = "Timesheet Approved",
                ["message"] = $"Your timesheet for week of {GetStr(existing, "weekStartDate")} has been approved.",
                ["relatedId"] = timesheetId,
                ["isRead"] = false,
            });
            return Ok(ts);
        }
        catch (InvalidTransitionException e) { return Conflict(new { error = e.Message }); }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("timesheets/{timesheetId}/reject")]
    [RequireRole("Manager", "HR")]
    public async Task<IActionResult> Reject(string timesheetId, [FromBody] ApproveRejectRequest body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var existing = await _timesheetRepo.FindById(timesheetId);
            if (existing == null) return NotFound(new { error = "Not found" });

            if (user.Role == "Manager")
            {
                var emp = await _employeeRepo.FindById(GetStr(existing, "employeeId") ?? "");
                if (emp == null || GetStr(emp, "managerId") != user.Id)
                    return StatusCode(403, new { error = "Forbidden" });
            }
            if (GetStr(existing, "status") != "Submitted")
                return BadRequest(new { error = $"Cannot reject a timesheet in '{GetStr(existing, "status")}' status" });
            if (string.IsNullOrWhiteSpace(body.Comment))
                return BadRequest(new { error = "Rejection comment is required" });

            var ts = await _timesheetRepo.Reject(timesheetId, body.Comment);
            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Timesheet Rejected", ["entityType"] = "Timesheet", ["entityId"] = timesheetId,
                ["newValue"] = body.Comment,
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });

            await _notificationRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = GetStr(existing, "employeeId"),
                ["type"] = "TIMESHEET_REJECTED",
                ["title"] = "Timesheet Rejected",
                ["message"] = $"Your timesheet for week of {GetStr(existing, "weekStartDate")} was rejected. Reason: {body.Comment}",
                ["relatedId"] = timesheetId,
                ["isRead"] = false,
            });

            // TODO: Send rejection email to the employee
            // var employee = await _employeeRepo.FindById(GetStr(existing, "employeeId") ?? "");
            // EmailService.Send(
            //     to: GetStr(employee, "email"),
            //     subject: "Timesheet Rejected",
            //     body: $"Hi {GetStr(employee, "name")}, your timesheet for the week of {GetStr(existing, "weekStartDate")} was rejected.\nReason: {body.Comment}\nPlease log in to review and re-submit."
            // );

            return Ok(ts);
        }
        catch (InvalidTransitionException e) { return Conflict(new { error = e.Message }); }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    private static string? GetStr(object? obj, string key)
    {
        if (obj == null) return null;
        var prop = obj.GetType().GetProperty(key);
        if (prop != null) return prop.GetValue(obj)?.ToString();
        return null;
    }
}

public record BulkActionRequest(List<string> TimesheetIds, string Action, string? Comment);
public record CopyWeekRequest(string SourceWeekStartDate, string TargetWeekStartDate, string? EmployeeId);
public record CreateTimesheetRequest(string WeekStartDate, List<Dictionary<string, object?>>? Rows, string? EmployeeId);
public record UpdateTimesheetRequest(List<Dictionary<string, object?>>? Rows);
public record ApproveRejectRequest(string? Comment);
