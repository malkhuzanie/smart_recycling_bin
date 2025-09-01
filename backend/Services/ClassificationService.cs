using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SmartRecyclingBin.Data;
using SmartRecyclingBin.Models;
using SmartRecyclingBin.Models.DTOs;
using System.Text.Json;

namespace SmartRecyclingBin.Services
{
    public class ClassificationService : IClassificationService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ClassificationService> _logger;
        private readonly IMemoryCache _cache;
        private readonly INotificationService _notificationService;
        private readonly TimeSpan _cacheExpiry = TimeSpan.FromMinutes(5);

        public ClassificationService(
            ApplicationDbContext context, 
            ILogger<ClassificationService> logger,
            IMemoryCache cache,
            INotificationService notificationService)
        {
            _context = context;
            _logger = logger;
            _cache = cache;
            _notificationService = notificationService;
        }

        public async Task<ClassificationResult> ProcessClassificationResultAsync(ClassificationRequestDto request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var validation = await ValidateClassificationDataAsync(request);
            if (!validation.IsValid)
            {
                throw new ArgumentException($"Invalid classification data: {string.Join(", ", validation.Errors)}");
            }

            try
            {
                var result = new ClassificationResult
                {
                    Timestamp = DateTime.UtcNow,
                    
                    // CNN Prediction data
                    CnnPredictedClass = request.CnnPrediction?.PredictedClass ?? "",
                    CnnConfidence = request.CnnPrediction?.Confidence ?? 0.0,
                    CnnStage = request.CnnPrediction?.Stage ?? 1,
                    ProcessingTimeMs = request.CnnPrediction?.ProcessingTimeMs ?? 0.0,
                    
                    // Sensor data
                    WeightGrams = request.SensorData?.WeightGrams ?? 0.0,
                    IsMetalDetected = request.SensorData?.IsMetalDetected ?? false,
                    HumidityPercent = request.SensorData?.HumidityPercent ?? 0.0,
                    TemperatureCelsius = request.SensorData?.TemperatureCelsius ?? 20.0,
                    IsMoist = request.SensorData?.IsMoist ?? false,
                    IsTransparent = request.SensorData?.IsTransparent ?? false,
                    IsFlexible = request.SensorData?.IsFlexible ?? false,
                    
                    // Expert system results
                    FinalClassification = request.ExpertSystemResult?.FinalClassification ?? "",
                    FinalConfidence = request.ExpertSystemResult?.Confidence ?? 0.0,
                    DisposalLocation = request.ExpertSystemResult?.DisposalLocation ?? "",
                    Reasoning = request.ExpertSystemResult?.Reasoning ?? "",
                    CandidatesCount = request.ExpertSystemResult?.CandidatesCount ?? 0
                };

                _context.ClassificationResults.Add(result);
                await _context.SaveChangesAsync();

                // Clear cache to ensure fresh data
                _cache.Remove("recent_classifications");
                _cache.Remove($"statistics_{DateTime.Today:yyyy-MM-dd}");

                // Send notification for low confidence classifications
                if (result.FinalConfidence < 0.7)
                {
                    await _notificationService.AddAlert(new SystemAlert
                    {
                        Severity = "WARNING",
                        Component = "Classification",
                        Message = $"Low confidence classification: {result.FinalClassification} ({result.FinalConfidence:P1})"
                    });
                }

                _logger.LogInformation("Processed classification result: ID {Id}, Classification: {Classification}, Confidence: {Confidence:F2}", 
                    result.Id, result.FinalClassification, result.FinalConfidence);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing classification result");
                await _notificationService.AddAlert(new SystemAlert
                {
                    Severity = "ERROR",
                    Component = "Classification",
                    Message = $"Failed to process classification: {ex.Message}"
                });
                throw;
            }
        }

        public async Task<ClassificationResult> ProcessClassificationResultAsync(JsonElement pythonResult)
        {
            try
            {
                var request = MapJsonToDto(pythonResult);
                return await ProcessClassificationResultAsync(request);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Error parsing JSON classification result");
                throw new ArgumentException("Invalid JSON format for classification result", ex);
            }
        }

        public async Task<PagedResult<ClassificationResult>> GetRecentClassificationsAsync(int page = 1, int pageSize = 50, string? filterBy = null)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 50;

