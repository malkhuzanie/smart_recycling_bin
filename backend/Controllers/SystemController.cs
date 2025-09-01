using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SmartRecyclingBin.Models;
using SmartRecyclingBin.Services;

namespace SmartRecyclingBin.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SystemController : ControllerBase
    {
        private readonly ISystemHealthService _healthService;
        private readonly INotificationService _notificationService;
        private readonly ILogger<SystemController> _logger;

        public SystemController(
            ISystemHealthService healthService,
            INotificationService notificationService,
            ILogger<SystemController> logger)
        {
            _healthService = healthService;
            _notificationService = notificationService;
            _logger = logger;
        }

        /// <summary>
        /// Get system health metrics
        /// </summary>
        [HttpGet("health")]
        public async Task<ActionResult<SystemHealthMetrics>> GetSystemHealth()
        {
            try
            {
                var health = await _healthService.GetCurrentHealthAsync();
                return Ok(health);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving system health");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        /// <summary>
        /// Get active system alerts - FIXED ENDPOINT
        /// </summary>
        [HttpGet("alerts")]
        public async Task<ActionResult<List<SystemAlert>>> GetActiveAlerts()
        {
            try
            {
                var alerts = await _healthService.GetActiveAlertsAsync();
                _logger.LogInformation("Retrieved {AlertCount} active alerts", alerts.Count);
                return Ok(alerts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active alerts");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        /// <summary>
        /// Get recent alerts (including resolved ones)
        /// </summary>
        [HttpGet("alerts/recent")]
        public async Task<ActionResult<List<SystemAlert>>> GetRecentAlerts([FromQuery] int count = 20)
        {
            try
            {
                var alerts = await _notificationService.GetRecentAlerts(count);
                return Ok(alerts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recent alerts");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        /// <summary>
        /// Resolve a system alert
        /// </summary>
        [HttpPost("alerts/{id}/resolve")]
        public async Task<ActionResult> ResolveAlert(int id, [FromBody] ResolveAlertRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.ResolvedBy))
                {
                    return BadRequest(new { error = "ResolvedBy field is required" });
                }

                await _notificationService.ResolveAlert(id, request.ResolvedBy);
                _logger.LogInformation("Alert {AlertId} resolved by {ResolvedBy}", id, request.ResolvedBy);
                return Ok(new { message = "Alert resolved successfully", alertId = id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving alert {AlertId}", id);
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        /// <summary>
        /// Create a new system alert (for testing or manual alerts)
        /// </summary>
        [HttpPost("alerts")]
        public async Task<ActionResult> CreateAlert([FromBody] CreateAlertRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var alert = new SystemAlert
                {
                    Severity = request.Severity,
                    Component = request.Component,
                    Message = request.Message,
                    Timestamp = DateTime.UtcNow
                };

                await _notificationService.AddAlert(alert);
                _logger.LogInformation("New alert created: {Severity} - {Message}", request.Severity, request.Message);
                
                return CreatedAtAction(nameof(GetActiveAlerts), new { id = alert.Id }, alert);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating alert");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        /// <summary>
        /// Get system metrics over time
        /// </summary>
        [HttpGet("metrics")]
        public async Task<ActionResult<Dictionary<string, object>>> GetMetrics(
            [FromQuery] DateTime? fromDate = null)
        {
            try
            {
                var from = fromDate ?? DateTime.UtcNow.AddHours(-24);
                
                var metrics = new Dictionary<string, object>
                {
                    ["timestamp"] = DateTime.UtcNow,
                    ["period_start"] = from,
                    ["period_end"] = DateTime.UtcNow,
                    ["processing_queue_size"] = 0,
                    ["avg_processing_time_ms"] = 150.0,
                    ["error_rate_percent"] = 0.5,
                    ["classification_accuracy"] = 0.94,
                    ["system_uptime_hours"] = (DateTime.UtcNow - Process.GetCurrentProcess().StartTime).TotalHours,
                    ["memory_usage_mb"] = GC.GetTotalMemory(false) / 1024.0 / 1024.0
                };

                return Ok(metrics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving system metrics");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        /// <summary>
        /// Get system status summary
        /// </summary>
        [HttpGet("status")]
        public async Task<ActionResult<object>> GetSystemStatus()
        {
            try
            {
                var health = await _healthService.GetCurrentHealthAsync();
                var activeAlerts = await _healthService.GetActiveAlertsAsync();
                
                var status = new
                {
                    timestamp = DateTime.UtcNow,
                    overall_healthy = health.CnnServiceHealthy && health.ExpertSystemHealthy && 
                                    health.CameraConnected && health.ArduinoConnected,
                    components = new
                    {
                        cnn_service = health.CnnServiceHealthy,
                        expert_system = health.ExpertSystemHealthy,
                        camera = health.CameraConnected,
                        arduino = health.ArduinoConnected
                    },
                    metrics = new
                    {
                        avg_processing_time_ms = health.AvgProcessingTimeMs,
                        total_items_processed = health.TotalItemsProcessed,
                        accuracy_rate = health.AccuracyRate,
                        system_uptime_hours = health.SystemUptime,
                        memory_usage_mb = health.MemoryUsageMB
                    },
                    alerts = new
                    {
                        total_active = activeAlerts.Count,
                        critical = activeAlerts.Count(a => a.Severity == "CRITICAL"),
                        warning = activeAlerts.Count(a => a.Severity == "WARNING"),
                        info = activeAlerts.Count(a => a.Severity == "INFO")
                    }
                };

                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving system status");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        /// <summary>
        /// Test endpoint to verify API connectivity
        /// </summary>
        [HttpGet("ping")]
        public ActionResult<object> Ping()
        {
            return Ok(new 
            { 
                message = "System API is responding", 
                timestamp = DateTime.UtcNow,
                version = "1.0.0"
            });
        }
    }

    public class ResolveAlertRequest
    {
        public string ResolvedBy { get; set; } = string.Empty;
    }

    public class CreateAlertRequest
    {
        [Required]
        public string Severity { get; set; } = string.Empty; // INFO, WARNING, ERROR, CRITICAL
        
        [Required]
        public string Component { get; set; } = string.Empty;
        
        [Required]
        public string Message { get; set; } = string.Empty;
    }
}
