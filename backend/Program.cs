using System.Text;
using LogiTrack.Data;
using LogiTrack.Models;
using LogiTrack.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
var builder = WebApplication.CreateBuilder(args);
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Set Jwt__Key environment variable to a random secret of at least 32 bytes.");
builder.Services.AddDbContext<LogiTrackContext>(options => options.UseSqlite(
    LogiTrackContextFactory.ResolveConnectionString(builder.Configuration.GetConnectionString("DefaultConnection"), builder.Environment.ContentRootPath)));
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequiredLength = 12;
    options.Password.RequireNonAlphanumeric = true;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.User.RequireUniqueEmail = true;
}).AddEntityFrameworkStores<LogiTrackContext>().AddDefaultTokenProviders();
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true, ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        RequireSignedTokens = true, RequireExpirationTime = true,
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30)
    };
});
builder.Services.AddAuthorization();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var app = builder.Build();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
if (!app.Environment.IsDevelopment()) { app.UseHsts(); app.UseHttpsRedirection(); }
app.UseExceptionHandler(handler => handler.Run(async context =>
{
    context.Response.StatusCode = 500;
    await context.Response.WriteAsJsonAsync(new { error = "An unexpected server error occurred. Please retry the operation." });
}));
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
// Development convenience: migrate database and provision an initial manager only with explicit environment credentials.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LogiTrackContext>();
    await db.Database.MigrateAsync();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    if (!await roleManager.RoleExistsAsync("Manager")) await roleManager.CreateAsync(new IdentityRole("Manager"));
    var managerEmail = builder.Configuration["Bootstrap:ManagerEmail"];
    var managerPassword = builder.Configuration["Bootstrap:ManagerPassword"];
    if (!string.IsNullOrWhiteSpace(managerEmail) && !string.IsNullOrWhiteSpace(managerPassword))
    {
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(managerEmail);
        if (user is null)
        {
            user = new ApplicationUser { UserName = managerEmail, Email = managerEmail, EmailConfirmed = true };
            var result = await userManager.CreateAsync(user, managerPassword);
            if (!result.Succeeded) throw new InvalidOperationException("Bootstrap manager failed: " + string.Join(", ", result.Errors.Select(e => e.Description)));
        }
        if (!await userManager.IsInRoleAsync(user, "Manager"))
        {
            // Do not elevate an existing account solely because its email matches bootstrap configuration.
            if (!await userManager.CheckPasswordAsync(user, managerPassword))
                throw new InvalidOperationException("Bootstrap account requires verified credentials before role assignment.");
            var roleResult = await userManager.AddToRoleAsync(user, "Manager");
            if (!roleResult.Succeeded) throw new InvalidOperationException("Bootstrap role assignment failed.");
        }
    }
}
app.Run();
