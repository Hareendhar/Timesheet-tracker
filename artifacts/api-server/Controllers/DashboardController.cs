using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly ITimesheetRepository _timesheetRepo;
    private readonly AppDbContext _db;
    private readonly string _connStr;

    public DashboardController(ITimesheetRepository timesheetRepo, AppDbContext db, IConfiguration cfg)
    {
        _timesheetRepo = timesheetRepo;
        _db = db;
        _connStr = cfg["ConnectionStrings:Default"]
            ?? Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? throw new InvalidOperationException("DATABASE_URL not set");
    }

    [HttpGet("stats")]
    [RequireRole("Admin", "Manager")]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var breakdown = await _timesheetRepo.GetStatusBreakdown();
            dynamic bd = breakdown;

            int total = 0, managers = 0, admins = 0;
            long projectCount = 0, clientCount = 0;

            await using var conn = new NpgsqlConnection(_connStr);
            await conn.OpenAsync();

            await using (var cmd = new NpgsqlCommand(
                "SELECT COUNT(*) as total, COUNT(CASE WHEN role::text = 'Manager' THEN 1 END) as managers, " +
                "COUNT(CASE WHEN role::text = 'Admin' THEN 1 END) as admins FROM employees WHERE status::text = 'Active'", conn))
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                if (await reader.ReadAsync())
                {
                    total = Convert.ToInt32(reader["total"]);
                    managers = Convert.ToInt32(reader["managers"]);
                    admins = Convert.ToInt32(reader["admins"]);
                }
            }

            await using (var cmd = new NpgsqlCommand("SELECT COUNT(*) as count FROM clients WHERE status::text = 'Active'", conn))
                clientCount = Convert.ToInt64(await cmd.ExecuteScalarAsync() ?? 0L);

            await using (var cmd = new NpgsqlCommand("SELECT COUNT(*) as count FROM projects WHERE status::text = 'Active'", conn))
                projectCount = Convert.ToInt64(await cmd.ExecuteScalarAsync() ?? 0L);

            int submitted = (int)bd.submitted + (int)bd.approved + (int)bd.rejected;
            int pending = (int)bd.submitted;
            int complianceRate = total > 0
                ? (int)Math.Round((double)(int)bd.approved / Math.Max(submitted, 1) * 100)
                : 0;

            return Ok(new
            {
                totalEmployees = total,
                totalManagers = managers,
                totalProjects = projectCount,
                totalClients = clientCount,
                timesheetsSubmitted = submitted,
                timesheetsApproved = (int)bd.approved,
                timesheetsRejected = (int)bd.rejected,
                pendingApprovals = pending,
                complianceRate,
            });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("timesheet-status-breakdown")]
    [RequireRole("Admin", "Manager")]
    public async Task<IActionResult> GetStatusBreakdown()
    {
        try { return Ok(await _timesheetRepo.GetStatusBreakdown()); }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("recent-activity")]
    [RequireRole("Admin", "Manager")]
    public async Task<IActionResult> GetRecentActivity([FromQuery] int limit = 10)
    {
        try { return Ok(await _timesheetRepo.GetRecentActivity(limit)); }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("compliance-overview")]
    [RequireRole("Admin", "Manager")]
    public async Task<IActionResult> GetComplianceOverview()
    {
        try { return Ok(await _timesheetRepo.GetComplianceOverview()); }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("my-stats")]
    [RequireAuth]
    public async Task<IActionResult> GetMyStats()
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var result = await _timesheetRepo.FindAll(1, 1000, user.Id, null, null, null);
            dynamic[] ts = result.Data.Cast<dynamic>().ToArray();

            int total = ts.Length;
            int drafts = ts.Count(t => (string)t.status == "Draft");
            int submitted = ts.Count(t => (string)t.status == "Submitted");
            int approved = ts.Count(t => (string)t.status == "Approved");
            int rejected = ts.Count(t => (string)t.status == "Rejected");
            double totalHours = ts.Sum(t => (double)Convert.ToDouble(t.totalHours));

            return Ok(new { total, drafts, submitted, approved, rejected, totalHours });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }
}
