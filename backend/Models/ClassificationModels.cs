using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SmartRecyclingBin.Models
{
    public class ClassificationResult
    {
        public int Id { get; set; }
        
        [Required]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        
        // CNN Prediction Data
        [Required]
        [MaxLength(100)]
        public string CnnPredictedClass { get; set; } = string.Empty;
        
        [Range(0.0, 1.0)]
        public double CnnConfidence { get; set; }
        
        public int CnnStage { get; set; }
        
        [Range(0, double.MaxValue)]
        public double ProcessingTimeMs { get; set; }
        
        // Sensor Data
        [Range(0, double.MaxValue)]
        public double WeightGrams { get; set; }
        
        public bool IsMetalDetected { get; set; }
        
        [Range(0, 100)]
        public double HumidityPercent { get; set; }
        
        public double TemperatureCelsius { get; set; }
        
        public bool IsMoist { get; set; }
        public bool IsTransparent { get; set; }
        public bool IsFlexible { get; set; }
        
        // Expert System Results
        [Required]
        [MaxLength(100)]
        public string FinalClassification { get; set; } = string.Empty;
        
        [Range(0.0, 1.0)]
        public double FinalConfidence { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string DisposalLocation { get; set; } = string.Empty;
        
        [MaxLength(500)]
        public string Reasoning { get; set; } = string.Empty;
        
        public int CandidatesCount { get; set; }
        
        // Override Information
        public bool IsOverridden { get; set; }
        [MaxLength(500)]
        public string? OverrideReason { get; set; }
        [MaxLength(100)]
        public string? OverriddenBy { get; set; }
        [MaxLength(100)]
        public string? OverrideClassification { get; set; }
        public DateTime? OverrideTimestamp { get; set; }
    }

    public class SystemHealthMetrics
    {
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public bool CameraConnected { get; set; }
        public bool ArduinoConnected { get; set; }
        public bool CnnServiceHealthy { get; set; }
        public bool ExpertSystemHealthy { get; set; }
        public double AvgProcessingTimeMs { get; set; }
        public int TotalItemsProcessed { get; set; }
        public double AccuracyRate { get; set; }
        public Dictionary<string, int> ClassificationCounts { get; set; } = new();
        public double SystemUptime { get; set; }
        public double MemoryUsageMB { get; set; }
        public double CpuUsagePercent { get; set; }
    }

    public class ManualOverrideRequest
    {
        [Required]
        public int ClassificationId { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string NewClassification { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(200)]
        public string NewDisposalLocation { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(500)]
        public string Reason { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(100)]
        public string UserId { get; set; } = string.Empty;
    }

    public class ClassificationRequest
    {
        [Required]
        public string ImageData { get; set; } = string.Empty; // Base64 encoded
        
        [Required]
        public SensorData Sensors { get; set; } = new();
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class SensorData
    {
        public double WeightGrams { get; set; }
        public bool IsMetalDetected { get; set; }
        public double HumidityPercent { get; set; }
        public double TemperatureCelsius { get; set; }
        public bool IsMoist { get; set; }
        public bool IsTransparent { get; set; }
        public bool IsFlexible { get; set; }
        public double IrTransparency { get; set; }
    }

    public class ClassificationStatistics
    {
        public int TotalItems { get; set; }
        public double AccuracyRate { get; set; }
        public double AvgProcessingTime { get; set; }
        public Dictionary<string, int> ClassificationBreakdown { get; set; } = new();
        public double OverrideRate { get; set; }
        public int ItemsToday { get; set; }
        public int ItemsThisWeek { get; set; }
        public int ItemsThisMonth { get; set; }
        public DateTime LastClassification { get; set; }
        public List<HourlyStats> HourlyBreakdown { get; set; } = new();
    }

    public class HourlyStats
    {
        public DateTime Hour { get; set; }
        public int Count { get; set; }
        public double AvgAccuracy { get; set; }
    }

    public class SystemAlert
    {
        public int Id { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Severity { get; set; } = string.Empty; // INFO, WARNING, ERROR, CRITICAL
        public string Component { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsResolved { get; set; }
        public DateTime? ResolvedTimestamp { get; set; }
        public string? ResolvedBy { get; set; }
    }
}
