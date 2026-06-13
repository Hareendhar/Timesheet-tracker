using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class AuditLogsController : ControllerBase
{
    private readonly IAuditRepository _auditRepo;
    public AuditLogsController(IAuditRepository auditRepo) { _auditRepo = auditRepo; }

    [HttpGet("audit-logs")]
    [RequireRole("Admin")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? userId = null,
        [FromQuery] string? action = null,
        [FromQuery] string? role = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null)
    {
        try
        {
            var result = await _auditRepo.FindAll(page, pageSize, userId, action, role, dateFrom, dateTo);
            return Ok(new { data = result.Data, total = result.Total, page = result.Page, pageSize = result.PageSize });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }
}
