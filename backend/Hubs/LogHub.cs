using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace SmartRecyclingBin.Hubs
{
    public class LogHub : Hub
    {
        private readonly ILogger<LogHub> _logger;

        public LogHub(ILogger<LogHub> logger)
        {
            _logger = logger;
        }

        // This method will be called by our Python service
        public async Task SendLog(string serviceName, string logLine)
        {
            // Broadcast the log line to clients subscribed to this service's logs
            await Clients.Group(serviceName).SendAsync("ReceiveLogLine", serviceName, logLine);
        }

        public async Task JoinLogGroup(string serviceName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, serviceName);
            _logger.LogInformation("Client {ConnectionId} started listening for logs from '{serviceName}'", Context.ConnectionId, serviceName);
        }
    }
}