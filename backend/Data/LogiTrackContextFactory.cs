using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace LogiTrack.Data;
public class LogiTrackContextFactory : IDesignTimeDbContextFactory<LogiTrackContext>
{
    public LogiTrackContext CreateDbContext(string[] args)
    {
        // Locate the moved project independently of the directory used to invoke dotnet ef.
        var directory = new DirectoryInfo(Path.GetDirectoryName(typeof(LogiTrackContextFactory).Assembly.Location)!);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "LogiTrack.csproj")))
            directory = directory.Parent;
        if (directory is null) throw new InvalidOperationException("Cannot locate the backend project for EF design-time database resolution.");
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ?? "Data Source=logitrack.db";
        var options = new DbContextOptionsBuilder<LogiTrackContext>()
            .UseSqlite(ResolveConnectionString(connectionString, directory.FullName)).Options;
        return new LogiTrackContext(options);
    }
    internal static string ResolveConnectionString(string? connectionString, string backendDirectory)
    {
        var connection = new SqliteConnectionStringBuilder(connectionString);
        // Preserve the original project-root database. Absolute test/deployment overrides remain absolute.
        if (!string.IsNullOrEmpty(connection.DataSource) && connection.DataSource != ":memory:" && !Path.IsPathRooted(connection.DataSource))
            connection.DataSource = Path.GetFullPath(connection.DataSource, Path.GetFullPath("..", backendDirectory));
        return connection.ToString();
    }
}
