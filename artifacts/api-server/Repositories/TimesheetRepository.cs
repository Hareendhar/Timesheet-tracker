using Microsoft.EntityFrameworkCore;
using Npgsql;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Repositories;

public class TimesheetRepository : ITimesheetRepository
{
    private readonly AppDbContext _db;
    private readonly string _connectionString;

    public TimesheetRepository(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _connectionString = configuration["ConnectionStrings:Default"]
            ?? Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? throw new InvalidOperationException("DATABASE_URL not set");
    }

    public async Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? employeeId,
        string? status, string? weekStartDate, string? managerId)
    {
        var offset = (page - 1) * pageSize;
        var conditions = new List<string>();
        var values = new List<object>();
        int idx = 1;

        var baseQuery = "SELECT t.* FROM timesheets t";

        if (!string.IsNullOrEmpty(managerId))
        {
            baseQuery += " JOIN employees e ON t.employee_id = e.id";
            conditions.Add($"e.manager_id = ${idx++}");
            values.Add(managerId);
        }
        if (!string.IsNullOrEmpty(employeeId)) { conditions.Add($"t.employee_id = ${idx++}"); values.Add(employeeId); }
        if (!string.IsNullOrEmpty(status)) { conditions.Add($"t.status::text = ${idx++}"); values.Add(status); }
        if (!string.IsNullOrEmpty(weekStartDate)) { conditions.Add($"t.week_start_date = ${idx++}"); values.Add(weekStartDate); }

        var where = conditions.Count > 0 ? $" WHERE {string.Join(" AND ", conditions)}" : "";
        var valArr = values.ToArray();

        int total;
        var rawRows = new List<Dictionary<string, object?>>();

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        await using (var countCmd = new NpgsqlCommand($"SELECT COUNT(*) FROM ({baseQuery}{where}) sub", conn))
        {
            for (int i = 0; i < valArr.Length; i++) countCmd.Parameters.AddWithValue(valArr[i]);
            total = Convert.ToInt32(await countCmd.ExecuteScalarAsync());
        }

        await using (var rowCmd = new NpgsqlCommand(
            $"{baseQuery}{where} ORDER BY t.week_start_date DESC, t.created_at DESC LIMIT {pageSize} OFFSET {offset}", conn))
        {
            for (int i = 0; i < valArr.Length; i++) rowCmd.Parameters.AddWithValue(valArr[i]);
            await using var reader = await rowCmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                rawRows.Add(ReadTimesheetRow(reader));
        }

        var enriched = await Task.WhenAll(rawRows.Select(r => EnrichTimesheet(r)));
        return new PaginatedResult<object>(enriched.ToList<object>(), total, page, pageSize);
    }

    public async Task<object?> FindById(string id)
    {
        var ts = await _db.Timesheets.FirstOrDefaultAsync(t => t.Id == id);
        if (ts == null) return null;
        return await EnrichTimesheet(TimesheetToDict(ts));
    }

    public async Task<object?> FindByEmployeeAndWeek(string employeeId, string weekStartDate)
    {
        var ts = await _db.Timesheets.FirstOrDefaultAsync(t =>
            t.EmployeeId == employeeId && t.WeekStartDate == weekStartDate);
        if (ts == null) return null;
        return await EnrichTimesheet(TimesheetToDict(ts));
    }

    public async Task<object?> Create(string employeeId, string weekStartDate, List<Dictionary<string, object?>> rows)
    {
        var id = IdGenerator.NewId();
        var now = DateTime.UtcNow;
        var endDate = WeekEndDate(weekStartDate);
        float totalHours = 0;

        _db.Timesheets.Add(new Timesheet
        {
            Id = id, EmployeeId = employeeId, WeekStartDate = weekStartDate,
            WeekEndDate = endDate, Status = "Draft", TotalHours = 0,
            CreatedAt = now, UpdatedAt = now,
        });
        await _db.SaveChangesAsync();

        foreach (var row in rows)
        {
            var total = CalcTotal(row);
            totalHours += total;
            _db.TimesheetRows.Add(BuildRow(IdGenerator.NewId(), id, row, total, now));
        }

        var ts = await _db.Timesheets.FindAsync(id);
        ts!.TotalHours = totalHours;
        ts.UpdatedAt = now;
        await _db.SaveChangesAsync();
        return await FindById(id);
    }

    public async Task<object?> Update(string id, List<Dictionary<string, object?>> rows)
    {
        var ts = await _db.Timesheets.FindAsync(id);
        if (ts == null || (ts.Status != "Draft" && ts.Status != "Rejected")) return null;

        await _db.TimesheetRows.Where(r => r.TimesheetId == id).ExecuteDeleteAsync();

        var now = DateTime.UtcNow;
        float totalHours = 0;
        foreach (var row in rows)
        {
            var total = CalcTotal(row);
            totalHours += total;
            _db.TimesheetRows.Add(BuildRow(IdGenerator.NewId(), id, row, total, now));
        }
        ts.TotalHours = totalHours;
        ts.UpdatedAt = now;
        await _db.SaveChangesAsync();
        return await FindById(id);
    }

    public async Task<object?> Submit(string id)
    {
        await _db.Timesheets.Where(t => t.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, "Submitted")
                .SetProperty(t => t.SubmittedAt, DateTime.UtcNow)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
        return await FindById(id);
    }

    public async Task<object?> Approve(string id, string approvedBy, string? comment)
    {
        await _db.Timesheets.Where(t => t.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, "Approved")
                .SetProperty(t => t.ApprovedAt, DateTime.UtcNow)
                .SetProperty(t => t.ApprovedBy, approvedBy)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
        return await FindById(id);
    }

    public async Task<object?> Reject(string id, string comment)
    {
        await _db.Timesheets.Where(t => t.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, "Rejected")
                .SetProperty(t => t.RejectionComment, comment)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
        return await FindById(id);
    }

    public async Task<(int Processed, int Succeeded, int Failed)> BulkAction(
        List<string> ids, string action, string approvedBy, string? comment)
    {
        int succeeded = 0, failed = 0;
        foreach (var id in ids)
        {
            try
            {
                if (action == "approve") await Approve(id, approvedBy, comment);
                else await Reject(id, comment ?? "Rejected");
                succeeded++;
            }
            catch { failed++; }
        }
        return (ids.Count, succeeded, failed);
    }

    public async Task<object?> CopyFromPreviousWeek(string employeeId, string sourceWeekStartDate, string targetWeekStartDate)
    {
        var source = await FindByEmployeeAndWeek(employeeId, sourceWeekStartDate);
        if (source == null) throw new Exception("Source week not found");

        var existing = await FindByEmployeeAndWeek(employeeId, targetWeekStartDate);
        if (existing != null) return existing;

        dynamic src = source;
        var srcRows = src.rows as IEnumerable<object> ?? Enumerable.Empty<object>();
        var rows = new List<Dictionary<string, object?>>();
        foreach (dynamic r in srcRows)
        {
            rows.Add(new Dictionary<string, object?>
            {
                ["projectId"] = r.projectId,
                ["activityId"] = r.activityId,
                ["monday"] = r.monday,
                ["tuesday"] = r.tuesday,
                ["wednesday"] = r.wednesday,
                ["thursday"] = r.thursday,
                ["friday"] = r.friday,
                ["saturday"] = r.saturday,
                ["sunday"] = r.sunday,
                ["comments"] = r.comments,
                ["mondayStart"] = r.mondayStart,
                ["mondayEnd"] = r.mondayEnd,
                ["tuesdayStart"] = r.tuesdayStart,
                ["tuesdayEnd"] = r.tuesdayEnd,
                ["wednesdayStart"] = r.wednesdayStart,
                ["wednesdayEnd"] = r.wednesdayEnd,
                ["thursdayStart"] = r.thursdayStart,
                ["thursdayEnd"] = r.thursdayEnd,
                ["fridayStart"] = r.fridayStart,
                ["fridayEnd"] = r.fridayEnd,
                ["saturdayStart"] = r.saturdayStart,
                ["saturdayEnd"] = r.saturdayEnd,
                ["sundayStart"] = r.sundayStart,
                ["sundayEnd"] = r.sundayEnd,
            });
        }
        return await Create(employeeId, targetWeekStartDate, rows);
    }

    public async Task<object> GetStatusBreakdown()
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(@"
            SELECT
                COUNT(CASE WHEN status::text = 'Draft' THEN 1 END) as draft,
                COUNT(CASE WHEN status::text = 'Submitted' THEN 1 END) as submitted,
                COUNT(CASE WHEN status::text = 'Approved' THEN 1 END) as approved,
                COUNT(CASE WHEN status::text = 'Rejected' THEN 1 END) as rejected
            FROM timesheets", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return new
            {
                draft = Convert.ToInt32(reader["draft"]),
                submitted = Convert.ToInt32(reader["submitted"]),
                approved = Convert.ToInt32(reader["approved"]),
                rejected = Convert.ToInt32(reader["rejected"]),
            };
        }
        return new { draft = 0, submitted = 0, approved = 0, rejected = 0 };
    }

    public async Task<List<object>> GetRecentActivity(int limit)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($@"
            SELECT t.id as timesheet_id, t.status::text, t.week_start_date, t.updated_at as timestamp, e.name as employee_name
            FROM timesheets t
            JOIN employees e ON t.employee_id = e.id
            ORDER BY t.updated_at DESC
            LIMIT {limit}", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        var results = new List<object>();
        while (await reader.ReadAsync())
        {
            results.Add(new
            {
                id = reader["timesheet_id"]?.ToString(),
                action = reader["status"]?.ToString(),
                employeeName = reader["employee_name"]?.ToString(),
                weekStartDate = reader["week_start_date"]?.ToString(),
                timestamp = reader["timestamp"],
                timesheetId = reader["timesheet_id"]?.ToString(),
            });
        }
        return results;
    }

    public async Task<List<object>> GetComplianceOverview()
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(@"
            SELECT
                e.department,
                COUNT(DISTINCT e.id) as total_employees,
                COUNT(DISTINCT CASE WHEN t.status::text IN ('Submitted','Approved') THEN e.id END) as submitted
            FROM employees e
            LEFT JOIN timesheets t ON e.id = t.employee_id
                AND t.week_start_date >= (CURRENT_DATE - INTERVAL '4 weeks')::text
            WHERE e.status::text = 'Active'
            GROUP BY e.department
            ORDER BY e.department", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        var results = new List<object>();
        while (await reader.ReadAsync())
        {
            var total = Convert.ToInt32(reader["total_employees"]);
            var submitted = Convert.ToInt32(reader["submitted"]);
            results.Add(new
            {
                department = reader["department"]?.ToString(),
                totalEmployees = total,
                submitted,
                complianceRate = total > 0 ? (int)Math.Round((double)submitted / total * 100) : 0,
            });
        }
        return results;
    }

    private async Task<object> EnrichTimesheet(Dictionary<string, object?> ts)
    {
        var tsId = ts["id"]?.ToString() ?? "";
        var employeeId = ts["employeeId"]?.ToString() ?? "";
        var approvedBy = ts["approvedBy"]?.ToString();

        var rows = await _db.TimesheetRows.Where(r => r.TimesheetId == tsId).ToListAsync();
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == employeeId);

        string? approverName = null;
        if (!string.IsNullOrEmpty(approvedBy))
        {
            var approver = await _db.Employees.FirstOrDefaultAsync(e => e.Id == approvedBy);
            approverName = approver?.Name;
        }

        var enrichedRows = await Task.WhenAll(rows.Select(async r =>
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == r.ProjectId);
            var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == r.ActivityId);
            return (object)new
            {
                id = r.Id,
                timesheetId = r.TimesheetId,
                projectId = r.ProjectId,
                projectName = project?.Name,
                activityId = r.ActivityId,
                activityName = activity?.Name,
                monday = r.Monday,
                tuesday = r.Tuesday,
                wednesday = r.Wednesday,
                thursday = r.Thursday,
                friday = r.Friday,
                saturday = r.Saturday,
                sunday = r.Sunday,
                totalHours = r.TotalHours,
                comments = r.Comments,
                mondayStart = r.MondayStart,
                mondayEnd = r.MondayEnd,
                tuesdayStart = r.TuesdayStart,
                tuesdayEnd = r.TuesdayEnd,
                wednesdayStart = r.WednesdayStart,
                wednesdayEnd = r.WednesdayEnd,
                thursdayStart = r.ThursdayStart,
                thursdayEnd = r.ThursdayEnd,
                fridayStart = r.FridayStart,
                fridayEnd = r.FridayEnd,
                saturdayStart = r.SaturdayStart,
                saturdayEnd = r.SaturdayEnd,
                sundayStart = r.SundayStart,
                sundayEnd = r.SundayEnd,
                createdAt = r.CreatedAt,
            };
        }));

        return new
        {
            id = ts["id"],
            employeeId = ts["employeeId"],
            employeeName = employee?.Name,
            weekStartDate = ts["weekStartDate"],
            weekEndDate = ts["weekEndDate"],
            status = ts["status"],
            totalHours = ts["totalHours"],
            submittedAt = ts["submittedAt"],
            approvedAt = ts["approvedAt"],
            approvedBy = ts["approvedBy"],
            approverName,
            rejectionComment = ts["rejectionComment"],
            createdAt = ts["createdAt"],
            updatedAt = ts["updatedAt"],
            rows = enrichedRows,
        };
    }

    private static float CalcTotal(Dictionary<string, object?> row)
    {
        float Get(string key) => row.TryGetValue(key, out var v) ? Convert.ToSingle(v ?? 0f) : 0f;
        return Get("monday") + Get("tuesday") + Get("wednesday") + Get("thursday")
             + Get("friday") + Get("saturday") + Get("sunday");
    }

    private static string WeekEndDate(string weekStartDate)
    {
        var d = DateTime.Parse(weekStartDate).AddDays(6);
        return d.ToString("yyyy-MM-dd");
    }

    private static TimesheetRow BuildRow(string rowId, string timesheetId, Dictionary<string, object?> row, float total, DateTime now)
    {
        float GetF(string key) => row.TryGetValue(key, out var v) ? Convert.ToSingle(v ?? 0f) : 0f;
        string? GetS(string key) => row.TryGetValue(key, out var v) ? v?.ToString() : null;

        return new TimesheetRow
        {
            Id = rowId,
            TimesheetId = timesheetId,
            ProjectId = GetS("projectId") ?? "",
            ActivityId = GetS("activityId") ?? "",
            Monday = GetF("monday"),
            Tuesday = GetF("tuesday"),
            Wednesday = GetF("wednesday"),
            Thursday = GetF("thursday"),
            Friday = GetF("friday"),
            Saturday = GetF("saturday"),
            Sunday = GetF("sunday"),
            TotalHours = total,
            Comments = GetS("comments"),
            MondayStart = GetS("mondayStart"),
            MondayEnd = GetS("mondayEnd"),
            TuesdayStart = GetS("tuesdayStart"),
            TuesdayEnd = GetS("tuesdayEnd"),
            WednesdayStart = GetS("wednesdayStart"),
            WednesdayEnd = GetS("wednesdayEnd"),
            ThursdayStart = GetS("thursdayStart"),
            ThursdayEnd = GetS("thursdayEnd"),
            FridayStart = GetS("fridayStart"),
            FridayEnd = GetS("fridayEnd"),
            SaturdayStart = GetS("saturdayStart"),
            SaturdayEnd = GetS("saturdayEnd"),
            SundayStart = GetS("sundayStart"),
            SundayEnd = GetS("sundayEnd"),
            CreatedAt = now,
        };
    }

    private static Dictionary<string, object?> TimesheetToDict(Timesheet ts) => new()
    {
        ["id"] = ts.Id,
        ["employeeId"] = ts.EmployeeId,
        ["weekStartDate"] = ts.WeekStartDate,
        ["weekEndDate"] = ts.WeekEndDate,
        ["status"] = ts.Status.ToString(),
        ["totalHours"] = ts.TotalHours,
        ["submittedAt"] = ts.SubmittedAt,
        ["approvedAt"] = ts.ApprovedAt,
        ["approvedBy"] = ts.ApprovedBy,
        ["rejectionComment"] = ts.RejectionComment,
        ["createdAt"] = ts.CreatedAt,
        ["updatedAt"] = ts.UpdatedAt,
    };

    private static Dictionary<string, object?> ReadTimesheetRow(NpgsqlDataReader reader)
    {
        object? Get(string col)
        {
            try { return reader[col] is DBNull ? null : reader[col]; } catch { return null; }
        }
        return new()
        {
            ["id"] = Get("id"),
            ["employeeId"] = Get("employee_id"),
            ["weekStartDate"] = Get("week_start_date"),
            ["weekEndDate"] = Get("week_end_date"),
            ["status"] = Get("status")?.ToString(),
            ["totalHours"] = Get("total_hours"),
            ["submittedAt"] = Get("submitted_at"),
            ["approvedAt"] = Get("approved_at"),
            ["approvedBy"] = Get("approved_by"),
            ["rejectionComment"] = Get("rejection_comment"),
            ["createdAt"] = Get("created_at"),
            ["updatedAt"] = Get("updated_at"),
        };
    }
}
