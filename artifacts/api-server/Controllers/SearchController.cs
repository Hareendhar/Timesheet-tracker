using Microsoft.AspNetCore.Mvc;
using Npgsql;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class SearchController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepo;
    private readonly IClientRepository _clientRepo;
    private readonly IProjectRepository _projectRepo;
    private readonly ITimesheetRepository _timesheetRepo;
    private readonly string _cs;

    public SearchController(
        IEmployeeRepository employeeRepo,
        IClientRepository clientRepo,
        IProjectRepository projectRepo,
        ITimesheetRepository timesheetRepo,
        IConfiguration cfg)
    {
        _employeeRepo = employeeRepo;
        _clientRepo = clientRepo;
        _projectRepo = projectRepo;
        _timesheetRepo = timesheetRepo;
        _cs = cfg["ConnectionStrings:Default"]!;
    }

    [HttpGet("search")]
    [RequireAuth]
    public async Task<IActionResult> Search([FromQuery] string? q = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(new
                {
                    employees = Array.Empty<object>(),
                    projects = Array.Empty<object>(),
                    clients = Array.Empty<object>(),
                    timesheets = Array.Empty<object>(),
                });

            var user = HttpContext.Session.GetUser()!;

            if (user.Role == "Employee")
            {
                var employees = await _employeeRepo.FindAll(1, 5, q, null, null, null, null);
                var self = employees.Data.Where(e => GetId(e) == user.Id).ToList();
                var myTs = await _timesheetRepo.FindAll(1, 5, user.Id, null, q, null);
                return Ok(new
                {
                    employees = self,
                    projects = Array.Empty<object>(),
                    clients = Array.Empty<object>(),
                    timesheets = myTs.Data,
                });
            }

            if (user.Role == "Manager")
            {
                var empTask = _employeeRepo.FindAll(1, 5, q, null, null, null, user.Id);
                var projTask = _projectRepo.FindAll(1, 5, "Active", null, q);
                var clientTask = _clientRepo.FindAll(1, 5, "Active", q);
                var tsTask = _timesheetRepo.FindAll(1, 5, null, null, null, user.Id);
                await Task.WhenAll(empTask, projTask, clientTask, tsTask);
                return Ok(new
                {
                    employees = empTask.Result.Data,
                    projects = projTask.Result.Data,
                    clients = clientTask.Result.Data,
                    timesheets = tsTask.Result.Data,
                });
            }

            // Admin
            {
                var empTask = _employeeRepo.FindAll(1, 5, q, null, null, null, null);
                var projTask = _projectRepo.FindAll(1, 5, null, null, q);
                var clientTask = _clientRepo.FindAll(1, 5, null, q);
                var tsTask = SearchTimesheets(q, 5);
                await Task.WhenAll(empTask, projTask, clientTask, tsTask);
                return Ok(new
                {
                    employees = empTask.Result.Data,
                    projects = projTask.Result.Data,
                    clients = clientTask.Result.Data,
                    timesheets = await tsTask,
                });
            }
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    private async Task<List<object>> SearchTimesheets(string q, int limit)
    {
        var rows = new List<object>();
        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT t.id, t.employee_id, t.week_start_date, t.week_end_date, t.status::text, t.total_hours, e.name as employee_name " +
            "FROM timesheets t JOIN employees e ON t.employee_id = e.id " +
            "WHERE e.name ILIKE $1 OR t.week_start_date ILIKE $1 " +
            $"ORDER BY t.updated_at DESC LIMIT {limit}", conn);
        cmd.Parameters.AddWithValue($"%{q}%");
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rows.Add(new
            {
                id = reader.GetString(0),
                employeeId = reader.GetString(1),
                weekStartDate = reader.GetString(2),
                weekEndDate = reader.GetString(3),
                status = reader.GetString(4),
                totalHours = reader.GetDouble(5),
                employeeName = reader.IsDBNull(6) ? null : reader.GetString(6),
            });
        }
        return rows;
    }

    private static string? GetId(object? obj)
    {
        if (obj == null) return null;
        var prop = obj.GetType().GetProperty("id") ?? obj.GetType().GetProperty("Id");
        return prop?.GetValue(obj)?.ToString();
    }
}
