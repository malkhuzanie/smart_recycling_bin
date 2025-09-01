namespace SmartRecyclingBin.Models;

public class ClassificationSearchCriteria
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? Classification { get; set; }
    public double? MinConfidence { get; set; }
    public double? MaxConfidence { get; set; }
    public bool? IsOverridden { get; set; }
    public int? Limit { get; set; } = 100;
}