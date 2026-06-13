using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class ClientsController : ControllerBase
{
    private readonly IClientRepository _clientRepo;
    private readonly IAuditRepository _auditRepo;

    public ClientsController(IClientRepository clientRepo, IAuditRepository auditRepo)
    {
        _clientRepo = clientRepo;
        _auditRepo = auditRepo;
    }

    [HttpGet("clients")]
    [RequireAuth]
    public async Task<IActionResult> GetClients(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        try
        {
            var result = await _clientRepo.FindAll(page, pageSize, status, search);
            return Ok(new { data = result.Data, total = result.Total, page = result.Page, pageSize = result.PageSize });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("clients")]
    [RequireRole("Admin")]
    public async Task<IActionResult> CreateClient([FromBody] Dictionary<string, object?> body)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(body.GetValueOrDefault("name")?.ToString()))
                return BadRequest(new { error = "name is required" });

            var user = HttpContext.Session.GetUser()!;
            var client = await _clientRepo.Create(body);
            await Audit(user, "Client Created", "Client", GetId(client), null, body);
            return StatusCode(201, client);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("clients/{clientId}")]
    [RequireAuth]
    public async Task<IActionResult> GetClient(string clientId)
    {
        try
        {
            var client = await _clientRepo.FindById(clientId);
            if (client == null) return NotFound(new { error = "Not found" });
            return Ok(client);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPatch("clients/{clientId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> UpdateClient(string clientId, [FromBody] Dictionary<string, object?> body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _clientRepo.FindById(clientId);
            var client = await _clientRepo.Update(clientId, body);
            if (client == null) return NotFound(new { error = "Not found" });
            await Audit(user, "Client Updated", "Client", clientId, old, body);
            return Ok(client);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpDelete("clients/{clientId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> DeleteClient(string clientId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _clientRepo.FindById(clientId);
            await _clientRepo.Delete(clientId);
            await Audit(user, "Client Deleted", "Client", clientId, old, null);
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
