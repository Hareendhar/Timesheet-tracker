using Npgsql;
using Microsoft.EntityFrameworkCore;
using Serilog;
using TimesheetApi.Data;
using TimesheetApi.Repositories;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, lc) => lc.WriteTo.Console());

    // ── Database ───────────────────────────────────────────────────────────────
    var rawConnectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("DATABASE_URL environment variable is not set");

    var connectionString = ConvertConnectionString(rawConnectionString);

    // Store for repositories that open raw NpgsqlConnections
    builder.Configuration["ConnectionStrings:Default"] = connectionString;

    var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
    // Allow reading unmapped PostgreSQL enum types as their text labels
    dataSourceBuilder.EnableUnmappedTypes();
    var dataSource = dataSourceBuilder.Build();

    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(dataSource)
               .UseSnakeCaseNamingConvention());

    // ── Session ────────────────────────────────────────────────────────────────
    builder.Services.AddDistributedMemoryCache();
    builder.Services.AddSession(options =>
    {
        options.IdleTimeout = TimeSpan.FromHours(24);
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    });

    // ── Repositories ──────────────────────────────────────────────────────────
    builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
    builder.Services.AddScoped<IClientRepository, ClientRepository>();
    builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
    builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
    builder.Services.AddScoped<ITimesheetRepository, TimesheetRepository>();
    builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
    builder.Services.AddScoped<IAuditRepository, AuditRepository>();

    // ── Controllers & JSON ────────────────────────────────────────────────────
    builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            options.JsonSerializerOptions.DefaultIgnoreCondition =
                System.Text.Json.Serialization.JsonIgnoreCondition.Never;
        });

    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
            policy
                .SetIsOriginAllowed(_ => true)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials());
    });

    // ── Port ──────────────────────────────────────────────────────────────────
    var port = Environment.GetEnvironmentVariable("PORT") ?? "3001";
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

    var app = builder.Build();

    app.UseSerilogRequestLogging();
    app.UseCors();
    app.UseSession();
    app.MapControllers();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

static string ConvertConnectionString(string cs)
{
    if (!cs.StartsWith("postgres://") && !cs.StartsWith("postgresql://"))
        return cs;

    var uri = new Uri(cs);
    var user = Uri.UnescapeDataString(uri.UserInfo.Split(':')[0]);
    var pass = uri.UserInfo.Contains(':')
        ? Uri.UnescapeDataString(uri.UserInfo[(uri.UserInfo.IndexOf(':') + 1)..])
        : "";
    var host = uri.Host;
    var portNum = uri.Port > 0 ? uri.Port : 5432;
    var db = uri.AbsolutePath.TrimStart('/');

    var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
    var sslMode = query["sslmode"] ?? "prefer";

    return $"Host={host};Port={portNum};Database={db};Username={user};Password={pass};SSL Mode={sslMode};Trust Server Certificate=true";
}
