using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api")]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepo;
    private readonly IAuditRepository _auditRepo;

    public EmployeesController(IEmployeeRepository employeeRepo, IAuditRepository auditRepo)
    {
        _employeeRepo = employeeRepo;
        _auditRepo = auditRepo;
    }

    [HttpGet("employees")]
    [RequireAuth]
    public async Task<IActionResult> GetEmployees(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] string? status = null,
        [FromQuery] string? department = null)
    {
        try
        {
            var result = await _employeeRepo.FindAll(page, pageSize, search, role, status, department, null);
            return Ok(new { data = result.Data, total = result.Total, page = result.Page, pageSize = result.PageSize });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("employees")]
    [RequireRole("Admin")]
    public async Task<IActionResult> CreateEmployee([FromBody] Dictionary<string, object?> body)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(body.GetValueOrDefault("name")?.ToString()))
                return BadRequest(new { error = "name is required" });
            if (string.IsNullOrWhiteSpace(body.GetValueOrDefault("email")?.ToString()))
                return BadRequest(new { error = "email is required" });
            if (string.IsNullOrWhiteSpace(body.GetValueOrDefault("department")?.ToString()))
                return BadRequest(new { error = "department is required" });
            if (string.IsNullOrWhiteSpace(body.GetValueOrDefault("designation")?.ToString()))
                return BadRequest(new { error = "designation is required" });

            var user = HttpContext.Session.GetUser()!;
            var employee = await _employeeRepo.Create(body);
            await Audit(user, "Employee Created", "Employee", GetId(employee), null, body);
            return StatusCode(201, employee);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("employees/bulk-upload-template")]
    [RequireRole("Admin")]
    public IActionResult GetBulkUploadTemplate()
    {
        try
        {
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Employees");
            var headers = new[] { "employeeId", "name", "email", "department", "designation", "role", "status", "managerId" };
            for (int i = 0; i < headers.Length; i++)
                ws.Cell(1, i + 1).Value = headers[i];

            ws.Cell(2, 1).Value = "EMP001";
            ws.Cell(2, 2).Value = "John Doe";
            ws.Cell(2, 3).Value = "john.doe@example.com";
            ws.Cell(2, 4).Value = "Engineering";
            ws.Cell(2, 5).Value = "Software Engineer";
            ws.Cell(2, 6).Value = "Employee";
            ws.Cell(2, 7).Value = "Active";
            ws.Cell(2, 8).Value = "";

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Position = 0;
            return File(ms.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "employee-template.xlsx");
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPost("employees/bulk-upload")]
    [RequireRole("Admin")]
    public async Task<IActionResult> BulkUpload(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file uploaded" });

            var rows = new List<Dictionary<string, object?>>();
            using var stream = file.OpenReadStream();
            using var wb = new XLWorkbook(stream);
            var ws = wb.Worksheets.First();

            var headers = ws.Row(1).Cells()
                .Select(c => c.Value.ToString() ?? "")
                .ToList();

            for (int r = 2; r <= (ws.LastRowUsed()?.RowNumber() ?? 1); r++)
            {
                var row = new Dictionary<string, object?>();
                for (int c = 1; c <= headers.Count; c++)
                {
                    var val = ws.Cell(r, c).Value.ToString();
                    row[headers[c - 1]] = string.IsNullOrWhiteSpace(val) ? null : val;
                }
                if (row.Values.Any(v => v != null))
                    rows.Add(row);
            }

            if (rows.Count == 0)
                return BadRequest(new { error = "No data rows found in file" });

            var user = HttpContext.Session.GetUser()!;
            var (success, errors) = await _employeeRepo.BulkCreate(rows);

            await Audit(user, "Employee Bulk Upload", "Employee", null,
                null, new { totalRows = rows.Count, successCount = success.Count, errorCount = errors.Count });

            return Ok(new
            {
                message = $"{success.Count} employees created successfully",
                created = success,
                errors,
            });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("employees/{employeeId}/profile")]
    [RequireAuth]
    public async Task<IActionResult> GetProfile(string employeeId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            if (user.Role == "Employee" && user.Id != employeeId)
                return StatusCode(403, new { error = "Forbidden" });
            if (user.Role == "Manager")
            {
                var emp = await _employeeRepo.FindById(employeeId);
                if (emp == null) return NotFound(new { error = "Not found" });
                if (GetStr(emp, "managerId") != user.Id && employeeId != user.Id)
                    return StatusCode(403, new { error = "Forbidden" });
            }

            var profile = await _employeeRepo.GetProfile(employeeId);
            if (profile == null) return NotFound(new { error = "Not found" });
            return Ok(profile);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("employees/{employeeId}/direct-reports")]
    [RequireRole("Manager", "Admin")]
    public async Task<IActionResult> GetDirectReports(string employeeId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            if (user.Role == "Manager" && user.Id != employeeId)
                return StatusCode(403, new { error = "Forbidden: you can only view your own direct reports" });

            var result = await _employeeRepo.GetDirectReports(employeeId);
            if (result == null) return NotFound(new { error = "Not found" });
            return Ok(result);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("employees/{employeeId}")]
    [RequireAuth]
    public async Task<IActionResult> GetEmployee(string employeeId)
    {
        try
        {
            var employee = await _employeeRepo.FindById(employeeId);
            if (employee == null) return NotFound(new { error = "Not found" });
            return Ok(employee);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpPatch("employees/{employeeId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> UpdateEmployee(string employeeId, [FromBody] Dictionary<string, object?> body)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _employeeRepo.FindById(employeeId);
            if (old == null) return NotFound(new { error = "Not found" });
            var employee = await _employeeRepo.Update(employeeId, body);
            await Audit(user, "Employee Updated", "Employee", employeeId, old, body);
            return Ok(employee);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpDelete("employees/{employeeId}")]
    [RequireRole("Admin")]
    public async Task<IActionResult> DeleteEmployee(string employeeId)
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var old = await _employeeRepo.FindById(employeeId);
            if (old == null) return NotFound(new { error = "Not found" });
            await _employeeRepo.Delete(employeeId);
            await Audit(user, "Employee Deleted", "Employee", employeeId, old, null);
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

    private static string? GetStr(object? obj, string key)
    {
        if (obj == null) return null;
        var prop = obj.GetType().GetProperty(key);
        return prop?.GetValue(obj)?.ToString();
    }
}
