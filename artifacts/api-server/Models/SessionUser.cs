using System.Text.Json.Serialization;

namespace TimesheetApi.Models;

public class SessionUser
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("employeeId")]
    public string EmployeeId { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("email")]
    public string Email { get; set; } = "";

    [JsonPropertyName("role")]
    public string Role { get; set; } = "";

    [JsonPropertyName("department")]
    public string? Department { get; set; }

    [JsonPropertyName("designation")]
    public string? Designation { get; set; }

    [JsonPropertyName("managerId")]
    public string? ManagerId { get; set; }

    [JsonPropertyName("avatarUrl")]
    public string? AvatarUrl { get; set; }
}
