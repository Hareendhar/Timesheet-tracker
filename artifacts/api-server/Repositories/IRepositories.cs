namespace TimesheetApi.Repositories;

public record PaginatedResult<T>(List<T> Data, int Total, int Page, int PageSize);

public interface IEmployeeRepository
{
    Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? search, string? role, string? status, string? department, string? managerId);
    Task<object?> FindById(string id);
    Task<object?> FindByEmail(string email);
    Task<object?> FindByEmployeeId(string employeeId);
    Task<object?> Create(Dictionary<string, object?> data);
    Task<object?> Update(string id, Dictionary<string, object?> data);
    Task<bool> Delete(string id);
    Task<(List<object> Success, List<object> Errors)> BulkCreate(List<Dictionary<string, object?>> rows);
    Task<object?> GetProfile(string id);
    Task<object?> GetDirectReports(string managerId);
}

public interface IClientRepository
{
    Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? status, string? search);
    Task<object?> FindById(string id);
    Task<object?> Create(Dictionary<string, object?> data);
    Task<object?> Update(string id, Dictionary<string, object?> data);
    Task<bool> Delete(string id);
}

public interface IProjectRepository
{
    Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? status, string? clientId, string? search);
    Task<object?> FindById(string id);
    Task<object?> Create(Dictionary<string, object?> data);
    Task<object?> Update(string id, Dictionary<string, object?> data);
    Task<bool> Delete(string id);
}

public interface IActivityRepository
{
    Task<List<object>> FindAll();
    Task<object?> FindById(string id);
    Task<object?> Create(Dictionary<string, object?> data);
    Task<object?> Update(string id, Dictionary<string, object?> data);
    Task<bool> Delete(string id);
}

public interface ITimesheetRepository
{
    Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? employeeId, string? status, string? weekStartDate, string? managerId);
    Task<object?> FindById(string id);
    Task<object?> FindByEmployeeAndWeek(string employeeId, string weekStartDate);
    Task<object?> Create(string employeeId, string weekStartDate, List<Dictionary<string, object?>> rows);
    Task<object?> Update(string id, List<Dictionary<string, object?>> rows);
    Task<object?> Submit(string id);
    Task<object?> Approve(string id, string approvedBy, string? comment);
    Task<object?> Reject(string id, string comment);
    Task<(int Processed, int Succeeded, int Failed)> BulkAction(List<string> ids, string action, string approvedBy, string? comment);
    Task<object?> CopyFromPreviousWeek(string employeeId, string sourceWeekStartDate, string targetWeekStartDate);
    Task<object> GetStatusBreakdown();
    Task<List<object>> GetRecentActivity(int limit);
    Task<List<object>> GetComplianceOverview();
}

public interface INotificationRepository
{
    Task<(List<object> Data, int Total, int Page, int PageSize, int UnreadCount)> FindAll(string userId, bool unreadOnly, int page, int pageSize);
    Task<string> Create(Dictionary<string, object?> data);
    Task<bool> MarkRead(string id, string userId);
    Task MarkAllRead(string userId);
}

public interface IAuditRepository
{
    Task<PaginatedResult<object>> FindAll(int page, int pageSize, string? userId, string? action, string? role, string? dateFrom, string? dateTo);
    Task<string> Create(Dictionary<string, object?> data);
    Task<List<object>> FindAllExport(string? dateFrom, string? dateTo);
}
