using Microsoft.AspNetCore.SignalR;
using SmartRecyclingBin.Services;
using SmartRecyclingBin.Models;
using System.Threading.Tasks;

namespace SmartRecyclingBin.Hubs
{
    public class SystemHealthHub : Hub
    {
        private readonly ILogger<SystemHealthHub> _logger;
        private readonly ISystemHealthService _healthService;

        public SystemHealthHub(ILogger<SystemHealthHub> logger, ISystemHealthService healthService)
        {
            _logger = logger;
            _healthService = healthService;
        }

        public async Task JoinHealthGroup()
        {
            var connectionId = Context.ConnectionId;
            await Groups.AddToGroupAsync(connectionId, "HealthMonitor");
            _logger.LogInformation("Client {ConnectionId} joined HealthMonitor group", connectionId);

            // Send initial health data upon joining
            var initialHealth = await _healthService.GetCurrentHealthAsync();
            await Clients.Caller.SendAsync("InitialHealthStatus", initialHealth);
        }

        public async Task LeaveHealthGroup()
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "HealthMonitor");
            _logger.LogInformation("Client {ConnectionId} left HealthMonitor group", Context.ConnectionId);
        }

        public override Task OnConnectedAsync()
        {
            _logger.LogInformation("Client connected to SystemHealthHub: {ConnectionId}", Context.ConnectionId);
            return base.OnConnectedAsync();
        }
    }
}