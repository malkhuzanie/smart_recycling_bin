using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartRecyclingBin.Data;
using SmartRecyclingBin.Hubs;
using SmartRecyclingBin.Services;
using System.Text.Json;
using Serilog;
using SmartRecyclingBin.Middleware;
using SmartRecyclingBin.Models;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog for better logging
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/smart-recycling-bin-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                           ?? "Data Source=../data/smartbin.db";
    options.UseSqlite(connectionString);

    // Enable sensitive data logging in development
    if (builder.Environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();
        options.EnableDetailedErrors();
    }
});

// Configure JSON serialization
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.WriteIndented = true;
        options.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// Configure SignalR with better options
builder.Services.AddSignalR(options =>
    {
        options.EnableDetailedErrors = builder.Environment.IsDevelopment();
        options.KeepAliveInterval = TimeSpan.FromSeconds(15);
        options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
        options.MaximumReceiveMessageSize = 2 * 1024 * 1024;
    })
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

// Add API documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "Smart Recycling Bin API",
        Version = "v1",
        Description = "API for Smart Recycling Bin system with real-time classification and monitoring",
        Contact = new() { Name = "Smart Recycling Bin Team" }
    });

    // Add SignalR hubs to documentation
    c.EnableAnnotations();
});

// Configure CORS with more specific settings
// builder.Services.AddCors(options =>
// {
//     var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ??
//     [
//         "http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "https://localhost:3000"
//     ];
// 
//     options.AddDefaultPolicy(policy =>
//     {
//         policy.WithOrigins(allowedOrigins)
//             .AllowAnyHeader()
//             .AllowAnyMethod()
//             .AllowCredentials();
//     });
// });

builder.Services.AddCors(options => options.AddPolicy("CorsPolicy",
    builder =>
    {
        builder.AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed((host) => true)
            .AllowCredentials();
    }));


// Register custom services with proper DI scoping
builder.Services.AddScoped<IClassificationService, ClassificationService>();
builder.Services.AddScoped<IOverrideService, OverrideService>();
builder.Services.AddScoped<ISystemHealthService, SystemHealthService>();
builder.Services.AddSingleton<INotificationService, NotificationService>();

// Add HTTP client for external service calls
builder.Services.AddHttpClient("PythonServices", client => { client.Timeout = TimeSpan.FromSeconds(10); });

// Add health checks
builder.Services.AddHealthChecks()
    // .AddDbContext<ApplicationDbContext>()
    .AddCheck<SystemHealthCheck>("system-health");

// Add memory cache for performance
builder.Services.AddMemoryCache();

// Add configuration validation
builder.Services.AddOptions<ApplicationSettings>()
    .Bind(builder.Configuration.GetSection("ApplicationSettings"))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Add logging with more detailed configuration
builder.Services.AddLogging(logging =>
{
    logging.ClearProviders();
    logging.AddSerilog();
    logging.SetMinimumLevel(LogLevel.Information);
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Smart Recycling Bin API V1");
        c.RoutePrefix = "swagger";
        c.EnableDeepLinking();
        c.DisplayRequestDuration();
    });
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

// Add custom middleware
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<ErrorHandlingMiddleware>();

// Standard pipeline
app.UseHttpsRedirection();
app.UseRouting();

// Use the appropriate CORS policy
app.UseCors("CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

// Map controllers and hubs
app.MapControllers();
app.MapHub<ClassificationHub>("/hubs/classification");
app.MapHub<DashboardHub>("/hubs/dashboard");
app.MapHub<SystemHealthHub>("/hubs/systemhealth"); 

// Map health checks
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new()
{
    Predicate = check => check.Tags.Contains("ready")
});
app.MapHealthChecks("/health/live", new()
{
    Predicate = _ => false
});

// Enhanced health check endpoint with detailed information
app.MapGet("/api/health/detailed", async (ISystemHealthService healthService) =>
{
    try
    {
        var health = await healthService.GetCurrentHealthAsync();
        return Results.Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            service = "Smart Recycling Bin Backend",
            version = "1.0.0",
            environment = app.Environment.EnvironmentName,
            metrics = health
        });
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Health check failed");
        return Results.Problem("Health check failed");
    }
});

// Ensure database is created and seeded
using (var scope = app.Services.CreateScope())
{
    try
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

        await context.Database.EnsureCreatedAsync();

        // Seed initial data if needed
        if (!await context.ClassificationResults.AnyAsync())
        {
            // SeedInitialData(context); // This function was empty, ensure it's implemented if needed
        }

        logger.LogInformation("Database initialized successfully");
    }
    catch (Exception ex)
    {
        Log.Fatal(ex, "Database initialization failed");
        throw;
    }
}

Log.Information("Smart Recycling Bin Backend starting up...");

try
{
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