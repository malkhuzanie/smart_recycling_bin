using SmartRecyclingBin.Models;

namespace SmartRecyclingBin.Services
{
    public interface INotificationService
    {
        Task AddAlert(SystemAlert alert);
        Task<List<SystemAlert>> GetRecentAlerts(int count = 20);
        Task ResolveAlert(int alertId, string resolvedBy);
        Task NotifyClassificationProcessedAsync(ClassificationResult result);
    }
}