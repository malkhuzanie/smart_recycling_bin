using Microsoft.AspNetCore.SignalR;
using SmartRecyclingBin.Hubs;
using System;
using Microsoft.Extensions.Logging;

namespace SmartRecyclingBin.Logging
{
    public class SignalRLogger : ILogger
    {
        private readonly string _categoryName;
        private readonly Func<IHubContext<LogHub>> _hubContextResolver;
        private IHubContext<LogHub>? _hubContext;

        // The serviceName MUST match what the frontend expects for the group name
        private const string ServiceName = "csharp-backend"; 

        public SignalRLogger(string categoryName, Func<IHubContext<LogHub>> hubContextResolver)
        {
            _categoryName = categoryName;
            _hubContextResolver = hubContextResolver;
        }

        public IDisposable BeginScope<TState>(TState state) => default!;

        public bool IsEnabled(LogLevel logLevel)
        {
            // You can add logic here to filter log levels if needed
            return logLevel != LogLevel.None;
        }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }
            
            // Resolve the HubContext only when the first log is written.
            // This avoids issues with dependency injection during startup.
            _hubContext ??= _hubContextResolver();
            
            var logLine = formatter(state, exception);
            
            // Send the log line to the hub.
            // We don't await this to avoid blocking the logging thread.
            _hubContext.Clients.Group(ServiceName).SendAsync("ReceiveLogLine", ServiceName, logLine);
        }
    }
}