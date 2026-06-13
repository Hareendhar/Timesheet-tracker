using Microsoft.EntityFrameworkCore;
using TimesheetApi.Models;

namespace TimesheetApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Timesheet> Timesheets => Set<Timesheet>();
    public DbSet<TimesheetRow> TimesheetRows => Set<TimesheetRow>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.ToTable("employees");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Role).HasColumnType("text");
            entity.Property(e => e.Status).HasColumnType("text");
        });

        modelBuilder.Entity<Client>(entity =>
        {
            entity.ToTable("clients");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasColumnType("text");
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("projects");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasColumnType("text");
        });

        modelBuilder.Entity<Activity>(entity =>
        {
            entity.ToTable("activities");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasColumnType("text");
        });

        modelBuilder.Entity<Timesheet>(entity =>
        {
            entity.ToTable("timesheets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasColumnType("text");
        });

        modelBuilder.Entity<TimesheetRow>(entity =>
        {
            entity.ToTable("timesheet_rows");
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.ToTable("notifications");
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(e => e.Id);
        });
    }
}
