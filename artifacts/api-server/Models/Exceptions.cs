namespace TimesheetApi.Models;

public class InvalidTransitionException : Exception
{
    public string CurrentStatus { get; }

    public InvalidTransitionException(string currentStatus, string attempted)
        : base($"Cannot perform '{attempted}' on a timesheet in '{currentStatus}' status")
    {
        CurrentStatus = currentStatus;
    }
}
