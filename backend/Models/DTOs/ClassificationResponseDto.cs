namespace SmartRecyclingBin.Models.DTOs;

public class ClassificationResponseDto
{
    public int Id { get; set; }
    public DateTime Timestamp { get; set; }
    public string FinalClassification { get; set; } = string.Empty;
    public double FinalConfidence { get; set; }
    public string DisposalLocation { get; set; } = string.Empty;
    public string Reasoning { get; set; } = string.Empty;
    public bool IsOverridden { get; set; }
    public double ProcessingTimeMs { get; set; }
        
    // CNN Information
    public CnnPredictionDto? CnnPrediction { get; set; }
        
    // Sensor Information  
    public SensorDataDto? SensorData { get; set; }
        
    // Metadata
    public Dictionary<string, object>? Metadata { get; set; }
}