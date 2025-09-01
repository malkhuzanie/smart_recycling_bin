// Controllers/ClassificationController.cs
using Microsoft.AspNetCore.Mvc;
using SmartRecyclingBin.Models;
using SmartRecyclingBin.Models.DTOs;
using SmartRecyclingBin.Services;
using System.ComponentModel.DataAnnotations;
using ValidationResult = SmartRecyclingBin.Models.ValidationResult;

namespace SmartRecyclingBin.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    public class ClassificationController : ControllerBase
    {
        private readonly IClassificationService _classificationService;
        private readonly IOverrideService _overrideService;
        private readonly ILogger<ClassificationController> _logger;

        public ClassificationController(
            IClassificationService classificationService,
            IOverrideService overrideService,
            ILogger<ClassificationController> logger)
        {
            _classificationService = classificationService;
            _overrideService = overrideService;
            _logger = logger;
        }

        /// <summary>
        /// Process a new classification request
        /// </summary>
        /// <param name="request">Classification data from Python services</param>
        /// <returns>Processed classification result</returns>
        [HttpPost]
        public async Task<ActionResult<ClassificationResult>> ProcessClassification(
            [FromBody] ClassificationRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _classificationService.ProcessClassificationResultAsync(request);
                
                _logger.LogInformation("Classification processed successfully: {Id}", result.Id);
                
                return CreatedAtAction(
                    nameof(GetClassification), 
                    new { id = result.Id }, 
                    result);
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid classification request");
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing classification");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Get recent classification results with pagination and filtering
        /// </summary>
        /// <param name="page">Page number (1-based)</param>
        /// <param name="pageSize">Number of items per page</param>
        /// <param name="filterBy">Filter by classification type</param>
        /// <returns>Paginated list of classifications</returns>
        [HttpGet("recent")]
        public async Task<ActionResult<PagedResult<ClassificationResult>>> GetRecentClassifications(
            [FromQuery, Range(1, int.MaxValue)] int page = 1,
            [FromQuery, Range(1, 100)] int pageSize = 50,
            [FromQuery] string? filterBy = null)
        {
            try
            {
                var results = await _classificationService.GetRecentClassificationsAsync(page, pageSize, filterBy);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recent classifications");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Search classifications with advanced criteria
        /// </summary>
        /// <param name="criteria">Search criteria</param>
        /// <returns>List of matching classifications</returns>
        [HttpPost("search")]
        public async Task<ActionResult<List<ClassificationResult>>> SearchClassifications(
            [FromBody] ClassificationSearchCriteria criteria)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var results = await _classificationService.SearchClassificationsAsync(criteria);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching classifications");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Get classification statistics for a date range
        /// </summary>
        /// <param name="fromDate">Start date (optional)</param>
        /// <param name="toDate">End date (optional)</param>
        /// <returns>Classification statistics</returns>
        [HttpGet("statistics")]
        public async Task<ActionResult<ClassificationStatistics>> GetStatistics(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var stats = await _classificationService.GetStatisticsAsync(fromDate, toDate);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving statistics");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Get a specific classification by ID
        /// </summary>
        /// <param name="id">Classification ID</param>
        /// <returns>Classification result</returns>
        [HttpGet("{id:int}")]
        public async Task<ActionResult<ClassificationResult>> GetClassification(int id)
        {
            if (id <= 0)
            {
                return BadRequest(new { error = "Invalid classification ID" });
            }

            try
            {
                var classification = await _classificationService.GetClassificationAsync(id);
                
                if (classification == null)
                {
                    return NotFound(new { error = $"Classification with ID {id} not found" });
                }
                
                return Ok(classification);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving classification {Id}", id);
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Apply manual override to a classification
        /// </summary>
        /// <param name="request">Override request details</param>
        /// <returns>Success response</returns>
        [HttpPost("override")]
        public async Task<ActionResult> ApplyOverride([FromBody] ManualOverrideRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var success = await _overrideService.ApplyManualOverrideAsync(request);

                if (success)
                {
                    _logger.LogInformation("Manual override applied successfully for classification {Id} by {User}", 
                        request.ClassificationId, request.UserId);
                    
                    return Ok(new { 
                        message = "Override applied successfully",
                        classificationId = request.ClassificationId,
                        newClassification = request.NewClassification
                    });
                }
                else
                {
                    return NotFound(new { error = "Classification not found" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error applying manual override for classification {Id}", 
                    request.ClassificationId);
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Get classifications that have been overridden
        /// </summary>
        /// <param name="count">Number of results to return</param>
        /// <returns>List of overridden classifications</returns>
        [HttpGet("overrides")]
        public async Task<ActionResult<List<ClassificationResult>>> GetOverriddenClassifications(
            [FromQuery, Range(1, 100)] int count = 50)
        {
            try
            {
                var results = await _overrideService.GetOverriddenClassificationsAsync(count);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving overridden classifications");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Delete a classification (admin only)
        /// </summary>
        /// <param name="id">Classification ID to delete</param>
        /// <returns>Success response</returns>
        [HttpDelete("{id:int}")]
        public async Task<ActionResult> DeleteClassification(int id)
        {
            if (id <= 0)
            {
                return BadRequest(new { error = "Invalid classification ID" });
            }

            try
            {
                var success = await _classificationService.DeleteClassificationAsync(id);
                
                if (success)
                {
                    _logger.LogInformation("Classification {Id} deleted successfully", id);
                    return Ok(new { 
                        message = "Classification deleted successfully",
                        deletedId = id
                    });
                }
                else
                {
                    return NotFound(new { error = "Classification not found" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting classification {Id}", id);
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Validate classification data without processing
        /// </summary>
        /// <param name="request">Classification data to validate</param>
        /// <returns>Validation result</returns>
        [HttpPost("validate")]
        public async Task<ActionResult<ValidationResult>> ValidateClassificationData(
            [FromBody] ClassificationRequestDto request)
        {
            try
            {
                var validation = await _classificationService.ValidateClassificationDataAsync(request);
                return Ok(validation);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating classification data");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Get classification summary for today
        /// </summary>
        /// <returns>Today's classification summary</returns>
        [HttpGet("today")]
        public async Task<ActionResult<object>> GetTodaysClassifications()
        {
            try
            {
                var today = DateTime.Today;
                var tomorrow = today.AddDays(1);
                
                var results = await _classificationService.SearchClassificationsAsync(new ClassificationSearchCriteria
                {
                    FromDate = today,
                    ToDate = tomorrow,
                    Limit = 1000
                });

                var summary = new
                {
                    Date = today.ToString("yyyy-MM-dd"),
                    TotalItems = results.Count,
                    Classifications = results
                        .GroupBy(r => r.FinalClassification)
                        .ToDictionary(g => g.Key, g => g.Count()),
                    AverageConfidence = results.Count > 0 ? results.Average(r => r.FinalConfidence) : 0,
                    OverrideCount = results.Count(r => r.IsOverridden),
                    OverrideRate = results.Count > 0 ? (double)results.Count(r => r.IsOverridden) / results.Count * 100 : 0
                };

                return Ok(summary);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving today's classifications");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        /// <summary>
        /// Export classifications to CSV format
        /// </summary>
        /// <param name="fromDate">Start date for export</param>
        /// <param name="toDate">End date for export</param>
        /// <returns>CSV file</returns>
        [HttpGet("export")]
        public async Task<IActionResult> ExportClassifications(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                fromDate ??= DateTime.UtcNow.AddDays(-30);
                toDate ??= DateTime.UtcNow;

                var criteria = new ClassificationSearchCriteria
                {
                    FromDate = fromDate,
                    ToDate = toDate,
                    Limit = 10000
                };

                var results = await _classificationService.SearchClassificationsAsync(criteria);

                var csvContent = GenerateCsvContent(results);
                var bytes = System.Text.Encoding.UTF8.GetBytes(csvContent);

                var fileName = $"classifications_{fromDate:yyyy-MM-dd}_{toDate:yyyy-MM-dd}.csv";

                return File(bytes, "text/csv", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting classifications");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        private string GenerateCsvContent(List<ClassificationResult> results)
        {
            var csv = new System.Text.StringBuilder();
            
            // Header
            csv.AppendLine("Id,Timestamp,CnnPredictedClass,CnnConfidence,FinalClassification,FinalConfidence,DisposalLocation,WeightGrams,IsMetalDetected,IsOverridden,ProcessingTimeMs");
            
            // Data rows
            foreach (var result in results)
            {
                csv.AppendLine($"{result.Id}," +
                              $"{result.Timestamp:yyyy-MM-dd HH:mm:ss}," +
                              $"\"{result.CnnPredictedClass}\"," +
                              $"{result.CnnConfidence:F3}," +
                              $"\"{result.FinalClassification}\"," +
                              $"{result.FinalConfidence:F3}," +
                              $"\"{result.DisposalLocation}\"," +
                              $"{result.WeightGrams:F1}," +
                              $"{result.IsMetalDetected}," +
                              $"{result.IsOverridden}," +
                              $"{result.ProcessingTimeMs:F1}");
            }
            
            return csv.ToString();
        }
    }
}