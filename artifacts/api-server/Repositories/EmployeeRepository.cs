using Microsoft.EntityFrameworkCore;
using Npgsql;
using TimesheetApi.Data;
using TimesheetApi.Helpers;
using TimesheetApi.Models;

namespace TimesheetApi.Repositories;

public class EmployeeRepository : IEmployeeRepository
{
    private readonly AppDbContext _db;
    private readonly string _cs;

    public EmployeeRepository(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cs = cfg["ConnectionStrings:Default"]!;
    }

    public async Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? search,
        string? role, string? status, string? department, string? managerId)
    {
        var offset = (page - 1) * pageSize;
        var conditions = new List<string>();
        var values = new List<object>();
        int idx = 1;

        if (!string.IsNullOrEmpty(search))
        {
            conditions.Add($"(e.name ILIKE ${idx} OR e.email ILIKE ${idx} OR e.employee_id ILIKE ${idx})");
            values.Add($"%{search}%"); idx++;
        }
        if (!string.IsNullOrEmpty(role))
        {
            conditions.Add($"e.role::text = ${idx++}");
            values.Add(role);
        }
        if (!string.IsNullOrEmpty(status))
        {
            conditions.Add($"e.status::text = ${idx++}");
            values.Add(status);
        }
        if (!string.IsNullOrEmpty(department))
        {
            conditions.Add($"e.department ILIKE ${idx++}");
            values.Add($"%{department}%");
        }
        if (!string.IsNullOrEmpty(managerId))
        {
            conditions.Add($"e.manager_id = ${idx++}");
            values.Add(managerId);
        }

        var where = conditions.Count > 0 ? " WHERE " + string.Join(" AND ", conditions) : "";
        var baseQ = "SELECT e.*, m.name as manager_name FROM employees e LEFT JOIN employees m ON e.manager_id = m.id";

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();

        int total;
        await using (var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM ({baseQ}{where}) sub", conn))
        {
            foreach (var v in values) cmd.Parameters.AddWithValue(v);
            total = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        var rows = new List<object>();
        await using (var cmd = new NpgsqlCommand($"{baseQ}{where} ORDER BY e.name LIMIT {pageSize} OFFSET {offset}", conn))
        {
            foreach (var v in values) cmd.Parameters.AddWithValue(v);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                rows.Add(ReadRow(reader));
        }

        return new PaginatedResult<object>(rows, total, page, pageSize);
    }

    public async Task<object?> FindById(string id)
    {
        var e = await _db.Employees.FirstOrDefaultAsync(x => x.Id == id);
        if (e == null) return null;
        return await EnrichSingle(e);
    }

    public async Task<object?> FindByEmail(string email)
    {
        var e = await _db.Employees.FirstOrDefaultAsync(x => x.Email == email);
        if (e == null) return null;
        return await EnrichSingle(e);
    }

    public async Task<object?> FindByEmployeeId(string employeeId)
    {
        var e = await _db.Employees.FirstOrDefaultAsync(x => x.EmployeeId == employeeId);
        if (e == null) return null;
        return await EnrichSingle(e);
    }

    public async Task<object?> Create(Dictionary<string, object?> data)
    {
        var now = DateTime.UtcNow;
        var e = new Employee
        {
            Id = IdGenerator.NewId(),
            EmployeeId = Get(data, "employeeId"),
            Name = Get(data, "name"),
            Email = Get(data, "email"),
            Department = Get(data, "department"),
            Designation = Get(data, "designation"),
            Role = GetValidEnum(data, "role", new[] { "Employee", "Manager", "Admin" }, "Employee"),
            ManagerId = data.TryGetValue("managerId", out var mgr) ? mgr?.ToString() : null,
            Status = GetValidEnum(data, "status", new[] { "Active", "Inactive" }, "Active"),
            CreatedAt = now,
            UpdatedAt = now,
        };

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO employees (id, employee_id, name, email, department, designation, role, manager_id, status, created_at, updated_at) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7::employee_role, $8, $9::employee_status, $10, $11)", conn);
        cmd.Parameters.AddWithValue(e.Id);
        cmd.Parameters.AddWithValue(e.EmployeeId);
        cmd.Parameters.AddWithValue(e.Name);
        cmd.Parameters.AddWithValue(e.Email);
        cmd.Parameters.AddWithValue(e.Department);
        cmd.Parameters.AddWithValue(e.Designation);
        cmd.Parameters.AddWithValue(e.Role);
        cmd.Parameters.AddWithValue((object?)e.ManagerId ?? DBNull.Value);
        cmd.Parameters.AddWithValue(e.Status);
        cmd.Parameters.AddWithValue(e.CreatedAt);
        cmd.Parameters.AddWithValue(e.UpdatedAt);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(e.Id);
    }

    public async Task<object?> Update(string id, Dictionary<string, object?> data)
    {
        var e = await _db.Employees.FirstOrDefaultAsync(x => x.Id == id);
        if (e == null) return null;
        if (data.TryGetValue("employeeId", out var eid) && eid != null) e.EmployeeId = eid.ToString()!;
        if (data.TryGetValue("name", out var n) && n != null) e.Name = n.ToString()!;
        if (data.TryGetValue("email", out var em) && em != null) e.Email = em.ToString()!;
        if (data.TryGetValue("department", out var dep) && dep != null) e.Department = dep.ToString()!;
        if (data.TryGetValue("designation", out var des) && des != null) e.Designation = des.ToString()!;
        if (data.TryGetValue("role", out var r) && r != null)
            e.Role = GetValidEnum(data, "role", new[] { "Employee", "Manager", "Admin" }, e.Role);
        if (data.TryGetValue("status", out var s) && s != null)
            e.Status = GetValidEnum(data, "status", new[] { "Active", "Inactive" }, e.Status);
        if (data.ContainsKey("managerId")) e.ManagerId = data["managerId"]?.ToString();
        e.UpdatedAt = DateTime.UtcNow;

        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE employees SET employee_id=$1, name=$2, email=$3, department=$4, designation=$5, " +
            "role=$6::employee_role, manager_id=$7, status=$8::employee_status, updated_at=$9 WHERE id=$10", conn);
        cmd.Parameters.AddWithValue(e.EmployeeId);
        cmd.Parameters.AddWithValue(e.Name);
        cmd.Parameters.AddWithValue(e.Email);
        cmd.Parameters.AddWithValue(e.Department);
        cmd.Parameters.AddWithValue(e.Designation);
        cmd.Parameters.AddWithValue(e.Role);
        cmd.Parameters.AddWithValue((object?)e.ManagerId ?? DBNull.Value);
        cmd.Parameters.AddWithValue(e.Status);
        cmd.Parameters.AddWithValue(e.UpdatedAt);
        cmd.Parameters.AddWithValue(id);
        await cmd.ExecuteNonQueryAsync();

        return await FindById(id);
    }

    public async Task<bool> Delete(string id)
    {
        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE employees SET status='Inactive'::employee_status, updated_at=$1 WHERE id=$2", conn);
        cmd.Parameters.AddWithValue(DateTime.UtcNow);
        cmd.Parameters.AddWithValue(id);
        var rows = await cmd.ExecuteNonQueryAsync();
        return rows > 0;
    }

    public async Task<(List<object> Success, List<object> Errors)> BulkCreate(List<Dictionary<string, object?>> rows)
    {
        var success = new List<object>();
        var errors = new List<object>();

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            try
            {
                var empId = Get(row, "employeeId");
                var name = Get(row, "name");
                var email = Get(row, "email");
                var role = Get(row, "role");
                var status = Get(row, "status");

                if (string.IsNullOrEmpty(empId)) throw new Exception("Missing Employee ID");
                if (string.IsNullOrEmpty(name)) throw new Exception("Missing Name");
                if (string.IsNullOrEmpty(email)) throw new Exception("Missing Email");
                if (!new[] { "Employee", "Manager", "Admin" }.Contains(role)) throw new Exception($"Invalid role: {role}");
                if (!new[] { "Active", "Inactive" }.Contains(status)) throw new Exception($"Invalid status: {status}");

                var existing = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == empId);
                if (existing != null) throw new Exception($"Duplicate Employee ID: {empId}");

                var existingEmail = await _db.Employees.FirstOrDefaultAsync(e => e.Email == email);
                if (existingEmail != null) throw new Exception($"Duplicate Email: {email}");

                string? resolvedManagerId = null;
                if (row.TryGetValue("managerId", out var mgrVal) && mgrVal != null)
                {
                    var mgr = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeId == mgrVal.ToString());
                    if (mgr == null) throw new Exception($"Manager not found: {mgrVal}");
                    resolvedManagerId = mgr.Id;
                }

                row["managerId"] = resolvedManagerId;
                var created = await Create(row);
                success.Add(created!);
            }
            catch (Exception ex)
            {
                errors.Add(new { row = i + 1, field = "unknown", message = ex.Message });
            }
        }

        return (success, errors);
    }

    public async Task<object?> GetProfile(string id)
    {
        var employee = await FindById(id);
        if (employee == null) return null;

        var metrics = await _db.Database.SqlQueryRaw<MetricsRow>(@"
            SELECT
                COUNT(*)::int as total_submitted,
                COUNT(CASE WHEN status::text = 'Approved' THEN 1 END)::int as approved,
                COUNT(CASE WHEN status::text IN ('Draft', 'Submitted') THEN 1 END)::int as pending,
                COUNT(CASE WHEN status::text = 'Rejected' THEN 1 END)::int as rejected
            FROM timesheets WHERE employee_id = {0}", id).ToListAsync();

        var m = metrics.FirstOrDefault() ?? new MetricsRow();
        var approvalRate = m.TotalSubmitted > 0 ? (int)Math.Round((double)m.Approved / m.TotalSubmitted * 100) : 0;

        return new
        {
            employee,
            metrics = new
            {
                totalSubmitted = m.TotalSubmitted,
                pending = m.Pending,
                rejected = m.Rejected,
                approved = m.Approved,
                approvalRate,
            }
        };
    }

    public async Task<object?> GetDirectReports(string managerId)
    {
        var manager = await FindById(managerId);
        if (manager == null) return null;

        var reports = await _db.Employees.Where(e => e.ManagerId == managerId).ToListAsync();

        var directReports = new List<object>();
        foreach (var emp in reports)
        {
            var stats = await _db.Database.SqlQueryRaw<DirectReportStats>(@"
                SELECT
                    COUNT(CASE WHEN status::text IN ('Submitted','Approved','Rejected') THEN 1 END)::int as submitted,
                    COUNT(CASE WHEN status::text = 'Approved' THEN 1 END)::int as approved,
                    COUNT(CASE WHEN status::text = 'Rejected' THEN 1 END)::int as rejected
                FROM timesheets WHERE employee_id = {0}", emp.Id).ToListAsync();

            var s = stats.FirstOrDefault() ?? new DirectReportStats();
            directReports.Add(new
            {
                employee = ToObjWithManager(emp, (manager as dynamic)?.name as string),
                submitted = s.Submitted,
                approved = s.Approved,
                rejected = s.Rejected,
            });
        }

        var mmResult = await _db.Database.SqlQueryRaw<ManagerMetrics>(@"
            SELECT
                COUNT(CASE WHEN status::text = 'Approved' THEN 1 END)::int as approved,
                COUNT(CASE WHEN status::text = 'Rejected' THEN 1 END)::int as rejected,
                COUNT(CASE WHEN status::text = 'Submitted' THEN 1 END)::int as pending_approvals
            FROM timesheets
            WHERE employee_id IN (SELECT id FROM employees WHERE manager_id = {0})", managerId).ToListAsync();

        var mm = mmResult.FirstOrDefault() ?? new ManagerMetrics();
        return new
        {
            manager,
            metrics = new
            {
                totalReports = reports.Count,
                approved = mm.Approved,
                rejected = mm.Rejected,
                pendingApprovals = mm.PendingApprovals,
            },
            directReports,
        };
    }

    private async Task<object> EnrichSingle(Employee e)
    {
        string? managerName = null;
        if (e.ManagerId != null)
        {
            var mgr = await _db.Employees.FirstOrDefaultAsync(x => x.Id == e.ManagerId);
            managerName = mgr?.Name;
        }
        return ToObj(e, managerName);
    }

    private static object ReadRow(Npgsql.NpgsqlDataReader r) => new
    {
        id = r.GetString(r.GetOrdinal("id")),
        employeeId = r.GetString(r.GetOrdinal("employee_id")),
        name = r.GetString(r.GetOrdinal("name")),
        email = r.GetString(r.GetOrdinal("email")),
        department = r.GetString(r.GetOrdinal("department")),
        designation = r.GetString(r.GetOrdinal("designation")),
        role = r.GetString(r.GetOrdinal("role")),
        managerId = r.IsDBNull(r.GetOrdinal("manager_id")) ? null : r.GetString(r.GetOrdinal("manager_id")),
        managerName = r.IsDBNull(r.GetOrdinal("manager_name")) ? null : r.GetString(r.GetOrdinal("manager_name")),
        status = r.GetString(r.GetOrdinal("status")),
        createdAt = r.GetDateTime(r.GetOrdinal("created_at")),
        updatedAt = r.GetDateTime(r.GetOrdinal("updated_at")),
    };

    private static string Get(Dictionary<string, object?> d, string key) =>
        d.TryGetValue(key, out var v) ? v?.ToString() ?? "" : "";

    private static string GetValidEnum(Dictionary<string, object?> data, string key, string[] valid, string def)
    {
        if (data.TryGetValue(key, out var v) && v != null && valid.Contains(v.ToString())) return v.ToString()!;
        return def;
    }

    private static object ToObj(Employee e, string? managerName) => new
    {
        id = e.Id,
        employeeId = e.EmployeeId,
        name = e.Name,
        email = e.Email,
        department = e.Department,
        designation = e.Designation,
        role = e.Role,
        managerId = e.ManagerId,
        managerName,
        status = e.Status,
        createdAt = e.CreatedAt,
        updatedAt = e.UpdatedAt,
    };

    private static object ToObjWithManager(Employee e, string? managerName) => ToObj(e, managerName);
}

file class MetricsRow
{
    public int TotalSubmitted { get; set; }
    public int Approved { get; set; }
    public int Pending { get; set; }
    public int Rejected { get; set; }
}

file class DirectReportStats
{
    public int Submitted { get; set; }
    public int Approved { get; set; }
    public int Rejected { get; set; }
}

file class ManagerMetrics
{
    public int Approved { get; set; }
    public int Rejected { get; set; }
    public int PendingApprovals { get; set; }
}
