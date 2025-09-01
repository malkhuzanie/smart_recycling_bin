using Microsoft.EntityFrameworkCore;
using SmartRecyclingBin.Data;
using SmartRecyclingBin.Models;
using System.Diagnostics;

namespace SmartRecyclingBin.Services
{
    public class SystemHealthService : ISystemHealthService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SystemHealthService> _logger;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        public SystemHealthService(
            ApplicationDbContext context,
            ILogger<SystemHealthService> logger,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _httpClient = httpClientFactory.CreateClient();
            _configuration = configuration;
        }

        public async Task<SystemHealthMetrics> GetCurrentHealthAsync()
        {
            try
            {
                var metrics = new SystemHealthMetrics
                {
                    Timestamp = DateTime.UtcNow
                };

                // Check Python services health
                var cnnServiceUrl = _configuration["PythonServices:CnnServiceUrl"] ?? "http://localhost:8001";
                var arduinoServiceUrl = _configuration["PythonServices:ArduinoServiceUrl"] ?? "http://localhost:8002";

                metrics.CnnServiceHealthy = await CheckServiceHealthAsync($"{cnnServiceUrl}/health");
                metrics.ArduinoConnected = await CheckServiceHealthAsync($"{arduinoServiceUrl}/health");
                metrics.ExpertSystemHealthy = metrics.CnnServiceHealthy; // Assuming they run together

                // Camera status (would need actual check)
                metrics.CameraConnected = metrics.CnnServiceHealthy;

                // Calculate processing statistics
                var recentClassifications = await _context.ClassificationResults
                    .Where(c => c.Timestamp >= DateTime.UtcNow.AddHours(-1))
                    .ToListAsync();

                metrics.TotalItemsProcessed = await _context.ClassificationResults.CountAsync();
                metrics.AvgProcessingTimeMs = recentClassifications.Count > 0 ? 
                    recentClassifications.Average(c => c.ProcessingTimeMs) : 0;
                metrics.AccuracyRate = recentClassifications.Count > 0 ?
                    recentClassifications.Average(c => c.FinalConfidence) : 0;

                // Classification counts
                metrics.ClassificationCounts = await _context.ClassificationResults
                    .Where(c => c.Timestamp >= DateTime.UtcNow.AddDays(-1))
                    .GroupBy(c => c.FinalClassification)
                    .ToDictionaryAsync(g => g.Key, g => g.Count());

                // System metrics
                var process = Process.GetCurrentProcess();
                metrics.MemoryUsageMB = process.WorkingSet64 / 1024.0 / 1024.0;
                metrics.SystemUptime = (DateTime.UtcNow - process.StartTime).TotalHours;

                // Log the metrics
                await LogHealthMetricsAsync(metrics);

                return metrics;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current health metrics");
                throw;
            }
        }

        public async Task<bool> CheckServiceHealthAsync(string serviceUrl)
        {
            try
            {
                _httpClient.Timeout = TimeSpan.FromSeconds(5);
                var response = await _httpClient.GetAsync(serviceUrl);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Health check failed for service: {serviceUrl}");
                return false;
            }
        }

        public async Task LogHealthMetricsAsync(SystemHealthMetrics metrics)
        {
            try
            {
                _context.HealthMetrics.Add(metrics);
                
                // Keep only last 24 hours of health metrics to prevent database bloat
                var cutoffTime = DateTime.UtcNow.AddHours(-24);
                var oldMetrics = _context.HealthMetrics.Where(m => m.Timestamp < cutoffTime);
                _context.HealthMetrics.RemoveRange(oldMetrics);

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error logging health metrics");
            }
        }

        public async Task<List<SystemAlert>> GetActiveAlertsAsync()
        {
            try
            {
                return await _context.SystemAlerts
                    .Where(a => !a.IsResolved)
                    .OrderByDescending(a => a.Timestamp)
                    .Take(50)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active alerts");
                throw;
            }
        }
    }
}
