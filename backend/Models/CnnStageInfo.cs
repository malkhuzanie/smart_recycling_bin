using SmartRecyclingBin.Models.DTOs;

namespace SmartRecyclingBin.Models;

public class CnnStageInfo
{
    public CnnPredictionDto? Stage1Result { get; set; }
    public CnnPredictionDto? Stage2Result { get; set; }
    public double TotalConfidence { get; set; }
}