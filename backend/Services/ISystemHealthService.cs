using SmartRecyclingBin.Models;

namespace SmartRecyclingBin.Services
{
    public interface ISystemHealthService
    {
        Task<SystemHealthMetrics> GetCurrentHealthAsync();
        Task<bool> CheckServiceHealthAsync(string serviceUrl);
        Task LogHealthMetricsAsync(SystemHealthMetrics metrics);
        Task<List<SystemAlert>> GetActiveAlertsAsync();
    }
}