using System.Text.Json;
using TimesheetApi.Models;

namespace TimesheetApi.Helpers;

public static class SessionExtensions
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static SessionUser? GetUser(this ISession session)
    {
        var json = session.GetString("user");
        if (string.IsNullOrEmpty(json)) return null;
        return JsonSerializer.Deserialize<SessionUser>(json, _opts);
    }

    public static void SetUser(this ISession session, SessionUser user)
    {
        session.SetString("user", JsonSerializer.Serialize(user, _opts));
    }
}
