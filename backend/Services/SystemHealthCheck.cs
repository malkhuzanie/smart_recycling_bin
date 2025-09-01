using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace SmartRecyclingBin.Services
{
    public class SystemHealthCheck : IHealthCheck
    {
        private readonly ISystemHealthService _healthService;
        private readonly ILogger<SystemHealthCheck> _logger;

        public SystemHealthCheck(ISystemHealthService healthService, ILogger<SystemHealthCheck> logger)
        {
            _healthService = healthService;
            _logger = logger;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context, 
            CancellationToken cancellationToken = default)
        {
            try
            {
                var health = await _healthService.GetCurrentHealthAsync();
                
                var unhealthyComponents = new List<string>();
                
                if (!health.CameraConnected) unhealthyComponents.Add("Camera");
                if (!health.ArduinoConnected) unhealthyComponents.Add("Arduino");
                if (!health.CnnServiceHealthy) unhealthyComponents.Add("CNN Service");
                if (!health.ExpertSystemHealthy) unhealthyComponents.Add("Expert System");

                if (unhealthyComponents.Count != 0)
                {
                    string description = $"Unhealthy components: {string.Join(", ", unhealthyComponents)}";
                    return HealthCheckResult.Degraded(description);
                }

                return HealthCheckResult.Healthy("All systems operational");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Health check failed");
                return HealthCheckResult.Unhealthy("Health check failed", ex);
            }
        }
    }
}