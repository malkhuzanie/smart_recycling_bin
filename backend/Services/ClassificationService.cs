using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SmartRecyclingBin.Data;
using SmartRecyclingBin.Models;
using SmartRecyclingBin.Models.DTOs;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SmartRecyclingBin.Services
{
    public class ClassificationService : IClassificationService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ClassificationService> _logger;
        private readonly IMemoryCache _cache;
        private readonly INotificationService _notificationService;
        private readonly TimeSpan _cacheExpiry = TimeSpan.FromMinutes(5);
        private readonly IConfiguration _configuration;

        public ClassificationService(
            ApplicationDbContext context,
            ILogger<ClassificationService> logger,
            IMemoryCache cache,
            INotificationService notificationService,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _cache = cache;
            _notificationService = notificationService;
            _configuration = configuration;
        }

        /// <summary>
        /// 🖼️ Process classification result from Python service with image support
        /// </summary>
        public async Task<ClassificationResult> ProcessClassificationResultAsync(JsonElement pythonResult)
        {
            try
            {
                var result = new ClassificationResult
                {
                    Timestamp = DateTime.UtcNow,
                    DetectionId = GetStringProperty(pythonResult, "detection_id") ?? Guid.NewGuid().ToString()
                };

                if (pythonResult.TryGetProperty("image_data", out var imageData))
                {
                    await ProcessImageData(result, imageData);
                }

                // Process CNN prediction data
                if (pythonResult.TryGetProperty("cnn_prediction", out var cnnPrediction))
                {
                    ProcessCnnPrediction(result, cnnPrediction);
                }

                // Process sensor data
                if (pythonResult.TryGetProperty("sensor_data", out var sensorData))
                {
                    ProcessSensorData(result, sensorData);
                }

                // Process expert system results
                if (pythonResult.TryGetProperty("expert_system_result", out var expertResult))
                {
                    ProcessExpertSystemResult(result, expertResult);
                }

                // Process metadata
                if (pythonResult.TryGetProperty("processing_metadata", out var metadata))
                {
                    ProcessMetadata(result, metadata);
                }

                // Calculate processing time
                result.ProcessingTimeMs = GetDoubleProperty(pythonResult, "processing_time_ms");

                // Save to database
                _context.ClassificationResults.Add(result);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"✅ Classification saved: {result.FinalClassification} " +
                                       $"(ID: {result.Id}, Detection: {result.DetectionId}, " +
                                       $"HasImage: {result.HasImage})");

                // Clear relevant caches
                _cache.Remove("recent_classifications");

                // Send notification for the processed classification
                await _notificationService.NotifyClassificationProcessedAsync(result);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing classification result");
                throw;
            }
        }

        /// <summary>
        /// Process image data from Python service
        /// </summary>
        private async Task ProcessImageData(ClassificationResult result, JsonElement imageData)
        {
            try
            {
                var imageBase64 = GetStringProperty(imageData, "image_base64");
                if (string.IsNullOrEmpty(imageBase64))
                {
                    _logger.LogWarning($"No image data provided for detection {result.DetectionId}");
                    return;
                }

                // Validate Base64 format
                if (!IsValidBase64(imageBase64))
                {
                    _logger.LogError($"Invalid Base64 image data for detection {result.DetectionId}");
                    return;
                }

                // Check image size limits (e.g., max 10MB)
                var maxImageSizeBytes = _configuration.GetValue<long>("ImageStorage:MaxSizeBytes", 10 * 1024 * 1024);
                var imageSizeBytes = (long)(imageBase64.Length * 0.75); // Approximate decoded size

                if (imageSizeBytes > maxImageSizeBytes)
                {
                    _logger.LogWarning($"Image too large for detection {result.DetectionId}: " +
                                       $"{imageSizeBytes / 1024 / 1024}MB > {maxImageSizeBytes / 1024 / 1024}MB");

                    // Still store metadata but not the image
                    result.HasImage = false;
                    result.ImageSizeBytes = imageSizeBytes;
                    result.ImageCaptureTimestamp = DateTime.UtcNow;
                    return;
                }

                // Store image data
                result.ImageBase64 = imageBase64;
                result.HasImage = true;
                result.ImageSizeBytes = imageSizeBytes;
                result.ImageCaptureTimestamp = GetDateTimeProperty(imageData, "capture_timestamp") ?? DateTime.UtcNow;
                result.ImageFormat = GetStringProperty(imageData, "format") ?? "jpeg";
                result.ImageDimensions = GetStringProperty(imageData, "dimensions") ?? "";

                _logger.LogInformation($"📷 Image stored for detection {result.DetectionId}: " +
                                       $"{result.ImageFormat}, {result.ImageDimensions}, " +
                                       $"{result.ImageSizeBytes / 1024}KB");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing image data for detection {result.DetectionId}");
                result.HasImage = false;
            }
        }

        private void ProcessCnnPrediction(ClassificationResult result, JsonElement cnnPrediction)
        {
            // Handle both single stage and multi-stage CNN results
            if (cnnPrediction.TryGetProperty("stage1", out var stage1))
            {
                result.CnnPredictedClass = GetStringProperty(stage1, "predicted_class") ?? "";
                result.CnnConfidence = GetDoubleProperty(stage1, "confidence");
                result.CnnStage = 1;
            }
            else
            {
                result.CnnPredictedClass = GetStringProperty(cnnPrediction, "predicted_class") ?? "";
                result.CnnConfidence = GetDoubleProperty(cnnPrediction, "confidence");
                result.CnnStage = GetIntProperty(cnnPrediction, "stage");
            }
        }

        private void ProcessSensorData(ClassificationResult result, JsonElement sensorData)
        {
            result.WeightGrams = GetDoubleProperty(sensorData, "weight_grams");
            result.IsMetalDetected = GetBoolProperty(sensorData, "is_metal");
            result.HumidityPercent = GetDoubleProperty(sensorData, "humidity_percent");
            result.TemperatureCelsius = GetDoubleProperty(sensorData, "temperature_celsius");
            result.IsMoist = GetBoolProperty(sensorData, "is_moist");
            result.IsTransparent = GetBoolProperty(sensorData, "is_transparent");
            result.IsFlexible = GetBoolProperty(sensorData, "is_flexible");
        }

        private void ProcessExpertSystemResult(ClassificationResult result, JsonElement expertResult)
        {
            result.FinalClassification = GetStringProperty(expertResult, "final_classification") ?? "";
            result.FinalConfidence = GetDoubleProperty(expertResult, "confidence");
            result.DisposalLocation = GetStringProperty(expertResult, "disposal_location") ?? "";
            result.Reasoning = GetStringProperty(expertResult, "reasoning") ?? "";
            result.CandidatesCount = GetIntProperty(expertResult, "candidates_count");
        }

        private void ProcessMetadata(ClassificationResult result, JsonElement metadata)
        {
            var pipeline = new List<string>();

            if (metadata.TryGetProperty("stages_completed", out var stages))
            {
                foreach (var stage in stages.EnumerateArray())
                {
                    var stageStr = stage.GetString();
                    if (!string.IsNullOrEmpty(stageStr))
                        pipeline.Add(stageStr);
                }
            }

            result.ProcessingPipeline = string.Join(" → ", pipeline);

            // Store validation results as JSON
            if (metadata.TryGetProperty("validation_results", out var validation))
            {
                result.ValidationResults = validation.GetRawText();
            }
        }

        /// <summary>
        /// Get classification with full image data
        /// </summary>
        public async Task<ClassificationResult?> GetClassificationWithImageAsync(int id)
        {
            return await _context.ClassificationResults
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        /// <summary>
        /// Get classification image only (Base64 string)
        /// </summary>
        public async Task<string?> GetClassificationImageAsync(int id)
        {
            var classification = await _context.ClassificationResults
                .Where(c => c.Id == id && c.HasImage)
                .Select(c => c.ImageBase64)
                .FirstOrDefaultAsync();

            return classification;
        }

        /// <summary>
        /// Get recent classifications with image metadata (but not full image data for performance)
        /// </summary>
        public async Task<PagedResult<ClassificationResult>> GetRecentClassificationsAsync(
            int page = 1, int pageSize = 50, string? filterBy = null)
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

                // For list views, don't include the full ImageBase64 data for performance
                var results = await query
                    .OrderByDescending(c => c.Timestamp)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(c => new ClassificationResult
                    {
                        Id = c.Id,
                        DetectionId = c.DetectionId,
                        Timestamp = c.Timestamp,
                        CnnPredictedClass = c.CnnPredictedClass,
                        CnnConfidence = c.CnnConfidence,
                        CnnStage = c.CnnStage,
                        ProcessingTimeMs = c.ProcessingTimeMs,
                        WeightGrams = c.WeightGrams,
                        IsMetalDetected = c.IsMetalDetected,
                        HumidityPercent = c.HumidityPercent,
                        TemperatureCelsius = c.TemperatureCelsius,
                        IsMoist = c.IsMoist,
                        IsTransparent = c.IsTransparent,
                        IsFlexible = c.IsFlexible,
                        FinalClassification = c.FinalClassification,
                        FinalConfidence = c.FinalConfidence,
                        DisposalLocation = c.DisposalLocation,
                        Reasoning = c.Reasoning,
                        CandidatesCount = c.CandidatesCount,
                        ProcessingPipeline = c.ProcessingPipeline,
                        ValidationResults = c.ValidationResults,
                        IsOverridden = c.IsOverridden,
                        OverrideReason = c.OverrideReason,
                        OverriddenBy = c.OverriddenBy,
                        OverrideClassification = c.OverrideClassification,
                        OverrideTimestamp = c.OverrideTimestamp,
                        // Image metadata only (not full image data)
                        HasImage = c.HasImage,
                        ImageCaptureTimestamp = c.ImageCaptureTimestamp,
                        ImageSizeBytes = c.ImageSizeBytes,
                        ImageFormat = c.ImageFormat,
                        ImageDimensions = c.ImageDimensions,
                        ImageBase64 = null // Explicitly exclude for performance
                    })
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

        /// <summary>
        /// Get image storage statistics
        /// </summary>
        public async Task<ImageStorageStats> GetImageStorageStatsAsync()
        {
            return await _context.GetImageStorageStatsAsync();
        }

        // Helper methods with corrected JSON handling
        private static string? GetStringProperty(JsonElement element, string propertyName)
        {
            return element.TryGetProperty(propertyName, out var prop) ? prop.GetString() : null;
        }

        private static double GetDoubleProperty(JsonElement element, string propertyName)
        {
            return element.TryGetProperty(propertyName, out var prop) && prop.TryGetDouble(out var value) ? value : 0.0;
        }

        private static int GetIntProperty(JsonElement element, string propertyName)
        {
            return element.TryGetProperty(propertyName, out var prop) && prop.TryGetInt32(out var value) ? value : 0;
        }

        // Corrected boolean property handling for JsonElement
        private static bool GetBoolProperty(JsonElement element, string propertyName)
        {
            if (element.TryGetProperty(propertyName, out var prop))
            {
                switch (prop.ValueKind)
                {
                    case JsonValueKind.True:
                        return true;
                    case JsonValueKind.False:
                        return false;
                    case JsonValueKind.String:
                    {
                        string? stringValue = prop.GetString()?.ToLowerInvariant();
                        return stringValue is "true" or "1";
                    }
                    case JsonValueKind.Number:
                        return prop.GetInt32() != 0;
                }
            }

            return false;
        }

        private static DateTime? GetDateTimeProperty(JsonElement element, string propertyName)
        {
            if (element.TryGetProperty(propertyName, out var prop) && prop.TryGetDateTime(out var value))
                return value;

            if (element.TryGetProperty(propertyName, out var propStr))
            {
                var str = propStr.GetString();
                if (!string.IsNullOrEmpty(str) && DateTime.TryParse(str, out var parsed))
                    return parsed;
            }

            return null;
        }

        private static bool IsValidBase64(string base64)
        {
            if (string.IsNullOrEmpty(base64)) return false;

            try
            {
                // Basic Base64 validation
                if (base64.Length % 4 != 0) return false;

                // Check for valid Base64 characters
                if (!Regex.IsMatch(base64, @"^[A-Za-z0-9+/]*={0,2}$")) return false;

                // Try to decode a small portion to verify
                var testData = base64.Substring(0, Math.Min(100, base64.Length));
                Convert.FromBase64String(testData);

                return true;
            }
            catch
            {
                return false;
            }
        }

        // Implement other interface methods (using existing logic from your project)
        public async Task<ClassificationResult> ProcessClassificationResultAsync(ClassificationRequestDto request)
        {
            // Convert DTO to JsonElement for unified processing
            var jsonElement = JsonSerializer.SerializeToElement(request);
            return await ProcessClassificationResultAsync(jsonElement);
        }

        public async Task<ClassificationStatistics> GetStatisticsAsync(DateTime? fromDate = null,
            DateTime? toDate = null)
        {
            fromDate ??= DateTime.UtcNow.AddDays(-7);
            toDate ??= DateTime.UtcNow;

            var results = await _context.ClassificationResults
                .Where(c => c.Timestamp >= fromDate && c.Timestamp <= toDate)
                .ToListAsync();

            var stats = new ClassificationStatistics
            {
                TotalItems = results.Count,
                AccuracyRate = results.Count > 0 ? results.Average(r => r.FinalConfidence) : 0,
                AvgProcessingTime = results.Count > 0 ? results.Average(r => r.ProcessingTimeMs) : 0,
                OverrideRate = results.Count > 0 ? (double)results.Count(r => r.IsOverridden) / results.Count * 100 : 0,
                ItemsToday = results.Count(r => r.Timestamp.Date == DateTime.Today),
                ItemsThisWeek = results.Count(r => r.Timestamp >= DateTime.Today.AddDays(-7)),
                ItemsThisMonth = results.Count(r => r.Timestamp >= DateTime.Today.AddMonths(-1)),
                LastClassification = results.OrderByDescending(r => r.Timestamp).FirstOrDefault()?.Timestamp ??
                                     DateTime.MinValue
            };

            // Generate classification breakdown
            stats.ClassificationBreakdown = results
                .GroupBy(r => r.FinalClassification)
                .ToDictionary(g => g.Key, g => g.Count());

            return stats;
        }

        public async Task<ClassificationResult?> GetClassificationAsync(int id)
        {
            return await GetClassificationWithImageAsync(id);
        }

        public async Task<bool> DeleteClassificationAsync(int id)
        {
            try
            {
                var classification = await _context.ClassificationResults.FindAsync(id);
                if (classification == null) return false;

                _context.ClassificationResults.Remove(classification);
                await _context.SaveChangesAsync();

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

            return result;
        }

        public async Task<List<ClassificationResult>> SearchClassificationsAsync(ClassificationSearchCriteria criteria)
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

            if (criteria.HasImage.HasValue)
                query = query.Where(c => c.HasImage == criteria.HasImage.Value);

            if (!string.IsNullOrEmpty(criteria.DetectionId))
                query = query.Where(c => c.DetectionId.Contains(criteria.DetectionId));

            return await query
                .OrderByDescending(c => c.Timestamp)
                .Take(criteria.Limit ?? 100)
                .ToListAsync();
        }
    }
}