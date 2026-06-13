using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TimesheetApi.Helpers;

namespace TimesheetApi.Middleware;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequireAuthAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.Session.GetUser();
        if (user == null)
        {
            context.Result = new JsonResult(new { error = "Not authenticated" }) { StatusCode = 401 };
        }
    }
}

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequireRoleAttribute : Attribute, IAuthorizationFilter
{
    private readonly string[] _roles;

    public RequireRoleAttribute(params string[] roles)
    {
        _roles = roles;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.Session.GetUser();
        if (user == null)
        {
            context.Result = new JsonResult(new { error = "Not authenticated" }) { StatusCode = 401 };
            return;
        }
        if (!_roles.Contains(user.Role))
        {
            context.Result = new JsonResult(new { error = "Forbidden" }) { StatusCode = 403 };
        }
    }
}
