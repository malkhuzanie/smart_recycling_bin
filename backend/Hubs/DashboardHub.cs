using Microsoft.AspNetCore.SignalR;
using SmartRecyclingBin.Services;
using SmartRecyclingBin.Models;

namespace SmartRecyclingBin.Hubs
{
    public class DashboardHub : Hub
    {
        private readonly ILogger<DashboardHub> _logger;
        private readonly ISystemHealthService _healthService;
        private readonly IClassificationService _classificationService;

        public DashboardHub(
            ILogger<DashboardHub> logger, 
            ISystemHealthService healthService,
            IClassificationService classificationService)
        {
            _logger = logger;
            _healthService = healthService;
            _classificationService = classificationService;
        }

        /// <summary>
        /// Join dashboard group for targeted updates 
        /// </summary>
        public async Task JoinDashboardGroup()
        {
            var connectionId = Context.ConnectionId;
            
            await Groups.AddToGroupAsync(connectionId, "Dashboard");
            _logger.LogInformation("Client {ConnectionId} joined Dashboard group", connectionId);
            
            try
            {
                var healthMetrics = await _healthService.GetCurrentHealthAsync();
                var recentStats = await _classificationService.GetStatisticsAsync(DateTime.Today.AddDays(-1), DateTime.Now);
                
                var dashboardData = new
                {
                    Type = "initial_status",
                    Data = new
                    {
                        HealthMetrics = healthMetrics,
                        Stats = recentStats,
                        ConnectionId = connectionId,
                        ConnectedAt = DateTime.UtcNow
                    },
                    Timestamp = DateTime.UtcNow
                };
                
                await Clients.Caller.SendAsync("DashboardUpdate", dashboardData);
                
                // Send welcome confirmation
                await Clients.Caller.SendAsync("JoinedDashboardGroup", new
                {
                    ConnectionId = connectionId,
                    Message = "Successfully joined dashboard group",
                    Timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending initial dashboard data to {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Failed to load initial dashboard data");
            }
        }

        /// <summary>
        /// Leave dashboard group
        /// </summary>
        public async Task LeaveDashboardGroup()
        {
            var connectionId = Context.ConnectionId;
            
            await Groups.RemoveFromGroupAsync(connectionId, "Dashboard");
            _logger.LogInformation("Client {ConnectionId} left Dashboard group", connectionId);
        }

        public async Task RequestSystemStatus()
        {
            var connectionId = Context.ConnectionId;
            
            try
            {
                var healthMetrics = await _healthService.GetCurrentHealthAsync();
                _logger.LogError($"LSTATS = {healthMetrics.CnnServiceHealthy.ToString()}");
                var statusUpdate = new
                {
                    Type = "status",
                    Data = healthMetrics,
                    Timestamp = DateTime.UtcNow
                };
                
                await Clients.Caller.SendAsync("DashboardUpdate", statusUpdate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting system status for {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Failed to get system status");
            }
        }

        public async Task RequestStats(DateTime? fromDate = null, DateTime? toDate = null)
        {
            var connectionId = Context.ConnectionId;
            
            try
            {
                var from = fromDate ?? DateTime.Today.AddDays(-7);
                var to = toDate ?? DateTime.Now;
                
                var stats = await _classificationService.GetStatisticsAsync(from, to);
                _logger.LogError("LSTATS");
                _logger.LogError(stats.ToString());
                
                var statsUpdate = new
                {
                    Type = "stats",
                    Data = stats,
                    Timestamp = DateTime.UtcNow,
                    DateRange = new { From = from, To = to }
                };
                
                await Clients.Caller.SendAsync("DashboardUpdate", statsUpdate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting stats for {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Failed to get statistics");
            }
        }

        /// <summary>
        /// Get recent classifications 
        /// </summary>
        public async Task RequestRecentClassifications(int page = 1, int pageSize = 10, string? filterBy = null)
        {
            var connectionId = Context.ConnectionId;
            
            try
            {
                var recentClassifications = await _classificationService.GetRecentClassificationsAsync(page, pageSize, filterBy);
                
                var classificationsUpdate = new
                {
                    Type = "recent_classifications",
                    Data = recentClassifications,
                    Timestamp = DateTime.UtcNow
                };
                
                await Clients.Caller.SendAsync("DashboardUpdate", classificationsUpdate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting recent classifications for {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Failed to get recent classifications");
            }
        }

        /// <summary>
        /// Broadcast system status update to all dashboard clients
        /// </summary>
        public async Task BroadcastSystemStatus(SystemHealthMetrics statusData)
        {
            try
            {
                var statusUpdate = new
                {
                    Type = "status",
                    Data = statusData,
                    Timestamp = DateTime.UtcNow
                };
                
                await Clients.Group("Dashboard").SendAsync("DashboardUpdate", statusUpdate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error broadcasting system status");
            }
        }

        /// <summary>
        /// Broadcast stats update to all dashboard clients
        /// </summary>
        public async Task BroadcastStatsUpdate(ClassificationStatistics statsData)
        {
            try
            {
                var statsUpdate = new
                {
                    Type = "stats",
                    Data = statsData,
                    Timestamp = DateTime.UtcNow
                };
                
                await Clients.Group("Dashboard").SendAsync("DashboardUpdate", statsUpdate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error broadcasting stats update");
            }
        }

        /// <summary>
        /// Send alert to dashboard clients 
        /// </summary>
        public async Task SendAlert(SystemAlert alert)
        {
            try
            {
                var alertUpdate = new
                {
                    Type = "alert",
                    Data = alert,
                    Timestamp = DateTime.UtcNow
                };
                
                await Clients.Group("Dashboard").SendAsync("DashboardUpdate", alertUpdate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending alert to dashboard");
            }
        }

        /// <summary>
        /// Send heartbeat to verify connection
        /// </summary>
        public async Task Heartbeat()
        {
            await Clients.Caller.SendAsync("HeartbeatResponse", new
            {
                Timestamp = DateTime.UtcNow,
                ConnectionId = Context.ConnectionId,
                Status = "Connected"
            });
        }

        // Connection event handlers
        public override async Task OnConnectedAsync()
        {
            var connectionId = Context.ConnectionId;
            var userIdentifier = Context.UserIdentifier ?? "Unknown";
            
            _logger.LogInformation("Client connected to DashboardHub: {ConnectionId} (User: {User})", 
                connectionId, userIdentifier);
                
            await Clients.Caller.SendAsync("Connected", new
            {
                ConnectionId = connectionId,
                Message = "Connected to DashboardHub",
                Timestamp = DateTime.UtcNow
            });
            
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var connectionId = Context.ConnectionId;
            var userIdentifier = Context.UserIdentifier ?? "Unknown";
            
            if (exception != null)
            {
                _logger.LogError(exception, "Client disconnected from DashboardHub with error: {ConnectionId} (User: {User})", 
                    connectionId, userIdentifier);
            }
            else
            {
                _logger.LogInformation("Client disconnected from DashboardHub: {ConnectionId} (User: {User})", 
                    connectionId, userIdentifier);
            }
            
            await base.OnDisconnectedAsync(exception);
        }
    }
}