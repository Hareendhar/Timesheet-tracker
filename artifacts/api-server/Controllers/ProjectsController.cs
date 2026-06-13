using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository _projectRepo;
    private readonly IAuditRepository _auditRepo;

    public ProjectsController(IProjectRepository projectRepo, IAuditRepository auditRepo)
    {
        _projectRepo = projectRepo;
        _auditRepo = auditRepo;
    }

    [HttpGet("projects")]
    [RequireAuth]
    public async Task<IActionResult> GetProjects(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? clientId = null,
        [FromQuery] string? search = null)
    {
        try
        {
            var result = await _projectRepo.FindAll(page, pageSize, status, clientId, search);
            return Ok(new { data = result.Data, total = result.Total, page = result.Page, pageSize = result.PageSize });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("projects")]
    [RequireRole("Admin")]
    public async Task<IActionResult> CreateProject([FromBody] Dictionary<string, object?> body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var project = await _projectRepo.Create(body);
            await Audit(user, "Project Created", "Project", GetId(project), null, body);
            return StatusCode(201, project);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("projects/{projectId}")]
    [RequireAuth]
    public async Task<IActionResult> GetProject(string projectId)
    {
        try
        {
            var project = await _projectRepo.FindById(projectId);
            if (project == null) return NotFound(new { error = "Not found" });
            return Ok(project);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPatch("projects/{projectId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> UpdateProject(string projectId, [FromBody] Dictionary<string, object?> body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _projectRepo.FindById(projectId);
            var project = await _projectRepo.Update(projectId, body);
            if (project == null) return NotFound(new { error = "Not found" });
            await Audit(user, "Project Updated", "Project", projectId, old, body);
            return Ok(project);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpDelete("projects/{projectId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> DeleteProject(string projectId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _projectRepo.FindById(projectId);
            await _projectRepo.Delete(projectId);
            await Audit(user, "Project Deleted", "Project", projectId, old, null);
            return Ok(new { ok = true });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    private async Task Audit(Models.SessionUser user, string action, string entityType, string? entityId,
        object? oldVal, object? newVal)
    {
        await _auditRepo.Create(new Dictionary<string, object?>
        {
            ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
            ["action"] = action, ["entityType"] = entityType, ["entityId"] = entityId,
            ["oldValue"] = oldVal != null ? System.Text.Json.JsonSerializer.Serialize(oldVal) : null,
            ["newValue"] = newVal != null ? System.Text.Json.JsonSerializer.Serialize(newVal) : null,
            ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
        });
    }

    private static string? GetId(object? obj)
    {
        if (obj == null) return null;
        var prop = obj.GetType().GetProperty("id") ?? obj.GetType().GetProperty("Id");
        return prop?.GetValue(obj)?.ToString();
    }
}
