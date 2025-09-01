using Microsoft.AspNetCore.SignalR;
using System.Text.Json;
using SmartRecyclingBin.Models;
using SmartRecyclingBin.Services;
using SmartRecyclingBin.Models.DTOs;

namespace SmartRecyclingBin.Hubs
{
    /// <summary>
    /// SignalR Hub for real-time waste classification communication
    /// Handles communication between Python services, dashboard, and manual override devices
    /// </summary>
    public class ClassificationHub : Hub
    {
        private readonly IClassificationService _classificationService;
        private readonly IOverrideService _overrideService;
        private readonly INotificationService _notificationService;
        private readonly ILogger<ClassificationHub> _logger;

        public ClassificationHub(
            IClassificationService classificationService,
            IOverrideService overrideService,
            INotificationService notificationService,
            ILogger<ClassificationHub> logger)
        {
            _classificationService = classificationService;
            _overrideService = overrideService;
            _notificationService = notificationService;
            _logger = logger;
        }

        /// <summary>
        /// Handle classification results from Python services
        /// </summary>
        public async Task SendClassificationResult(string jsonData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            try
            {
                _logger.LogInformation("Received classification result from {ClientType} client {ConnectionId}", 
                    clientType, connectionId);
                
                var classificationData = JsonSerializer.Deserialize<EnhancedClassificationRequestDto>(jsonData);
                
                if (classificationData == null)
                {
                    _logger.LogWarning("Null classification data received from connection {ConnectionId}", connectionId);
                    await Clients.Caller.SendAsync("Error", "Classification data is null");
                    return;
                }

                // Map enhanced data structure to existing DTO for processing
                var standardRequest = MapEnhancedToStandard(classificationData);
                
                var result = await _classificationService.ProcessClassificationResultAsync(standardRequest);
                
                // Create enhanced response with validation results from sensor data
                var validationResults = CreateValidationResults(classificationData);
                
                var responseDto = new EnhancedClassificationResponseDto
                {
                    Id = result.Id,
                    DetectionId = classificationData.DetectionId ?? $"detection_{result.Id}",
                    Timestamp = result.Timestamp,
                    FinalClassification = result.FinalClassification,
                    FinalConfidence = result.FinalConfidence,
                    DisposalLocation = result.DisposalLocation,
                    Reasoning = result.Reasoning,
                    IsOverridden = result.IsOverridden,
                    ProcessingTimeMs = result.ProcessingTimeMs,
                    
                    // Enhanced fields
                    ProcessingPipeline = classificationData.ProcessingMetadata?.StagesCompleted?.ToArray() ?? new string[0],
                    ValidationResults = validationResults,
                    CnnStages = new CnnStageInfo
                    {
                        Stage1Result = classificationData.CnnPrediction?.Stage1,
                        Stage2Result = classificationData.CnnPrediction?.Stage2,
                        TotalConfidence = classificationData.CnnPrediction?.TotalConfidence ?? 0.0
                    },
                    
                    SensorData = classificationData.SensorData,
                    
                    Metadata = new Dictionary<string, object>
                    {
                        { "ProcessedAt", DateTime.UtcNow },
                        { "ConnectionId", connectionId },
                        { "ClientType", clientType },
                        { "PipelineVersion", classificationData.ProcessingMetadata?.PipelineVersion ?? "unknown" },
                        { "ProcessingNode", classificationData.ProcessingMetadata?.ProcessingNode ?? "unknown" },
                        { "FallbackUsed", classificationData.ProcessingMetadata?.FallbackUsed ?? false }
                    }
                };
                
                // Send to all clients in Classification group
                await Clients.Group("Classification").SendAsync("ClassificationResult", responseDto);
                
                // Send enhanced data to dashboard group
                var dashboardData = new
                {
                    Type = "classification_complete",
                    Classification = responseDto,
                    SystemStatus = "Processing",
                    Timestamp = DateTime.UtcNow,
                    ProcessingStats = new
                    {
                        PipelineStages = responseDto.ProcessingPipeline,
                        ValidationPassed = CountValidationPasses(responseDto.ValidationResults),
                        SensorDataQuality = AssessSensorDataQuality(responseDto.SensorData)
                    }
                };
                
                await Clients.Group("Dashboard").SendAsync("ClassificationUpdate", dashboardData);
                
                // Send alerts for concerning results
                await ProcessClassificationAlerts(responseDto);
                
                _logger.LogInformation("Classification broadcasted: {Classification} (confidence: {Confidence:F2}, ID: {Id}, Detection: {DetectionId})", 
                    result.FinalClassification, result.FinalConfidence, result.Id, responseDto.DetectionId);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Invalid JSON format in classification result from connection {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Invalid JSON format in classification data");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing classification result from connection {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Error processing classification result");
            }
        }

