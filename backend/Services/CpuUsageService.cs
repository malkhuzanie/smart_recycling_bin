using System.Diagnostics;
using System.Timers;

namespace SmartRecyclingBin.Services
{
    public class CpuUsageService : ICpuUsageService, IDisposable
    {
        private readonly ILogger<CpuUsageService> _logger;
        private readonly System.Timers.Timer _timer;
        private readonly Process _currentProcess;
        private TimeSpan _lastProcessorTime;
        private DateTime _lastCheckTime;
        private double _currentCpuUsage;
        private readonly object _lock = new object();

        public CpuUsageService(ILogger<CpuUsageService> logger)
        {
            _logger = logger;
            _currentProcess = Process.GetCurrentProcess();
            _lastProcessorTime = _currentProcess.TotalProcessorTime;
            _lastCheckTime = DateTime.UtcNow;
            _currentCpuUsage = 0.0;

            // Set up a timer to calculate CPU usage every 5 seconds
            _timer = new System.Timers.Timer(5000);
            _timer.Elapsed += CalculateCpuUsage;
            _timer.AutoReset = true;
            _timer.Enabled = true;

            _logger.LogInformation("CPU Usage Service initialized and monitoring started.");
        }

        private void CalculateCpuUsage(object? sender, ElapsedEventArgs e)
        {
            try
            {
                lock (_lock)
                {
                    var newProcessorTime = _currentProcess.TotalProcessorTime;
                    var newCheckTime = DateTime.UtcNow;

                    var processorTimeDelta = newProcessorTime - _lastProcessorTime;
                    var timeDelta = newCheckTime - _lastCheckTime;

                    if (timeDelta.TotalMilliseconds > 0)
                    {
                        // The usage is the percentage of time the CPU spent on our process
                        // divided by the total elapsed time, across all cores.
                        var usage = (processorTimeDelta.TotalMilliseconds / (Environment.ProcessorCount * timeDelta.TotalMilliseconds)) * 100;
                        
                        // Clamp the value between 0 and 100
                        _currentCpuUsage = Math.Max(0, Math.Min(100, usage));
                    }

                    _lastProcessorTime = newProcessorTime;
                    _lastCheckTime = newCheckTime;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to calculate CPU usage.");
                _currentCpuUsage = -1; // Indicate an error
            }
        }

        public double GetCurrentCpuUsagePercentage()
        {
            lock (_lock)
            {
                // Return the last calculated value. This is non-blocking.
                return _currentCpuUsage;
            }
        }

        public void Dispose()
        {
            _timer?.Stop();
            _timer?.Dispose();
        }
    }
}