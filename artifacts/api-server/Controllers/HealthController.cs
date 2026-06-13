using Microsoft.AspNetCore.Mvc;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    [HttpGet("healthz")]
    public IActionResult Health() => Ok(new { status = "ok" });
}
