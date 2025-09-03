using SmartRecyclingBin.Models;
using SmartRecyclingBin.Models.DTOs;
using ClassificationWithImageDto = SmartRecyclingBin.Models.DTOs.ClassificationWithImageDto;

namespace SmartRecyclingBin.Extensions
{
    public static class ClassificationMappingExtensions
    {
        public static ClassificationResponseDto ToResponseDto(this ClassificationResult result)
        {
            return new ClassificationResponseDto
            {
                Id = result.Id,
                DetectionId = result.DetectionId,
                Timestamp = result.Timestamp,
                FinalClassification = result.FinalClassification,
                FinalConfidence = result.FinalConfidence,
                DisposalLocation = result.DisposalLocation,
                Reasoning = result.Reasoning,
                IsOverridden = result.IsOverridden,
                ProcessingTimeMs = result.ProcessingTimeMs,
                HasImage = result.HasImage,
                
                ProcessingPipeline = result.ProcessingPipeline ?? "",
                ValidationResults = result.ValidationResults ?? "{}",
                
                CnnPrediction = string.IsNullOrEmpty(result.CnnPredictedClass) ? null : new CnnPredictionDto
                {
                    PredictedClass = result.CnnPredictedClass ?? "",
                    Confidence = result.CnnConfidence,
                    Stage = result.CnnStage,
                    ProcessingTimeMs = result.ProcessingTimeMs
                },
                
                SensorData = new SensorDataDto
                {
                    WeightGrams = result.WeightGrams,
                    IsMetalDetected = result.IsMetalDetected,
                    HumidityPercent = result.HumidityPercent,
                    TemperatureCelsius = result.TemperatureCelsius,
                    IsMoist = result.IsMoist,
                    IsTransparent = result.IsTransparent,
                    IsFlexible = result.IsFlexible,
                    IrTransparency = result.IrTransparency
                },
                
                // Image metadata (without actual image data for performance)
                ImageMetadata = result.HasImage ? new ImageMetadataDto
                {
                    HasImage = true,
                    ImageSizeBytes = result.ImageSizeBytes,
                    ImageFormat = result.ImageFormat,
                    ImageDimensions = result.ImageDimensions,
                    ImageCaptureTimestamp = result.ImageCaptureTimestamp
                } : new ImageMetadataDto { HasImage = false },

                // Override information
                OverrideReason = result.OverrideReason,
                OverrideClassification = result.OverrideClassification,
                OverrideTimestamp = result.OverrideTimestamp,
                OverrideUserId = result.OverrideUserId
            };
        }

        /// <summary>
        /// Convert ClassificationResult entity to ClassificationWithImageDto with full image data
        /// USES EXISTING SensorDataDto - NO DUPLICATES!
        /// </summary>
        public static ClassificationWithImageDto ToImageDto(this ClassificationResult result)
        {
            return new ClassificationWithImageDto
            {
                Id = result.Id,
                DetectionId = result.DetectionId,
                Timestamp = result.Timestamp,
                FinalClassification = result.FinalClassification,
                FinalConfidence = result.FinalConfidence,
                DisposalLocation = result.DisposalLocation,
                Reasoning = result.Reasoning,
                ProcessingTimeMs = result.ProcessingTimeMs,
                
                // Image data - full image information
                HasImage = result.HasImage,
                ImageBase64 = result.ImageBase64,
                ImageFormat = result.ImageFormat,
                ImageDimensions = result.ImageDimensions,
                ImageCaptureTimestamp = result.ImageCaptureTimestamp,
                ImageSizeBytes = result.ImageSizeBytes,
                
                // ✅ Sensor data - USING EXISTING SensorDataDto
                SensorData = new SensorDataDto
                {
                    WeightGrams = result.WeightGrams,
                    IsMetalDetected = result.IsMetalDetected,
                    HumidityPercent = result.HumidityPercent,
                    TemperatureCelsius = result.TemperatureCelsius,
                    IsMoist = result.IsMoist,
                    IsTransparent = result.IsTransparent,
                    IsFlexible = result.IsFlexible,
                    IrTransparency = result.IrTransparency
                },
                
                // Processing metadata
                ProcessingPipeline = result.ProcessingPipeline ?? "",
                ValidationResults = result.ValidationResults ?? "{}"
            };
        }

        /// <summary>
        /// Convert a list of ClassificationResult entities to ClassificationResponseDto list
        /// </summary>
        public static List<ClassificationResponseDto> ToResponseDtoList(this IEnumerable<ClassificationResult> results)
        {
            return results.Select(r => r.ToResponseDto()).ToList();
        }

        /// <summary>
        /// Create a PagedResult of ClassificationResponseDto from ClassificationResult entities
        /// </summary>
        public static PagedResult<ClassificationResponseDto> ToPagedResponseDto(
            this PagedResult<ClassificationResult> pagedResults)
        {
            return new PagedResult<ClassificationResponseDto>
            {
                Items = pagedResults.Items.ToResponseDtoList(),
                TotalCount = pagedResults.TotalCount,
                PageSize = pagedResults.PageSize,
                Page = pagedResults.Page,
                TotalPages = pagedResults.TotalPages,
            };
        }

        /// <summary>
        /// Helper method to create a CnnStageInfo from ClassificationResult
        /// USES EXISTING CnnPredictionDto - NO DUPLICATES!
        /// </summary>
        public static CnnStageInfo ToCnnStageInfo(this ClassificationResult result)
        {
            return new CnnStageInfo
            {
                Stage1Result = string.IsNullOrEmpty(result.CnnPredictedClass) ? null : new CnnPredictionDto
                {
                    PredictedClass = result.CnnPredictedClass ?? "",
                    Confidence = result.CnnConfidence,
                    Stage = result.CnnStage,
                    ProcessingTimeMs = result.ProcessingTimeMs
                },
                TotalConfidence = result.CnnConfidence
            };
        }
    }
}