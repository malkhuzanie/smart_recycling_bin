using System.ComponentModel.DataAnnotations;

namespace SmartRecyclingBin.Models.DTOs
{
    public class ClassificationResponseDto
    {
        public int Id { get; set; }
        
        public string DetectionId { get; set; } = string.Empty;
        
        public DateTime Timestamp { get; set; }
        
        public string FinalClassification { get; set; } = string.Empty;
        
        public double FinalConfidence { get; set; }
        
        public string DisposalLocation { get; set; } = string.Empty;
        
        public string Reasoning { get; set; } = string.Empty;
        
        public bool IsOverridden { get; set; }
        
        public double ProcessingTimeMs { get; set; }
        
        public bool HasImage { get; set; }
        
        public string ProcessingPipeline { get; set; } = string.Empty;
        
        public string ValidationResults { get; set; } = "{}";
        
        public CnnPredictionDto? CnnPrediction { get; set; }
        
        public SensorDataDto? SensorData { get; set; }
        
        public ImageMetadataDto? ImageMetadata { get; set; }
        
        public string? OverrideReason { get; set; }
        
        public string? OverrideClassification { get; set; }
        
        public DateTime? OverrideTimestamp { get; set; }
        
        public string? OverrideUserId { get; set; }
    }

    public class ImageMetadataDto
    {
        public bool HasImage { get; set; }
        public string? ImageFormat { get; set; }
        public string? ImageDimensions { get; set; }
        public DateTime? ImageCaptureTimestamp { get; set; }
        public long? ImageSizeBytes { get; set; }
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
        public string? ImageBase64 { get; set; }
        public string? ImageFormat { get; set; }
        public string? ImageDimensions { get; set; }
        public DateTime? ImageCaptureTimestamp { get; set; }
        public long? ImageSizeBytes { get; set; }
        
        public SensorDataDto? SensorData { get; set; }
        
        public string ProcessingPipeline { get; set; } = string.Empty;
        public string ValidationResults { get; set; } = "{}";
    }

    public class ImageDataDto
    {
        public string ImageBase64 { get; set; } = string.Empty;
        public string Format { get; set; } = string.Empty;
        public string Dimensions { get; set; } = string.Empty;
        public long SizeBytes { get; set; }
        public DateTime CaptureTimestamp { get; set; }
        public int Quality { get; set; }
        public string? OriginalDimensions { get; set; }
    }

    public class ProcessingMetadataDto
    {
        public string? PipelineVersion { get; set; }
        public string? ModelVersion { get; set; }
        public string? ProcessingNode { get; set; }
        public List<string>? StagesCompleted { get; set; }
        public bool FallbackUsed { get; set; }
        public bool ImageCaptured { get; set; }
        public int ImageQuality { get; set; }
    }
}