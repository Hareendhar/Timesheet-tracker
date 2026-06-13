using Microsoft.AspNetCore.Mvc;
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

    public SearchController(IEmployeeRepository employeeRepo, IClientRepository clientRepo, IProjectRepository projectRepo)
    {
        _employeeRepo = employeeRepo;
        _clientRepo = clientRepo;
        _projectRepo = projectRepo;
    }

    [HttpGet("search")]
    [RequireAuth]
    public async Task<IActionResult> Search([FromQuery] string? q = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(new { employees = Array.Empty<object>(), projects = Array.Empty<object>(), clients = Array.Empty<object>() });

            var user = HttpContext.Session.GetUser()!;

            if (user.Role == "Employee")
            {
                var employees = await _employeeRepo.FindAll(1, 5, q, null, null, null, null);
                var self = employees.Data.Where(e => GetId(e) == user.Id).ToList();
                return Ok(new { employees = self, projects = Array.Empty<object>(), clients = Array.Empty<object>() });
            }

            if (user.Role == "Manager")
            {
                var (empTask, projTask, clientTask) = (
                    _employeeRepo.FindAll(1, 5, q, null, null, null, user.Id),
                    _projectRepo.FindAll(1, 5, "Active", null, q),
                    _clientRepo.FindAll(1, 5, "Active", q)
                );
                await Task.WhenAll(empTask, projTask, clientTask);
                return Ok(new
                {
                    employees = empTask.Result.Data,
                    projects = projTask.Result.Data,
                    clients = clientTask.Result.Data,
                });
            }

            // Admin
            {
                var (empTask, projTask, clientTask) = (
                    _employeeRepo.FindAll(1, 5, q, null, null, null, null),
                    _projectRepo.FindAll(1, 5, null, null, q),
                    _clientRepo.FindAll(1, 5, null, q)
                );
                await Task.WhenAll(empTask, projTask, clientTask);
                return Ok(new
                {
                    employees = empTask.Result.Data,
                    projects = projTask.Result.Data,
                    clients = clientTask.Result.Data,
                });
            }
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
