using Microsoft.AspNetCore.Mvc;
using SmartRecyclingBin.Models.DTOs;
using SmartRecyclingBin.Services;

namespace SmartRecyclingBin.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly IClassificationService _classificationService;
        private readonly ISystemHealthService _healthService;
        private readonly INotificationService _notificationService;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(
            IClassificationService classificationService,
            ISystemHealthService healthService,
            INotificationService notificationService,
            ILogger<DashboardController> logger)
        {
            _classificationService = classificationService;
            _healthService = healthService;
            _notificationService = notificationService;
            _logger = logger;
        }

        /// <summary>
        /// Get comprehensive dashboard statistics
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult<DashboardStatsDto>> GetDashboardStats()
        {
            try
            {
                var healthMetrics = await _healthService.GetCurrentHealthAsync();
                var statistics = await _classificationService.GetStatisticsAsync(DateTime.Today);
                var recentClassifications = await _classificationService.GetRecentClassificationsAsync(1, 10);
                var activeAlerts = await _healthService.GetActiveAlertsAsync();

                var dashboardStats = new DashboardStatsDto
                {
                    SystemStatus = new SystemStatusDto
                    {
                        CameraConnected = healthMetrics.CameraConnected,
                        ArduinoConnected = healthMetrics.ArduinoConnected,
                        CnnServiceHealthy = healthMetrics.CnnServiceHealthy,
                        ExpertSystemHealthy = healthMetrics.ExpertSystemHealthy,
                        LastHealthCheck = DateTime.UtcNow
                    },
                    ProcessingStats = new ProcessingStatsDto
                    {
                        TotalItemsToday = statistics.ItemsToday,
                        AverageAccuracy = statistics.AccuracyRate,
                        AverageProcessingTime = statistics.AvgProcessingTime,
                        OverrideRate = statistics.OverrideRate,
                        ClassificationBreakdown = statistics.ClassificationBreakdown
                    },
                    RecentActivity = recentClassifications.Items.Select(c => new RecentActivityDto
                    {
                        Timestamp = c.Timestamp,
                        Classification = c.FinalClassification,
                        DisposalLocation = c.DisposalLocation,
                        Confidence = c.FinalConfidence,
                        IsOverridden = c.IsOverridden
                    }).ToList(),
                    Alerts = new AlertSummaryDto
                    {
                        TotalActiveAlerts = activeAlerts.Count,
                        CriticalAlerts = activeAlerts.Count(a => a.Severity == "CRITICAL"),
                        WarningAlerts = activeAlerts.Count(a => a.Severity == "WARNING"),
                        InfoAlerts = activeAlerts.Count(a => a.Severity == "INFO"),
                        RecentAlerts = activeAlerts.Take(5).ToList()
                    }
                };

                return Ok(dashboardStats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving dashboard statistics");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get real-time system status
        /// </summary>
        [HttpGet("status")]
        public async Task<ActionResult<SystemStatusDto>> GetSystemStatus()
        {
            try
            {
                var healthMetrics = await _healthService.GetCurrentHealthAsync();
                
                var status = new SystemStatusDto
                {
                    CameraConnected = healthMetrics.CameraConnected,
                    ArduinoConnected = healthMetrics.ArduinoConnected,
                    CnnServiceHealthy = healthMetrics.CnnServiceHealthy,
                    ExpertSystemHealthy = healthMetrics.ExpertSystemHealthy,
                    LastHealthCheck = DateTime.UtcNow
                };

                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving system status");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get processing performance metrics
        /// </summary>
        [HttpGet("performance")]
        public async Task<ActionResult<object>> GetPerformanceMetrics([FromQuery] int hours = 24)
        {
            try
            {
                var fromDate = DateTime.UtcNow.AddHours(-hours);
                var statistics = await _classificationService.GetStatisticsAsync(fromDate);

                var performanceMetrics = new
                {
                    TotalProcessed = statistics.TotalItems,
                    AverageAccuracy = statistics.AccuracyRate,
                    AverageProcessingTime = statistics.AvgProcessingTime,
                    ThroughputPerHour = statistics.TotalItems / (double)hours,
                    OverrideRate = statistics.OverrideRate,
                    HourlyBreakdown = statistics.HourlyBreakdown.Select(h => new
                    {
                        Hour = h.Hour.ToString("yyyy-MM-dd HH:00"),
                        Count = h.Count,
                        Accuracy = h.AvgAccuracy
                    })
                };

                return Ok(performanceMetrics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving performance metrics");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}
