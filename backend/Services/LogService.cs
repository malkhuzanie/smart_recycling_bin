namespace SmartRecyclingBin.Services
{
    public interface ILogService
    {
        Task<IEnumerable<string>> GetLogLinesAsync(string logFileName, int lineCount = 500);
    }

    public class LogService : ILogService
    {
        private readonly ILogger<LogService> _logger;
        private readonly string _logDirectory = Path.Combine("..", "logs");

        public LogService(ILogger<LogService> logger)
        {
            _logger = logger;
        }

        public async Task<IEnumerable<string>> GetLogLinesAsync(string logFileName, int lineCount = 500)
        {
            // Security: Prevent directory traversal attacks
            if (logFileName.Contains("..") || logFileName.Contains("/") || logFileName.Contains("\\"))
            {
                throw new ArgumentException("Invalid log file name.");
            }

            // Security: Only allow approved log files
            var allowedFiles = new List<string> { "orchestrated_services.log", "smart-recycling-bin-.log" };
            if (!allowedFiles.Any(f => logFileName.StartsWith(f.Split('-')[0])))
            {
                 throw new ArgumentException("Access to this log file is not permitted.");
            }

            // Find the most recent log file matching the prefix
            var filePattern = logFileName.EndsWith(".log") ? logFileName.Split('.')[0] + "*" : logFileName + "*";
            var directory = new DirectoryInfo(_logDirectory);
            var logFile = directory.GetFiles(filePattern)
                                   .OrderByDescending(f => f.LastWriteTime)
                                   .FirstOrDefault();

            if (logFile == null || !logFile.Exists)
            {
                _logger.LogWarning("Log file not found: {logFileName}", logFileName);
                return new List<string> { $"Log file '{logFileName}' not found in '{_logDirectory}'." };
            }

            try
            {
                var lines = await File.ReadAllLinesAsync(logFile.FullName);
                return lines.TakeLast(lineCount);
            }
            catch (IOException ex)
            {
                _logger.LogError(ex, "Error reading log file {logFile}", logFile.FullName);
                return new List<string> { $"Error reading log file: {ex.Message}" };
            }
        }
    }
}