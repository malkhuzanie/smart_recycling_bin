using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartRecyclingBin.Data;
using SmartRecyclingBin.Hubs;
using SmartRecyclingBin.Models;

namespace SmartRecyclingBin.Services
{
    public class OverrideService : IOverrideService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ClassificationHub> _classificationHub;
        private readonly IHubContext<DashboardHub> _dashboardHub;
        private readonly ILogger<OverrideService> _logger;

        public OverrideService(
            ApplicationDbContext context,
            IHubContext<ClassificationHub> classificationHub,
            IHubContext<DashboardHub> dashboardHub,
            ILogger<OverrideService> logger)
        {
            _context = context;
            _classificationHub = classificationHub;
            _dashboardHub = dashboardHub;
            _logger = logger;
        }

        public async Task<bool> ApplyManualOverrideAsync(ManualOverrideRequest request)
        {
            try
            {
                var classification = await _context.ClassificationResults
                    .FindAsync(request.ClassificationId);

                if (classification == null)
                {
                    _logger.LogWarning($"Classification with ID {request.ClassificationId} not found for override");
                    return false;
                }

                // Update classification with override information
                classification.IsOverridden = true;
                classification.OverrideReason = request.Reason;
                classification.OverriddenBy = request.UserId;
                classification.OverrideClassification = request.NewClassification;
                classification.DisposalLocation = request.NewDisposalLocation;
                classification.OverrideTimestamp = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                // Notify connected clients about the override
                var overrideNotification = new
                {
                    ClassificationId = request.ClassificationId,
                    NewClassification = request.NewClassification,
                    NewDisposalLocation = request.NewDisposalLocation,
                    Reason = request.Reason,
                    OverriddenBy = request.UserId,
                    Timestamp = DateTime.UtcNow
                };

                await _classificationHub.Clients.All.SendAsync("ClassificationOverridden", overrideNotification);
                await _dashboardHub.Clients.Group("Dashboard").SendAsync("OverrideApplied", overrideNotification);

                _logger.LogInformation($"Manual override applied to classification {request.ClassificationId} by {request.UserId}");

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error applying manual override for classification {request.ClassificationId}");
                throw;
            }
        }

        public async Task<List<ClassificationResult>> GetOverriddenClassificationsAsync(int count = 50)
        {
            try
            {
                return await _context.ClassificationResults
                    .Where(c => c.IsOverridden)
                    .OrderByDescending(c => c.OverrideTimestamp)
                    .Take(count)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving overridden classifications");
                throw;
            }
        }

        public async Task<double> GetOverrideRateAsync(DateTime fromDate)
        {
            try
            {
                var totalClassifications = await _context.ClassificationResults
                    .Where(c => c.Timestamp >= fromDate)
                    .CountAsync();

                if (totalClassifications == 0) return 0.0;

                var overriddenCount = await _context.ClassificationResults
                    .Where(c => c.Timestamp >= fromDate && c.IsOverridden)
                    .CountAsync();

                return (double)overriddenCount / totalClassifications * 100;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating override rate");
                throw;
            }
        }
    }
}