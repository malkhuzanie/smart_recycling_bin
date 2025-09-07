using System.ComponentModel.DataAnnotations;

namespace SmartRecyclingBin.Models
{
    public class ClassificationResult
    {
        public int Id { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        
        // Detection ID for tracing
        [MaxLength(100)]
        public string DetectionId { get; set; } = string.Empty;
        
        // CNN Prediction data
        [Required]
        [MaxLength(100)]
        public string CnnPredictedClass { get; set; } = string.Empty;
        public double CnnConfidence { get; set; }
        public int CnnStage { get; set; }
        public double ProcessingTimeMs { get; set; }
        
        // Sensor data
        public double WeightGrams { get; set; }
        public bool IsMetalDetected { get; set; }
        public double HumidityPercent { get; set; }
        public double TemperatureCelsius { get; set; }
        public bool IsMoist { get; set; }
        public bool IsTransparent { get; set; }
        public bool IsFlexible { get; set; }
        
        // Expert system results
        [Required]
        [MaxLength(100)]
        public string FinalClassification { get; set; } = string.Empty;
        public double FinalConfidence { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string DisposalLocation { get; set; } = string.Empty;
        
        [MaxLength(500)]
        public string Reasoning { get; set; } = string.Empty;
        
        public int CandidatesCount { get; set; }
        
        public string? ImageBase64 { get; set; }
        public DateTime? ImageCaptureTimestamp { get; set; }
        public long? ImageSizeBytes { get; set; }
        
        [MaxLength(10)]
        public string? ImageFormat { get; set; }
        
        [MaxLength(20)]
        public string? ImageDimensions { get; set; }
        
        public bool HasImage { get; set; } = false;
        
        // Processing pipeline tracking
        [MaxLength(1000)]
        public string? ProcessingPipeline { get; set; }
        
        [MaxLength(2000)]
        public string? ValidationResults { get; set; }
        
        // Override information
        public bool IsOverridden { get; set; } = false;
        [MaxLength(500)]
        public string? OverrideReason { get; set; }
        [MaxLength(100)]
        public string? OverriddenBy { get; set; }
        [MaxLength(100)]
        public string? OverrideClassification { get; set; }
        public DateTime? OverrideTimestamp { get; set; }
        public double? IrTransparency { get; set; }
        public string? OverrideUserId { get; set; }
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

    // 🔧 FIXED: SystemAlert with correct properties
    public class SystemAlert
    {
        public int Id { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        
        [Required]
        [MaxLength(20)]
        public string Severity { get; set; } = string.Empty; // INFO, WARNING, ERROR, CRITICAL
        
        [Required]
        [MaxLength(100)]
        public string Component { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(500)]
        public string Message { get; set; } = string.Empty;
        
        public bool IsResolved { get; set; } = false;
        public DateTime? ResolvedTimestamp { get; set; } // ✅ This property exists
        
        [MaxLength(100)]
        public string? ResolvedBy { get; set; }
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
        
        public string DetectionId { get; set; } = string.Empty;
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

    public class ImageStorageStats
    {
        public int TotalImagesStored { get; set; }
        public long TotalStorageSizeBytes { get; set; }
        public double AverageImageSizeBytes { get; set; }
        public DateTime? OldestImageDate { get; set; }
        public DateTime? NewestImageDate { get; set; }
        
        public double TotalStorageSizeMB => TotalStorageSizeBytes / (1024.0 * 1024.0);
        public double AverageImageSizeMB => AverageImageSizeBytes / (1024.0 * 1024.0);
    }

    public class ClassificationWithImageDto
    {
        public int Id { get; set; }
        public string DetectionId { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string FinalClassification { get; set; } = string.Empty;
        public double FinalConfidence { get; set; }
        public string DisposalLocation { get; set; } = string.Empty;
        public string Reasoning { get; set; } = string.Empty;
        public double ProcessingTimeMs { get; set; }
        public bool HasImage { get; set; }
        
        // Image metadata (but not the actual image data for performance)
        public DateTime? ImageCaptureTimestamp { get; set; }
        public long? ImageSizeBytes { get; set; }
        public string? ImageFormat { get; set; }
        public string? ImageDimensions { get; set; }
        
        // Sensor data
        public SensorData? SensorData { get; set; }
        
        // Processing info
        public string? ProcessingPipeline { get; set; }
        public bool IsOverridden { get; set; }
    }

    public class ImageDataDto
    {
        [Required]
        public string ImageBase64 { get; set; } = string.Empty;
        
        [Required]
        public string Format { get; set; } = "jpeg";
        
        public string? Dimensions { get; set; }
        public long SizeBytes { get; set; }
        public DateTime CaptureTimestamp { get; set; } = DateTime.UtcNow;
    }
}