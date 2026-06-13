using Microsoft.AspNetCore.Mvc;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "ok" });

    [HttpGet("healthz")]
    public IActionResult Healthz() => Ok(new { status = "ok" });
}
