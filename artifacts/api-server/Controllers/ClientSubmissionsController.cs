using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using TimesheetApi.Helpers;
using TimesheetApi.Middleware;
using TimesheetApi.Repositories;

namespace TimesheetApi.Controllers;

[ApiController]
[Route("api/client-submissions")]
[RequireRole("HR")]
public class ClientSubmissionsController : ControllerBase
{
    private readonly string _cs;
    private readonly IAuditRepository _auditRepo;

    public ClientSubmissionsController(IConfiguration cfg, IAuditRepository auditRepo)
    {
        _cs = cfg["ConnectionStrings:Default"]
            ?? Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? throw new InvalidOperationException("DATABASE_URL not set");
        _auditRepo = auditRepo;
    }

    // GET /api/client-submissions?page=1&pageSize=20&projectId=&clientManagerEmail=&managerId=&status=
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? projectId = null,
        [FromQuery] string? clientManagerEmail = null,
        [FromQuery] string? managerId = null,
        [FromQuery] string? status = null)
    {
        try
        {
            var offset = (page - 1) * pageSize;
            var conditions = new List<string> { "t.status::text IN ('Approved','ClientSubmitted')" };
            var values = new List<object>();
            int idx = 1;

            if (!string.IsNullOrEmpty(status))
            {
                conditions.Add($"t.status::text = ${idx++}");
                values.Add(status);
            }
            if (!string.IsNullOrEmpty(managerId))
            {
                conditions.Add($"e.manager_id = ${idx++}");
                values.Add(managerId);
            }
            if (!string.IsNullOrEmpty(projectId))
            {
                conditions.Add($"EXISTS (SELECT 1 FROM timesheet_rows tr2 WHERE tr2.timesheet_id = t.id AND tr2.project_id = ${idx++})");
                values.Add(projectId);
            }
            if (!string.IsNullOrEmpty(clientManagerEmail))
            {
                conditions.Add($"EXISTS (SELECT 1 FROM timesheet_rows tr2 JOIN projects p2 ON tr2.project_id = p2.id WHERE tr2.timesheet_id = t.id AND p2.client_manager_email ILIKE ${idx++})");
                values.Add($"%{clientManagerEmail}%");
            }

            var where = " WHERE " + string.Join(" AND ", conditions);

            var baseQ = @"
SELECT t.id, t.employee_id, t.week_start_date, t.week_end_date, t.status::text as status,
       t.total_hours, t.submitted_at, t.approved_at, t.approved_by,
       t.client_submitted_at, t.client_submitted_by,
       e.name as employee_name, e.employee_id as employee_code, e.department,
       m.name as manager_name,
       (SELECT STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name)
        FROM timesheet_rows tr3 JOIN projects p ON tr3.project_id = p.id
        WHERE tr3.timesheet_id = t.id) as project_names,
       (SELECT STRING_AGG(DISTINCT p.project_code, ', ' ORDER BY p.project_code)
        FROM timesheet_rows tr3 JOIN projects p ON tr3.project_id = p.id
        WHERE tr3.timesheet_id = t.id) as project_codes,
       (SELECT STRING_AGG(DISTINCT c.name, ', ' ORDER BY c.name)
        FROM timesheet_rows tr3 JOIN projects p ON tr3.project_id = p.id JOIN clients c ON p.client_id = c.id
        WHERE tr3.timesheet_id = t.id) as client_names,
       (SELECT STRING_AGG(DISTINCT p.client_manager_name, ', ')
        FROM timesheet_rows tr3 JOIN projects p ON tr3.project_id = p.id
        WHERE tr3.timesheet_id = t.id AND p.client_manager_name IS NOT NULL) as client_manager_names,
       (SELECT STRING_AGG(DISTINCT p.client_manager_email, ', ')
        FROM timesheet_rows tr3 JOIN projects p ON tr3.project_id = p.id
        WHERE tr3.timesheet_id = t.id AND p.client_manager_email IS NOT NULL) as client_manager_emails
FROM timesheets t
JOIN employees e ON t.employee_id = e.id
LEFT JOIN employees m ON e.manager_id = m.id";

            await using var conn = new NpgsqlConnection(_cs);
            await conn.OpenAsync();

            int total;
            await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM ({baseQ}{where}) sub", conn))
            {
                foreach (var v in values) cmd.Parameters.AddWithValue(v);
                total = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            }

            var rows = new List<object>();
            await using (var cmd = new NpgsqlCommand($"{baseQ}{where} ORDER BY t.week_start_date DESC, t.created_at DESC LIMIT {pageSize} OFFSET {offset}", conn))
            {
                foreach (var v in values) cmd.Parameters.AddWithValue(v);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    rows.Add(ReadRow(reader));
            }

            return Ok(new { data = rows, total, page, pageSize });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    // POST /api/client-submissions/submit
    [HttpPost("submit")]
    public async Task<IActionResult> Submit([FromBody] SubmitRequest body)
    {
        if (body.TimesheetIds == null || body.TimesheetIds.Length == 0)
            return BadRequest(new { error = "timesheetIds is required" });

        try
        {
            var user = HttpContext.Session.GetUser()!;
            var now = DateTime.UtcNow;
            int submitted = 0;

            await using var conn = new NpgsqlConnection(_cs);
            await conn.OpenAsync();

            foreach (var tsId in body.TimesheetIds)
            {
                await using var cmd = new NpgsqlCommand(
                    "UPDATE timesheets SET status = 'ClientSubmitted'::timesheet_status, client_submitted_at = $2, client_submitted_by = $3, updated_at = $2 WHERE id = $1 AND status::text = 'Approved'",
                    conn);
                cmd.Parameters.AddWithValue(tsId);
                cmd.Parameters.AddWithValue(now);
                cmd.Parameters.AddWithValue(user.Name);
                submitted += await cmd.ExecuteNonQueryAsync();
            }

            // TODO: Send email to client manager(s) for each submitted timesheet
            // var clientManagers = await GetClientManagersForTimesheets(body.TimesheetIds, conn);
            // foreach (var cm in clientManagers) {
            //   EmailService.Send(
            //     to: cm.Email,
            //     subject: $"Timesheets Submitted for Your Approval — {cm.ProjectName}",
            //     body: $"Dear {cm.Name}, {submitted} timesheet(s) have been submitted for your review and approval. Please log in to the portal to review and approve."
            //   );
            // }

            await _auditRepo.Create(new Dictionary<string, object?>
            {
                ["userId"] = user.Id, ["userName"] = user.Name, ["role"] = user.Role,
                ["action"] = "Client Submission Sent", ["entityType"] = "Timesheet",
                ["entityId"] = string.Join(",", body.TimesheetIds),
                ["newValue"] = $"Submitted {submitted} timesheet(s) to client manager",
                ["ipAddress"] = ClientIpHelper.GetClientIp(Request),
            });

            return Ok(new { submitted });
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    // GET /api/client-submissions/download?ids=id1,id2
    [HttpGet("download")]
    public async Task<IActionResult> Download([FromQuery] string ids)
    {
        if (string.IsNullOrWhiteSpace(ids)) return BadRequest(new { error = "ids is required" });
        var tsIds = ids.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim()).ToArray();
        if (tsIds.Length == 0) return BadRequest(new { error = "ids is required" });

        try
        {
            await using var conn = new NpgsqlConnection(_cs);
            await conn.OpenAsync();

            var placeholders = string.Join(",", tsIds.Select((_, i) => $"${i + 1}"));
            var detailQ = $@"
SELECT t.id as timesheet_id, t.week_start_date, t.week_end_date, t.status::text as status,
       t.total_hours as timesheet_total_hours, t.submitted_at, t.approved_at,
       t.client_submitted_at,
       e.name as employee_name, e.employee_id as employee_code, e.department,
       m.name as manager_name,
       p.name as project_name, p.project_code, p.client_manager_name, p.client_manager_email,
       c.name as client_name,
       a.name as activity_name,
       tr.monday, tr.tuesday, tr.wednesday, tr.thursday, tr.friday, tr.saturday, tr.sunday,
       tr.total_hours as row_total_hours, tr.comments
FROM timesheet_rows tr
JOIN timesheets t ON tr.timesheet_id = t.id
JOIN employees e ON t.employee_id = e.id
LEFT JOIN employees m ON e.manager_id = m.id
JOIN projects p ON tr.project_id = p.id
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN activities a ON tr.activity_id = a.id
WHERE t.id IN ({placeholders})
ORDER BY t.week_start_date, e.name, p.name";

            var detailRows = new List<Dictionary<string, object?>>();
            await using (var cmd = new NpgsqlCommand(detailQ, conn))
            {
                foreach (var tid in tsIds) cmd.Parameters.AddWithValue(tid);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var dictRow = new Dictionary<string, object?>();
                    for (int i = 0; i < reader.FieldCount; i++)
                        dictRow[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    detailRows.Add(dictRow);
                }
            }

            using var wb = new XLWorkbook();
            var ws = wb.Worksheets.Add("Timesheets");

            var headers = new[]
            {
                "Employee Name", "Employee ID", "Department", "Internal Manager",
                "Project Code", "Project Name", "Client", "Client Manager", "Client Manager Email",
                "Week Start", "Week End", "Activity",
                "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
                "Row Total Hrs", "Timesheet Total Hrs",
                "Status", "Submitted Date", "Approved Date", "Client Submitted Date", "Comments"
            };

            var header = ws.Row(1);
            for (int c = 0; c < headers.Length; c++)
            {
                var cell = ws.Cell(1, c + 1);
                cell.Value = headers[c];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1C75BC");
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }

            int row = 2;
            foreach (var r in detailRows)
            {
                string? S(string key) => r.TryGetValue(key, out var v) && v != null ? v.ToString() : null;
                double D(string key) => r.TryGetValue(key, out var v) && v != null ? Convert.ToDouble(v) : 0;

                ws.Cell(row, 1).Value = S("employee_name") ?? "";
                ws.Cell(row, 2).Value = S("employee_code") ?? "";
                ws.Cell(row, 3).Value = S("department") ?? "";
                ws.Cell(row, 4).Value = S("manager_name") ?? "";
                ws.Cell(row, 5).Value = S("project_code") ?? "";
                ws.Cell(row, 6).Value = S("project_name") ?? "";
                ws.Cell(row, 7).Value = S("client_name") ?? "";
                ws.Cell(row, 8).Value = S("client_manager_name") ?? "";
                ws.Cell(row, 9).Value = S("client_manager_email") ?? "";
                ws.Cell(row, 10).Value = S("week_start_date") ?? "";
                ws.Cell(row, 11).Value = S("week_end_date") ?? "";
                ws.Cell(row, 12).Value = S("activity_name") ?? "";
                ws.Cell(row, 13).Value = D("monday");
                ws.Cell(row, 14).Value = D("tuesday");
                ws.Cell(row, 15).Value = D("wednesday");
                ws.Cell(row, 16).Value = D("thursday");
                ws.Cell(row, 17).Value = D("friday");
                ws.Cell(row, 18).Value = D("saturday");
                ws.Cell(row, 19).Value = D("sunday");
                ws.Cell(row, 20).Value = D("row_total_hours");
                ws.Cell(row, 21).Value = D("timesheet_total_hours");
                ws.Cell(row, 22).Value = S("status") ?? "";

                if (r.TryGetValue("submitted_at", out var sa) && sa is DateTime saDt)
                    ws.Cell(row, 23).Value = saDt.ToString("yyyy-MM-dd");
                if (r.TryGetValue("approved_at", out var aa) && aa is DateTime aaDt)
                    ws.Cell(row, 24).Value = aaDt.ToString("yyyy-MM-dd");
                if (r.TryGetValue("client_submitted_at", out var csa) && csa is DateTime csaDt)
                    ws.Cell(row, 25).Value = csaDt.ToString("yyyy-MM-dd");

                ws.Cell(row, 26).Value = S("comments") ?? "";

                if (row % 2 == 0)
                    ws.Row(row).Cells(1, headers.Length).Style.Fill.BackgroundColor = XLColor.FromHtml("#F0F7FF");

                row++;
            }

            ws.Columns().AdjustToContents();
            ws.SheetView.FreezeRows(1);

            var range = ws.Range(1, 1, Math.Max(row - 1, 1), headers.Length);
            range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            range.Style.Border.InsideBorder = XLBorderStyleValues.Hair;

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Position = 0;
            var fileName = $"timesheets_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";
            return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
        catch (Exception e) { return StatusCode(500, new { error = e.Message }); }
    }

    private static object ReadRow(NpgsqlDataReader r)
    {
        string? NS(string col) => r.IsDBNull(r.GetOrdinal(col)) ? null : r.GetString(r.GetOrdinal(col));
        DateTime? ND(string col) => r.IsDBNull(r.GetOrdinal(col)) ? null : r.GetDateTime(r.GetOrdinal(col));
        return new
        {
            id = r.GetString(r.GetOrdinal("id")),
            employeeId = r.GetString(r.GetOrdinal("employee_id")),
            weekStartDate = r.GetString(r.GetOrdinal("week_start_date")),
            weekEndDate = r.GetString(r.GetOrdinal("week_end_date")),
            status = r.GetString(r.GetOrdinal("status")),
            totalHours = Convert.ToDouble(r["total_hours"]),
            submittedAt = ND("submitted_at"),
            approvedAt = ND("approved_at"),
            approvedBy = NS("approved_by"),
            clientSubmittedAt = ND("client_submitted_at"),
            clientSubmittedBy = NS("client_submitted_by"),
            employeeName = NS("employee_name"),
            employeeCode = NS("employee_code"),
            department = NS("department"),
            managerName = NS("manager_name"),
            projectNames = NS("project_names"),
            projectCodes = NS("project_codes"),
            clientNames = NS("client_names"),
            clientManagerNames = NS("client_manager_names"),
            clientManagerEmails = NS("client_manager_emails"),
        };
    }
}

public class SubmitRequest
{
    public string[] TimesheetIds { get; set; } = [];
}

