namespace TimesheetApi.Helpers;

public static class IdGenerator
{
    public static string NewId() => Guid.NewGuid().ToString();
}
