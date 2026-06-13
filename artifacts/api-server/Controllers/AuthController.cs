using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly string _cs;

    public AuthController(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cs = cfg["ConnectionStrings:Default"]!;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        try
        {
            var rows = new List<object>();
            await using var conn = new NpgsqlConnection(_cs);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(
                "SELECT id, employee_id, name, email, department, designation, role::text as role, manager_id, status::text as status, created_at, updated_at " +
                "FROM employees WHERE status::text = 'Active' ORDER BY name", conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                rows.Add(new
                {
                    id = reader.GetString(0),
                    employeeId = reader.GetString(1),
                    name = reader.GetString(2),
                    email = reader.GetString(3),
                    department = reader.GetString(4),
                    designation = reader.GetString(5),
                    role = reader.GetString(6),
                    managerId = reader.IsDBNull(7) ? null : reader.GetString(7),
                    status = reader.GetString(8),
                    createdAt = reader.GetDateTime(9),
                    updatedAt = reader.GetDateTime(10),
                });
            }

            return Ok(rows);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("me")]
    public IActionResult Me()
    {
        var user = HttpContext.Session.GetUser();
        if (user == null) return Unauthorized(new { error = "Not authenticated" });
        return Ok(user);
    }

    [HttpPost("select-user")]
    public async Task<IActionResult> SelectUser([FromBody] SelectUserRequest body)
    {
        try
        {
            var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == body.Id);
            if (employee == null) return NotFound(new { error = "Employee not found" });

            var sessionUser = new SessionUser
            {
                Id = employee.Id,
                EmployeeId = employee.EmployeeId,
                Name = employee.Name,
                Email = employee.Email,
                Role = employee.Role,
                Department = employee.Department,
                Designation = employee.Designation,
                ManagerId = employee.ManagerId,
            };
            HttpContext.Session.SetUser(sessionUser);
            return Ok(sessionUser);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        HttpContext.Session.Clear();
        return Ok(new { ok = true });
    }
}

public record SelectUserRequest(string Id);
