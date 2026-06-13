namespace TimesheetApi.Helpers;

public static class ClientIpHelper
{
    public static string GetClientIp(HttpRequest request)
    {
        var forwarded = request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwarded))
            return forwarded.Split(',')[0].Trim();
        return request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
