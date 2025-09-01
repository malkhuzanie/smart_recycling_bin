using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization; 

namespace SmartRecyclingBin.Models.DTOs
{
    public class ClassificationRequestDto
    {
        [JsonPropertyName("cnn_prediction")]
        public CnnPredictionDto? CnnPrediction { get; set; }

        [JsonPropertyName("sensor_data")]
        public SensorDataDto? SensorData { get; set; }

        [JsonPropertyName("expert_system_result")]
        public ExpertSystemResultDto? ExpertSystemResult { get; set; }
        
        [JsonPropertyName("timestamp")] 
        public DateTime? Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class CnnPredictionDto
    {
        [JsonPropertyName("predicted_class")] 
        [Required]
        public string PredictedClass { get; set; } = string.Empty;
        
        [JsonPropertyName("confidence")] 
        [Range(0.0, 1.0)]
        public double Confidence { get; set; }
        
        [JsonPropertyName("stage")] 
        [Range(1, 5)]
        public int Stage { get; set; } = 1;
        
        [JsonPropertyName("processing_time_ms")] 
        [Range(0, double.MaxValue)]
        public double ProcessingTimeMs { get; set; }
        
        [JsonPropertyName("class_probabilities")] 
        public Dictionary<string, double>? ClassProbabilities { get; set; }
    }

    public class SensorDataDto
    {
        [JsonPropertyName("weight_grams")] 
        [Range(0, 10000)]
        public double WeightGrams { get; set; }
        
        [JsonPropertyName("is_metal")] 
        public bool IsMetalDetected { get; set; }
        
        [JsonPropertyName("humidity_percent")] 
        [Range(0, 100)]
        public double HumidityPercent { get; set; }
        
        [JsonPropertyName("temperature_celsius")] 
        [Range(-40, 80)]
        public double TemperatureCelsius { get; set; } = 20.0;
        
        [JsonPropertyName("is_moist")] 
        public bool IsMoist { get; set; }

        [JsonPropertyName("is_transparent")] 
        public bool IsTransparent { get; set; }

        [JsonPropertyName("is_flexible")] 
        public bool IsFlexible { get; set; }
        
        [JsonPropertyName("ir_transparency")] 
        [Range(0, 1)]
        public double? IrTransparency { get; set; }
    }

    public class ExpertSystemResultDto
    {
        [JsonPropertyName("final_classification")] 
        [Required]
        public string FinalClassification { get; set; } = string.Empty;
        
        [JsonPropertyName("confidence")] 
        [Range(0.0, 1.0)]
        public double Confidence { get; set; }
        
        [JsonPropertyName("disposal_location")] 
        [Required]
        public string DisposalLocation { get; set; } = string.Empty;
        
        [JsonPropertyName("reasoning")] 
        public string Reasoning { get; set; } = string.Empty;
        
        [JsonPropertyName("candidates_count")] 
        [Range(0, 100)]
        public int CandidatesCount { get; set; }
        
        [JsonPropertyName("candidate_classes")] 
        public List<string>? CandidateClasses { get; set; }
    }
}