            try
            {
                var cacheKey = $"recent_classifications_p{page}_s{pageSize}_f{filterBy}";
                
                if (_cache.TryGetValue(cacheKey, out PagedResult<ClassificationResult>? cached) && cached != null)
                {
                    return cached;
                }

                var query = _context.ClassificationResults.AsQueryable();

                if (!string.IsNullOrEmpty(filterBy))
                {
                    query = query.Where(c => c.FinalClassification.Contains(filterBy) || 
                                           c.CnnPredictedClass.Contains(filterBy));
                }

                var totalCount = await query.CountAsync();
                var results = await query
                    .OrderByDescending(c => c.Timestamp)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var pagedResult = new PagedResult<ClassificationResult>
                {
                    Items = results,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                };

                _cache.Set(cacheKey, pagedResult, _cacheExpiry);
                return pagedResult;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recent classifications");
                throw;
            }
        }

        public async Task<ClassificationStatistics> GetStatisticsAsync(DateTime? fromDate = null, DateTime? toDate = null)
        {
            try
            {
                fromDate ??= DateTime.UtcNow.AddDays(-7);
                toDate ??= DateTime.UtcNow;

                var cacheKey = $"statistics_{fromDate:yyyy-MM-dd}_{toDate:yyyy-MM-dd}";
                
                if (_cache.TryGetValue(cacheKey, out ClassificationStatistics? cached) && cached != null)
                {
                    return cached;
                }

                var results = await _context.ClassificationResults
                    .Where(c => c.Timestamp >= fromDate && c.Timestamp <= toDate)
                    .ToListAsync();

                var stats = new ClassificationStatistics
                {
                    TotalItems = results.Count,
                    AccuracyRate = results.Count > 0 ? results.Average(r => r.FinalConfidence) : 0,
                    AvgProcessingTime = results.Count > 0 ? results.Average(r => r.ProcessingTimeMs) : 0,
                    ClassificationBreakdown = results
                        .GroupBy(r => r.FinalClassification)
                        .ToDictionary(g => g.Key, g => g.Count()),
                    OverrideRate = results.Count > 0 ? 
                        (double)results.Count(r => r.IsOverridden) / results.Count * 100 : 0,
                    ItemsToday = results.Count(r => r.Timestamp.Date == DateTime.Today),
                    ItemsThisWeek = results.Count(r => r.Timestamp >= DateTime.Today.AddDays(-7)),
                    ItemsThisMonth = results.Count(r => r.Timestamp >= DateTime.Today.AddMonths(-1)),
                    LastClassification = results.OrderByDescending(r => r.Timestamp).FirstOrDefault()?.Timestamp ?? DateTime.MinValue,
                    HourlyBreakdown = GenerateHourlyBreakdown(results, fromDate.Value, toDate.Value)
                };

                _cache.Set(cacheKey, stats, _cacheExpiry);
                return stats;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating classification statistics");
                throw;
            }
        }

        public async Task<ClassificationResult?> GetClassificationAsync(int id)
        {
            try
            {
                return await _context.ClassificationResults.FindAsync(id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving classification with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> DeleteClassificationAsync(int id)
        {
            try
            {
                var classification = await _context.ClassificationResults.FindAsync(id);
                if (classification == null) 
                    return false;

                _context.ClassificationResults.Remove(classification);
                await _context.SaveChangesAsync();

                // Clear relevant caches
                _cache.Remove("recent_classifications");
                
                _logger.LogInformation("Deleted classification with ID {Id}", id);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting classification with ID {Id}", id);
                throw;
            }
        }

        public async Task<ValidationResult> ValidateClassificationDataAsync(ClassificationRequestDto request)
        {
            var result = new ValidationResult { IsValid = true };

            if (request == null)
            {
                result.IsValid = false;
                result.Errors.Add("Classification request cannot be null");
                return result;
            }

            // Validate CNN prediction
            if (request.CnnPrediction != null)
            {
                if (request.CnnPrediction.Confidence is < 0 or > 1)
                {
                    result.IsValid = false;
                    result.Errors.Add("CNN confidence must be between 0 and 1");
                }

                if (string.IsNullOrEmpty(request.CnnPrediction.PredictedClass))
                {
                    result.IsValid = false;
                    result.Errors.Add("CNN predicted class cannot be empty");
                }
            }

            // Validate sensor data ranges
            if (request.SensorData != null)
            {
                if (request.SensorData.WeightGrams is < 0 or > 10000) // 10kg max
                {
                    result.IsValid = false;
                    result.Errors.Add("Weight must be between 0 and 10000 grams");
                }

                if (request.SensorData.HumidityPercent is < 0 or > 100)
                {
                    result.IsValid = false;
                    result.Errors.Add("Humidity must be between 0 and 100 percent");
                }

                if (request.SensorData.TemperatureCelsius is < -40 or > 80)
                {
                    result.IsValid = false;
                    result.Errors.Add("Temperature must be between -40 and 80 degrees Celsius");
                }
            }

            // Validate expert system result
            if (request.ExpertSystemResult != null)
            {
                if (request.ExpertSystemResult.Confidence < 0 || request.ExpertSystemResult.Confidence > 1)
                {
                    result.IsValid = false;
                    result.Errors.Add("Expert system confidence must be between 0 and 1");
                }
            }

            return await Task.FromResult(result);
        }

        public async Task<List<ClassificationResult>> SearchClassificationsAsync(ClassificationSearchCriteria criteria)
        {
            try
            {
                var query = _context.ClassificationResults.AsQueryable();

                if (criteria.FromDate.HasValue)
                    query = query.Where(c => c.Timestamp >= criteria.FromDate.Value);

                if (criteria.ToDate.HasValue)
                    query = query.Where(c => c.Timestamp <= criteria.ToDate.Value);

                if (!string.IsNullOrEmpty(criteria.Classification))
                    query = query.Where(c => c.FinalClassification.Contains(criteria.Classification));

                if (criteria.MinConfidence.HasValue)
                    query = query.Where(c => c.FinalConfidence >= criteria.MinConfidence.Value);

                if (criteria.MaxConfidence.HasValue)
                    query = query.Where(c => c.FinalConfidence <= criteria.MaxConfidence.Value);

                if (criteria.IsOverridden.HasValue)
                    query = query.Where(c => c.IsOverridden == criteria.IsOverridden.Value);

                return await query
                    .OrderByDescending(c => c.Timestamp)
                    .Take(criteria.Limit ?? 100)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching classifications");
                throw;
            }
        }

        private ClassificationRequestDto MapJsonToDto(JsonElement pythonResult)
        {
            var request = new ClassificationRequestDto();

            // Map CNN prediction
            if (pythonResult.TryGetProperty("cnn_prediction", out var cnnPrediction))
            {
                request.CnnPrediction = new CnnPredictionDto
                {
                    PredictedClass = GetStringProperty(cnnPrediction, "predicted_class"),
                    Confidence = GetDoubleProperty(cnnPrediction, "confidence"),
                    Stage = GetIntProperty(cnnPrediction, "stage"),
                    ProcessingTimeMs = GetDoubleProperty(cnnPrediction, "processing_time_ms")
                };
            }

            // Map sensor data
            if (pythonResult.TryGetProperty("sensor_data", out var sensorData))
            {
                request.SensorData = new SensorDataDto
                {
                    WeightGrams = GetDoubleProperty(sensorData, "weight_grams"),
                    IsMetalDetected = GetBoolProperty(sensorData, "is_metal"),
                    HumidityPercent = GetDoubleProperty(sensorData, "humidity_percent"),
                    TemperatureCelsius = GetDoubleProperty(sensorData, "temperature_celsius"),
                    IsMoist = GetBoolProperty(sensorData, "is_moist"),
                    IsTransparent = GetBoolProperty(sensorData, "is_transparent"),
                    IsFlexible = GetBoolProperty(sensorData, "is_flexible")
                };
            }

            // Map expert system result
            if (pythonResult.TryGetProperty("expert_system_result", out var expertResult))
            {
                request.ExpertSystemResult = new ExpertSystemResultDto
                {
                    FinalClassification = GetStringProperty(expertResult, "final_classification"),
                    Confidence = GetDoubleProperty(expertResult, "confidence"),
                    DisposalLocation = GetStringProperty(expertResult, "disposal_location"),
                    Reasoning = GetStringProperty(expertResult, "reasoning"),
                    CandidatesCount = GetIntProperty(expertResult, "candidates_count")
                };
            }

            return request;
        }

        private List<HourlyStats> GenerateHourlyBreakdown(List<ClassificationResult> results, DateTime fromDate, DateTime toDate)
        {
            var hours = new List<HourlyStats>();
            
            for (var hour = fromDate.Date; hour <= toDate; hour = hour.AddHours(1))
            {
                var hourResults = results.Where(r => r.Timestamp >= hour && r.Timestamp < hour.AddHours(1)).ToList();
                
                hours.Add(new HourlyStats
                {
                    Hour = hour,
                    Count = hourResults.Count,
                    AvgAccuracy = hourResults.Count > 0 ? hourResults.Average(r => r.FinalConfidence) : 0
                });
            }

            return hours.Where(h => h.Count > 0).ToList();
        }

        // Helper methods for safe property extraction
        private string GetStringProperty(JsonElement element, string propertyName) =>
            element.TryGetProperty(propertyName, out var prop) ? prop.GetString() ?? "" : "";

        private double GetDoubleProperty(JsonElement element, string propertyName) =>
            element.TryGetProperty(propertyName, out var prop) ? prop.GetDouble() : 0.0;

        private bool GetBoolProperty(JsonElement element, string propertyName) =>
            element.TryGetProperty(propertyName, out var prop) && prop.GetBoolean();

        private int GetIntProperty(JsonElement element, string propertyName) =>
            element.TryGetProperty(propertyName, out var prop) ? prop.GetInt32() : 0;
    }
}