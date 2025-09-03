using SmartRecyclingBin.Models;
using SmartRecyclingBin.Models.DTOs;
using System.Text.Json;

namespace SmartRecyclingBin.Services
{
    public interface IClassificationService
    {
        Task<ClassificationResult> ProcessClassificationResultAsync(ClassificationRequestDto request);
        Task<ClassificationResult> ProcessClassificationResultAsync(JsonElement pythonResult);
        Task<PagedResult<ClassificationResult>> GetRecentClassificationsAsync(int page = 1, int pageSize = 50, string? filterBy = null);
        Task<ClassificationStatistics> GetStatisticsAsync(DateTime? fromDate = null, DateTime? toDate = null);
        Task<ClassificationResult?> GetClassificationAsync(int id);
        Task<bool> DeleteClassificationAsync(int id);
        Task<ValidationResult> ValidateClassificationDataAsync(ClassificationRequestDto request);
        Task<List<ClassificationResult>> SearchClassificationsAsync(ClassificationSearchCriteria criteria);
        Task<ClassificationResult?> GetClassificationWithImageAsync(int id);
        Task<string?> GetClassificationImageAsync(int id);
        Task<ImageStorageStats> GetImageStorageStatsAsync();
    }
}