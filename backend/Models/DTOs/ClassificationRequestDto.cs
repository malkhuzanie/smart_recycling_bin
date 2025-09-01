// Models/DTOs/ClassificationRequestDto.cs
using System.ComponentModel.DataAnnotations;

namespace SmartRecyclingBin.Models.DTOs
{
    public class ClassificationRequestDto
    {
        public CnnPredictionDto? CnnPrediction { get; set; }
        public SensorDataDto? SensorData { get; set; }
        public ExpertSystemResultDto? ExpertSystemResult { get; set; }
        public DateTime? Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class CnnPredictionDto
    {
        [Required]
        public string PredictedClass { get; set; } = string.Empty;
        
        [Range(0.0, 1.0)]
        public double Confidence { get; set; }
        
        [Range(1, 5)]
        public int Stage { get; set; } = 1;
        
        [Range(0, double.MaxValue)]
        public double ProcessingTimeMs { get; set; }
        
        public Dictionary<string, double>? ClassProbabilities { get; set; }
    }

    public class SensorDataDto
    {
        [Range(0, 10000)]
        public double WeightGrams { get; set; }
        
        public bool IsMetalDetected { get; set; }
        
        [Range(0, 100)]
        public double HumidityPercent { get; set; }
        
        [Range(-40, 80)]
        public double TemperatureCelsius { get; set; } = 20.0;
        
        public bool IsMoist { get; set; }
        public bool IsTransparent { get; set; }
        public bool IsFlexible { get; set; }
        
        [Range(0, 1)]
        public double? IrTransparency { get; set; }
    }

    public class ExpertSystemResultDto
    {
        [Required]
        public string FinalClassification { get; set; } = string.Empty;
        
        [Range(0.0, 1.0)]
        public double Confidence { get; set; }
        
        [Required]
        public string DisposalLocation { get; set; } = string.Empty;
        
        public string Reasoning { get; set; } = string.Empty;
        
        [Range(0, 100)]
        public int CandidatesCount { get; set; }
        
        public List<string>? CandidateClasses { get; set; }
    }
}
