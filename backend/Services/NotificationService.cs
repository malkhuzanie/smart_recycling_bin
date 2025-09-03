using SmartRecyclingBin.Data;
using SmartRecyclingBin.Models;

namespace SmartRecyclingBin.Services
{
    public class NotificationService : INotificationService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<NotificationService> _logger;
        private readonly List<SystemAlert> _recentAlerts = new();

        // Use IServiceScopeFactory instead of direct ApplicationDbContext
        public NotificationService(IServiceScopeFactory serviceScopeFactory, ILogger<NotificationService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        public async Task AddAlert(SystemAlert alert)
        {
            try
            {
                // Create a scope to get a scoped ApplicationDbContext
                using var scope = _serviceScopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                context.SystemAlerts.Add(alert);
                await context.SaveChangesAsync();

                _recentAlerts.Add(alert);
                
                // Keep only recent 50 alerts in memory
                while (_recentAlerts.Count > 50)
                {
                    _recentAlerts.RemoveAt(0);
                }

                _logger.LogInformation($"Added system alert: {alert.Severity} - {alert.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding system alert");
            }
        }

        public Task<List<SystemAlert>> GetRecentAlerts(int count = 20)
        {
            return Task.FromResult(_recentAlerts.TakeLast(count).ToList());
        }

        public async Task ResolveAlert(int alertId, string resolvedBy)
        {
            try
            {
                // Create a scope to get a scoped ApplicationDbContext
                using var scope = _serviceScopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var alert = await context.SystemAlerts.FindAsync(alertId);
                if (alert != null)
                {
                    alert.IsResolved = true;
                    alert.ResolvedTimestamp = DateTime.UtcNow;
                    alert.ResolvedBy = resolvedBy;
                    
                    await context.SaveChangesAsync();
                    _logger.LogInformation($"Resolved alert {alertId} by {resolvedBy}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error resolving alert {alertId}");
            }
        }
        
          public async Task NotifyClassificationProcessedAsync(ClassificationResult result)
        {
            try
            {
                // Create alerts for important classification events
                
                // Low confidence alert
                if (result.FinalConfidence < 0.6)
                {
                    var lowConfidenceAlert = new SystemAlert
                    {
                        Severity = "WARNING",
                        Component = "ClassificationEngine",
                        Message = $"Low confidence classification: {result.FinalClassification} ({result.FinalConfidence:P1}) for item {result.DetectionId}"
                    };
                    await AddAlert(lowConfidenceAlert);
                }

                // High processing time alert
                if (result.ProcessingTimeMs > 3000)
                {
                    var slowProcessingAlert = new SystemAlert
                    {
                        Severity = "INFO",
                        Component = "ClassificationEngine", 
                        Message = $"High processing time: {result.ProcessingTimeMs:F0}ms for item {result.DetectionId}"
                    };
                    await AddAlert(slowProcessingAlert);
                }

                // Override notifications
                if (result.IsOverridden)
                {
                    var overrideAlert = new SystemAlert
                    {
                        Severity = "INFO",
                        Component = "ManualOverride",
                        Message = $"Classification overridden: {result.FinalClassification} → {result.OverrideClassification} by {result.OverriddenBy}"
                    };
                    await AddAlert(overrideAlert);
                }

                // Image capture notifications
                if (!result.HasImage)
                {
                    var noImageAlert = new SystemAlert
                    {
                        Severity = "WARNING",
                        Component = "ImageCapture",
                        Message = $"No image captured for classification {result.DetectionId}"
                    };
                    await AddAlert(noImageAlert);
                }

                _logger.LogDebug($"Processed notifications for classification {result.Id}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing classification notifications for result {result.Id}");
            }
        }
    }
}