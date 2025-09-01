namespace SmartRecyclingBin.Models.DTOs
{
    public class DashboardStatsDto
    {
        public SystemStatusDto SystemStatus { get; set; } = new();
        public ProcessingStatsDto ProcessingStats { get; set; } = new();
        public List<RecentActivityDto> RecentActivity { get; set; } = new();
        public AlertSummaryDto Alerts { get; set; } = new();
    }

    public class SystemStatusDto
    {
        public bool CameraConnected { get; set; }
        public bool ArduinoConnected { get; set; }
        public bool CnnServiceHealthy { get; set; }
        public bool ExpertSystemHealthy { get; set; }
        public DateTime LastHealthCheck { get; set; }
        public string OverallStatus => GetOverallStatus();
        
        private string GetOverallStatus()
        {
            if (!CameraConnected || !ArduinoConnected || !CnnServiceHealthy || !ExpertSystemHealthy)
                return "Warning";
            return "Healthy";
        }
    }

    public class ProcessingStatsDto
    {
        public int TotalItemsToday { get; set; }
        public double AverageAccuracy { get; set; }
        public double AverageProcessingTime { get; set; }
        public double OverrideRate { get; set; }
        public Dictionary<string, int> ClassificationBreakdown { get; set; } = new();
    }

    public class RecentActivityDto
    {
        public DateTime Timestamp { get; set; }
        public string Classification { get; set; } = string.Empty;
        public string DisposalLocation { get; set; } = string.Empty;
        public double Confidence { get; set; }
        public bool IsOverridden { get; set; }
    }

    public class AlertSummaryDto
    {
        public int TotalActiveAlerts { get; set; }
        public int CriticalAlerts { get; set; }
        public int WarningAlerts { get; set; }
        public int InfoAlerts { get; set; }
        public List<SystemAlert> RecentAlerts { get; set; } = new();
    }
}