        /// <summary>
        /// Handle manual override from connected devices/clients
        /// </summary>
        public async Task ApplyManualOverride(string overrideData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            try
            {
                _logger.LogInformation("Received manual override request from {ClientType} client {ConnectionId}", 
                    clientType, connectionId);
                
                var overrideRequest = JsonSerializer.Deserialize<ManualOverrideRequestDto>(overrideData);
                
                if (overrideRequest == null)
                {
                    _logger.LogWarning("Null override request received from connection {ConnectionId}", connectionId);
                    await Clients.Caller.SendAsync("OverrideError", "Override request is null");
                    return;
                }

                // Convert to service request format
                var serviceRequest = new ManualOverrideRequest
                {
                    ClassificationId = overrideRequest.ClassificationId,
                    NewClassification = overrideRequest.NewClassification,
                    NewDisposalLocation = overrideRequest.NewDisposalLocation,
                    Reason = overrideRequest.Reason,
                    UserId = overrideRequest.UserId ?? $"device_{clientType}_{connectionId[0..8]}"
                };

                var success = await _overrideService.ApplyManualOverrideAsync(serviceRequest);
                
                if (success)
                {
                    // Broadcast override notification to all connected clients
                    var overrideNotification = new
                    {
                        Type = "manual_override_applied",
                        ClassificationId = serviceRequest.ClassificationId,
                        NewClassification = serviceRequest.NewClassification,
                        NewDisposalLocation = serviceRequest.NewDisposalLocation,
                        Reason = serviceRequest.Reason,
                        OverriddenBy = serviceRequest.UserId,
                        Timestamp = DateTime.UtcNow,
                        ConnectionId = connectionId,
                        ClientType = clientType
                    };

                    // Notify all classification clients
                    await Clients.Group("Classification").SendAsync("ClassificationOverridden", overrideNotification);
                    
                    // Notify dashboard
                    await Clients.Group("Dashboard").SendAsync("OverrideApplied", overrideNotification);
                    
                    // Confirm to the requesting client
                    await Clients.Caller.SendAsync("OverrideSuccess", new
                    {
                        Message = "Manual override applied successfully",
                        ClassificationId = serviceRequest.ClassificationId,
                        Timestamp = DateTime.UtcNow
                    });

                    _logger.LogInformation("Manual override applied successfully by {UserId} for classification {ClassificationId}", 
                        serviceRequest.UserId, serviceRequest.ClassificationId);
                }
                else
                {
                    await Clients.Caller.SendAsync("OverrideError", new
                    {
                        Message = "Failed to apply override - classification not found",
                        ClassificationId = overrideRequest.ClassificationId
                    });
                    
                    _logger.LogWarning("Failed to apply override for classification {ClassificationId} - not found", 
                        overrideRequest.ClassificationId);
                }
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Invalid JSON format in override request from connection {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("OverrideError", "Invalid JSON format in override request");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing manual override from connection {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("OverrideError", "Error processing manual override");
            }
        }

        /// <summary>
        /// Handle item detection notifications from Arduino/sensor services
        /// </summary>
        public async Task NotifyItemDetection(string detectionData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            try
            {
                _logger.LogInformation("Received item detection from {ClientType} client {ConnectionId}", 
                    clientType, connectionId);
                
                var detection = JsonSerializer.Deserialize<ItemDetectionDto>(detectionData);
                
                if (detection != null)
                {
                    // Broadcast to all connected clients
                    await Clients.Group("Classification").SendAsync("ItemDetected", new
                    {
                        Type = "item_detected",
                        ItemId = detection.ItemId,
                        Timestamp = detection.Timestamp,
                        DetectionType = detection.Type,
                        SensorData = detection.SensorData,
                        Source = clientType
                    });

                    // Notify dashboard
                    await Clients.Group("Dashboard").SendAsync("ItemDetection", new
                    {
                        Type = "item_detection",
                        Data = detection,
                        Source = clientType,
                        Timestamp = DateTime.UtcNow
                    });

                    _logger.LogInformation("Item detection broadcasted: {ItemId} from {ClientType}", 
                        detection.ItemId, clientType);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing item detection from connection {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Error processing item detection");
            }
        }

        /// <summary>
        /// Handle service heartbeat from Python services
        /// </summary>
        public async Task SendHeartbeat(string heartbeatData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            try
            {
                var heartbeat = JsonSerializer.Deserialize<ServiceHeartbeatDto>(heartbeatData);
                
                if (heartbeat != null)
                {
                    // Update service status and notify dashboard
                    await Clients.Group("Dashboard").SendAsync("ServiceHeartbeat", new
                    {
                        Type = "service_heartbeat",
                        Service = heartbeat,
                        ConnectionId = connectionId,
                        ClientType = clientType,
                        ReceivedAt = DateTime.UtcNow
                    });

                    _logger.LogDebug("Heartbeat received from {ServiceName} ({ClientType}): Status={Status}", 
                        heartbeat.ServiceName, clientType, heartbeat.Status);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing heartbeat from connection {ConnectionId}", connectionId);
            }
        }

        /// <summary>
        /// Join classification group for receiving real-time updates
        /// </summary>
        public async Task JoinClassificationGroup()
        {
            var connectionId = Context.ConnectionId;
            var userAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].ToString() ?? "Unknown";
            
            await Groups.AddToGroupAsync(connectionId, "Classification");
            _logger.LogInformation("Client {ConnectionId} joined Classification group. User-Agent: {UserAgent}", 
                connectionId, userAgent);
            
            await Clients.Caller.SendAsync("JoinedClassificationGroup", new
            {
                ConnectionId = connectionId,
                Message = "Successfully joined classification group",
                Timestamp = DateTime.UtcNow,
                GroupName = "Classification"
            });
        }

        /// <summary>
        /// Join dashboard group for receiving system updates
        /// </summary>
        public async Task JoinDashboardGroup()
        {
            var connectionId = Context.ConnectionId;
            var userAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].ToString() ?? "Unknown";
            
            await Groups.AddToGroupAsync(connectionId, "Dashboard");
            _logger.LogInformation("Client {ConnectionId} joined Dashboard group. User-Agent: {UserAgent}", 
                connectionId, userAgent);
            
            await Clients.Caller.SendAsync("JoinedDashboardGroup", new
            {
                ConnectionId = connectionId,
                Message = "Successfully joined dashboard group", 
                Timestamp = DateTime.UtcNow,
                GroupName = "Dashboard"
            });
        }

        // Helper Methods

        private Dictionary<string, object> CreateValidationResults(EnhancedClassificationRequestDto classificationData)
        {
            var validationResults = new Dictionary<string, object>();
            
            // Create validation results based on sensor data and expert system results
            if (classificationData.SensorData != null)
            {
                validationResults["weight_validation"] = ValidateWeight(classificationData) ? "pass" : "fail";
                validationResults["metal_validation"] = ValidateMetal(classificationData) ? "pass" : "fail";
                validationResults["humidity_validation"] = ValidateHumidity(classificationData) ? "pass" : "fail";
                validationResults["ir_spectroscopy_validation"] = "pass"; // Assume pass if no IR data
            }

            if (classificationData.ExpertSystemResult != null)
            {
                validationResults["expert_system_confidence"] = classificationData.ExpertSystemResult.Confidence;
                validationResults["candidates_count"] = classificationData.ExpertSystemResult.CandidatesCount;
            }

            return validationResults;
        }

        private bool ValidateWeight(EnhancedClassificationRequestDto data)
        {
            if (data.SensorData == null) return true;
            
            // Basic weight validation logic
            var weight = data.SensorData.WeightGrams;
            var classification = data.ExpertSystemResult?.FinalClassification?.ToLower();
            
            return classification switch
            {
                "metal" => weight > 5.0, // Metal items typically heavier
                "glass" => weight > 10.0, // Glass items typically heavy
                "plastic" => weight < 100.0, // Plastic items typically lighter
                "paper" => weight < 50.0, // Paper items typically light
                "organic" => weight > 0.5, // Organic items vary widely
                _ => true // Unknown classifications pass validation
            };
        }

        private bool ValidateMetal(EnhancedClassificationRequestDto data)
        {
            if (data.SensorData == null) return true;
            
            var isMetalDetected = data.SensorData.IsMetalDetected;
            var classification = data.ExpertSystemResult?.FinalClassification?.ToLower();
            
            return classification switch
            {
                "metal" => isMetalDetected, // Metal classification should detect metal
                _ => true // Non-metal classifications don't require metal detection
            };
        }

        private bool ValidateHumidity(EnhancedClassificationRequestDto data)
        {
            if (data.SensorData == null) return true;
            
            var humidity = data.SensorData.HumidityPercent;
            var classification = data.ExpertSystemResult?.FinalClassification?.ToLower();
            
            return classification switch
            {
                "organic" => humidity > 30.0, // Organic items typically have higher humidity
                "paper" when humidity > 60.0 => false, // Wet paper shouldn't be recycled
                _ => true // Other classifications are less sensitive to humidity
            };
        }

        private ClassificationRequestDto MapEnhancedToStandard(EnhancedClassificationRequestDto enhanced)
        {
            return new ClassificationRequestDto
            {
                CnnPrediction = enhanced.CnnPrediction?.Stage1 ?? enhanced.CnnPrediction?.Stage2,
                SensorData = enhanced.SensorData,
                ExpertSystemResult = enhanced.ExpertSystemResult,
                Timestamp = DateTime.TryParse(enhanced.Timestamp, out var ts) ? ts : DateTime.UtcNow
            };
        }

        private int CountValidationPasses(Dictionary<string, object> validationResults)
        {
            return validationResults.Values
                .Where(v => v?.ToString()?.Equals("pass", StringComparison.OrdinalIgnoreCase) == true)
                .Count();
        }

        private string AssessSensorDataQuality(SensorDataDto? sensorData)
        {
            if (sensorData == null) return "no_data";
            
            var qualityScore = 0;
            if (sensorData.WeightGrams > 0) qualityScore++;
            if (sensorData.HumidityPercent >= 0) qualityScore++;
            if (sensorData.TemperatureCelsius > -40) qualityScore++;
            
            return qualityScore switch
            {
                3 => "excellent",
                2 => "good", 
                1 => "fair",
                _ => "poor"
            };
        }

        private async Task ProcessClassificationAlerts(EnhancedClassificationResponseDto responseDto)
        {
            // Check for low confidence classifications
            if (responseDto.FinalConfidence < 0.7)
            {
                await _notificationService.AddAlert(new SystemAlert
                {
                    Severity = "WARNING",
                    Component = "Classification",
                    Message = $"Low confidence classification: {responseDto.FinalClassification} ({responseDto.FinalConfidence:F2})"
                });
            }

            // Check for validation failures
            var failedValidations = responseDto.ValidationResults
                .Where(kv => kv.Value?.ToString()?.Equals("fail", StringComparison.OrdinalIgnoreCase) == true)
                .Count();

            if (failedValidations > 1)
            {
                await _notificationService.AddAlert(new SystemAlert
                {
                    Severity = "INFO",
                    Component = "Validation",
                    Message = $"Multiple validation failures ({failedValidations}) for detection {responseDto.DetectionId}"
                });
            }
        }

        private string DetermineClientType()
        {
            var userAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].ToString() ?? "";
            var connectionId = Context.ConnectionId;
            
            return userAgent.ToLower() switch
            {
                var ua when ua.Contains("python") => "python_service",
                var ua when ua.Contains("arduino") => "arduino_service", 
                var ua when ua.Contains("cnn") => "cnn_service",
                var ua when ua.Contains("chrome") => "web_dashboard",
                var ua when ua.Contains("firefox") => "web_dashboard",
                var ua when ua.Contains("safari") => "web_dashboard",
                _ => "unknown"
            };
        }

        // Connection event handlers
        public override async Task OnConnectedAsync()
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            _logger.LogInformation("Client connected to ClassificationHub: {ConnectionId} (Type: {ClientType})", 
                connectionId, clientType);
                
            await Clients.Caller.SendAsync("Connected", new
            {
                ConnectionId = connectionId,
                ClientType = clientType,
                Message = "Connected to ClassificationHub",
                Timestamp = DateTime.UtcNow,
                HubVersion = "v2.0",
                SupportedOperations = new[] { "SendClassificationResult", "ApplyManualOverride", "NotifyItemDetection", "SendHeartbeat" }
            });
            
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            if (exception != null)
            {
                _logger.LogError(exception, "Client disconnected from ClassificationHub with error: {ConnectionId} (Type: {ClientType})", 
                    connectionId, clientType);
            }
            else
            {
                _logger.LogInformation("Client disconnected from ClassificationHub: {ConnectionId} (Type: {ClientType})", 
                    connectionId, clientType);
            }
            
            await base.OnDisconnectedAsync(exception);
        }
    }

