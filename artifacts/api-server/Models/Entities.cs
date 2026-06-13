namespace TimesheetApi.Models;

public class Employee
{
    public string Id { get; set; } = "";
    public string EmployeeId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Department { get; set; } = "";
    public string Designation { get; set; } = "";
    public string Role { get; set; } = "Employee";
    public string? ManagerId { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Client
{
    public string Id { get; set; } = "";
    public string ClientCode { get; set; } = "";
    public string Name { get; set; } = "";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Project
{
    public string Id { get; set; } = "";
    public string ProjectCode { get; set; } = "";
    public string Name { get; set; } = "";
    public string ClientId { get; set; } = "";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Activity
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
}

public class Timesheet
{
    public string Id { get; set; } = "";
    public string EmployeeId { get; set; } = "";
    public string WeekStartDate { get; set; } = "";
    public string WeekEndDate { get; set; } = "";
    public string Status { get; set; } = "Draft";
    public float TotalHours { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public string? RejectionComment { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TimesheetRow
{
    public string Id { get; set; } = "";
    public string TimesheetId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string ActivityId { get; set; } = "";
    public float Monday { get; set; }
    public float Tuesday { get; set; }
    public float Wednesday { get; set; }
    public float Thursday { get; set; }
    public float Friday { get; set; }
    public float Saturday { get; set; }
    public float Sunday { get; set; }
    public float TotalHours { get; set; }
    public string? Comments { get; set; }
    public string? MondayStart { get; set; }
    public string? MondayEnd { get; set; }
    public string? TuesdayStart { get; set; }
    public string? TuesdayEnd { get; set; }
    public string? WednesdayStart { get; set; }
    public string? WednesdayEnd { get; set; }
    public string? ThursdayStart { get; set; }
    public string? ThursdayEnd { get; set; }
    public string? FridayStart { get; set; }
    public string? FridayEnd { get; set; }
    public string? SaturdayStart { get; set; }
    public string? SaturdayEnd { get; set; }
    public string? SundayStart { get; set; }
    public string? SundayEnd { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Notification
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public bool IsRead { get; set; }
    public string? RelatedId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AuditLog
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string? UserName { get; set; }
    public string Role { get; set; } = "";
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}
