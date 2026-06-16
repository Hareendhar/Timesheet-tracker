using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api/export")]
public class ExportController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepo;
    private readonly IClientRepository _clientRepo;
    private readonly IProjectRepository _projectRepo;
    private readonly ITimesheetRepository _timesheetRepo;
    private readonly IAuditRepository _auditRepo;

    public ExportController(
        IEmployeeRepository employeeRepo, IClientRepository clientRepo,
        IProjectRepository projectRepo, ITimesheetRepository timesheetRepo,
        IAuditRepository auditRepo)
    {
        _employeeRepo = employeeRepo;
        _clientRepo = clientRepo;
        _projectRepo = projectRepo;
        _timesheetRepo = timesheetRepo;
        _auditRepo = auditRepo;
    }

    [HttpGet("employees")]
    [RequireRole("HR")]
    public async Task<IActionResult> ExportEmployees([FromQuery] string format = "csv")
    {
        try
        {
            var result = await _employeeRepo.FindAll(1, 10000, null, null, null, null, null);
            var cols = new[] { "employeeId", "name", "email", "department", "designation", "role", "status", "managerName", "createdAt" };
            return SendExport(result.Data.Cast<object>().ToList(), cols, "employees", format);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("timesheets")]
    [RequireRole("HR", "Manager")]
    public async Task<IActionResult> ExportTimesheets([FromQuery] string format = "csv")
    {
        try
        {
            var user = HttpContext.Session.GetUser()!;
            var managerId = user.Role == "Manager" ? user.Id : null;
            var result = await _timesheetRepo.FindAll(1, 10000, null, null, null, managerId);
            var flat = result.Data.Select(ts =>
            {
                dynamic d = ts;
                return (object)new
                {
                    employeeName = GetStr(ts, "employeeName") ?? "",
                    weekStartDate = GetStr(ts, "weekStartDate") ?? "",
                    weekEndDate = GetStr(ts, "weekEndDate") ?? "",
                    status = GetStr(ts, "status") ?? "",
                    totalHours = GetProp(ts, "totalHours"),
                    submittedAt = GetStr(ts, "submittedAt") ?? "",
                    approvedAt = GetStr(ts, "approvedAt") ?? "",
                    approverName = GetStr(ts, "approverName") ?? "",
                    rejectionComment = GetStr(ts, "rejectionComment") ?? "",
                };
            }).ToList();
            var cols = new[] { "employeeName", "weekStartDate", "weekEndDate", "status", "totalHours", "submittedAt", "approvedAt", "approverName", "rejectionComment" };
            return SendExport(flat, cols, "timesheets", format);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("clients")]
    [RequireRole("HR")]
    public async Task<IActionResult> ExportClients([FromQuery] string format = "csv")
    {
        try
        {
            var result = await _clientRepo.FindAll(1, 10000, null, null);
            var cols = new[] { "clientCode", "name", "status", "createdAt" };
            return SendExport(result.Data.Cast<object>().ToList(), cols, "clients", format);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("projects")]
    [RequireRole("HR")]
    public async Task<IActionResult> ExportProjects([FromQuery] string format = "csv")
    {
        try
        {
            var result = await _projectRepo.FindAll(1, 10000, null, null, null);
            var cols = new[] { "projectCode", "name", "clientName", "status", "createdAt" };
            return SendExport(result.Data.Cast<object>().ToList(), cols, "projects", format);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    [HttpGet("audit-logs")]
    [RequireRole("HR")]
    public async Task<IActionResult> ExportAuditLogs(
        [FromQuery] string format = "csv",
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null)
    {
        try
        {
            var data = await _auditRepo.FindAllExport(dateFrom, dateTo);
            var cols = new[] { "userName", "role", "action", "entityType", "entityId", "ipAddress", "createdAt" };
            return SendExport(data, cols, "audit-logs", format);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    private IActionResult SendExport(List<object> data, string[] columns, string filename, string format)
    {
        if (format == "xlsx")
        {
            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Data");
            for (int c = 0; c < columns.Length; c++)
                ws.Cell(1, c + 1).Value = columns[c];
            for (int r = 0; r < data.Count; r++)
            {
                var item = data[r];
                for (int c = 0; c < columns.Length; c++)
                {
                    var prop = item.GetType().GetProperty(columns[c]);
                    var val = prop?.GetValue(item)?.ToString() ?? "";
                    ws.Cell(r + 2, c + 1).Value = val;
                }
            }
            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return File(ms.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"{filename}.xlsx");
        }
        else
        {
            var csv = ToCsv(data, columns);
            return File(
                System.Text.Encoding.UTF8.GetBytes(csv),
                "text/csv",
                $"{filename}.csv");
        }
    }

    private static string ToCsv(List<object> data, string[] columns)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine(string.Join(",", columns));
        foreach (var item in data)
        {
            var vals = columns.Select(col =>
            {
                var prop = item.GetType().GetProperty(col);
                var val = prop?.GetValue(item)?.ToString() ?? "";
                val = val.Replace("\"", "\"\"");
                if (val.Contains(',') || val.Contains('"') || val.Contains('\n'))
                    val = $"\"{val}\"";
                return val;
            });
            sb.AppendLine(string.Join(",", vals));
        }
        return sb.ToString();
    }

    private static string? GetStr(object? obj, string key)
    {
        if (obj == null) return null;
        var prop = obj.GetType().GetProperty(key);
        return prop?.GetValue(obj)?.ToString();
    }

    private static object? GetProp(object? obj, string key)
    {
        if (obj == null) return null;
        var prop = obj.GetType().GetProperty(key);
        return prop?.GetValue(obj);
    }
}
