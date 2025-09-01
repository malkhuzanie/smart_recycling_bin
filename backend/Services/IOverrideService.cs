using SmartRecyclingBin.Models;

namespace SmartRecyclingBin.Services
{
    public interface IOverrideService
    {
        Task<bool> ApplyManualOverrideAsync(ManualOverrideRequest request);
        Task<List<ClassificationResult>> GetOverriddenClassificationsAsync(int count = 50);
        Task<double> GetOverrideRateAsync(DateTime fromDate);
    }
}