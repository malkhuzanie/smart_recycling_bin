using Microsoft.AspNetCore.SignalR;
using SmartRecyclingBin.Hubs;
using System.Collections.Concurrent;

namespace SmartRecyclingBin.Logging
{
    public class SignalRLoggerProvider : ILoggerProvider
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ConcurrentDictionary<string, SignalRLogger> _loggers = new ConcurrentDictionary<string, SignalRLogger>();

        public SignalRLoggerProvider(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public ILogger CreateLogger(string categoryName)
        {
            return _loggers.GetOrAdd(categoryName, name => new SignalRLogger(name, GetHubContext));
        }
        
        private IHubContext<LogHub> GetHubContext()
        {
            // Resolve the service from the provider
            return _serviceProvider.GetRequiredService<IHubContext<LogHub>>();
        }

        public void Dispose()
        {
            _loggers.Clear();
        }
    }
}