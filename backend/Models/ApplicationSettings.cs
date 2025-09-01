using System.ComponentModel.DataAnnotations;

namespace SmartRecyclingBin.Models
{
    public class ApplicationSettings
    {
        [Required]
        public string DatabasePath { get; set; } = "../data/smartbin.db";
        
        public PythonServicesSettings PythonServices { get; set; } = new();
        
        public ProcessingSettings Processing { get; set; } = new();
        
        public NotificationSettings Notifications { get; set; } = new();
    }

    public class PythonServicesSettings
    {
        [Required]
        [Url]
        public string CnnServiceUrl { get; set; } = "http://localhost:8001";
        
        [Required]
        [Url]
        public string ArduinoServiceUrl { get; set; } = "http://localhost:8002";
        
        [Range(1, 60)]
        public int HealthCheckIntervalSeconds { get; set; } = 30;
        
        [Range(1, 30)]
        public int TimeoutSeconds { get; set; } = 10;
    }

    public class ProcessingSettings
    {
        [Range(0.1, 1.0)]
        public double ConfidenceThreshold { get; set; } = 0.85;
        
        [Range(100, 5000)]
        public int MaxProcessingTimeMs { get; set; } = 2000;
        
        [Range(1, 100)]
        public int MaxConcurrentClassifications { get; set; } = 10;
    }

    public class NotificationSettings
    {
        public bool EnableRealTimeUpdates { get; set; } = true;
        
        public bool EnableEmailAlerts { get; set; } = false;
        
        public string? SmtpServer { get; set; }
        
        public string? AlertEmailAddress { get; set; }
    }
}