    // DTOs for enhanced functionality

    public class ManualOverrideRequestDto
    {
        public int ClassificationId { get; set; }
        public string NewClassification { get; set; } = string.Empty;
        public string NewDisposalLocation { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string? UserId { get; set; }
    }

    public class EnhancedClassificationRequestDto
    {
        public string? DetectionId { get; set; }
        public string? Timestamp { get; set; }
        public double ProcessingTimeMs { get; set; }
        public CnnPredictionEnhancedDto? CnnPrediction { get; set; }
        public SensorDataDto? SensorData { get; set; }
        public ExpertSystemResultDto? ExpertSystemResult { get; set; }
        public ProcessingMetadataDto? ProcessingMetadata { get; set; }
    }

    public class CnnPredictionEnhancedDto
    {
        public CnnPredictionDto? Stage1 { get; set; }
        public CnnPredictionDto? Stage2 { get; set; }
        public double TotalConfidence { get; set; }
    }

    public class ProcessingMetadataDto
    {
        public string? PipelineVersion { get; set; }
        public string? ModelVersion { get; set; }
        public string? ProcessingNode { get; set; }
        public List<string>? StagesCompleted { get; set; }
        public bool FallbackUsed { get; set; }
    }

    public class EnhancedClassificationResponseDto
    {
        public int Id { get; set; }
        public string DetectionId { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string FinalClassification { get; set; } = string.Empty;
        public double FinalConfidence { get; set; }
        public string DisposalLocation { get; set; } = string.Empty;
        public string Reasoning { get; set; } = string.Empty;
        public bool IsOverridden { get; set; }
        public double ProcessingTimeMs { get; set; }
        
        // Enhanced fields
        public string[] ProcessingPipeline { get; set; } = Array.Empty<string>();
        public Dictionary<string, object> ValidationResults { get; set; } = new();
        public CnnStageInfo CnnStages { get; set; } = new();
        public SensorDataDto? SensorData { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    public class ItemDetectionDto
    {
        public string ItemId { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public SensorDataDto? SensorData { get; set; }
    }

    public class ItemRemovalDto
    {
        public string ItemId { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
    }

    public class ServiceHeartbeatDto
    {
        public string ServiceName { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public bool CameraConnected { get; set; }
        public bool ModelLoaded { get; set; }
        public bool ArduinoConnected { get; set; }
        public bool ExpertSystemAvailable { get; set; }
        public int ItemsInQueue { get; set; }
        public bool IsProcessing { get; set; }
    }
}