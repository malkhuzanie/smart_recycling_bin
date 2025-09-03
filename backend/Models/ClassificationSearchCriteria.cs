namespace SmartRecyclingBin.Models;

public class ClassificationSearchCriteria
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? Classification { get; set; }
    public double? MinConfidence { get; set; }
    public double? MaxConfidence { get; set; }
    public bool? IsOverridden { get; set; }
    public bool? HasImage { get; set; } // 🖼️ NEW: Filter by image presence
    public string? DetectionId { get; set; } // 🖼️ NEW: Search by detection ID
    public long? MinImageSize { get; set; } // 🖼️ NEW: Filter by image size
    public long? MaxImageSize { get; set; } // 🖼️ NEW: Filter by image size
    public string? ImageFormat { get; set; } // 🖼️ NEW: Filter by image format
    public int? Limit { get; set; } = 100;
    public int? Offset { get; set; } = 0;
    public string? SortBy { get; set; } = "timestamp";
    public bool SortDescending { get; set; } = true;
}