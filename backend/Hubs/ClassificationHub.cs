using Microsoft.AspNetCore.SignalR;
using System.Text.Json;
using SmartRecyclingBin.Extensions;
using SmartRecyclingBin.Models;
using SmartRecyclingBin.Services;
using SmartRecyclingBin.Models.DTOs;

namespace SmartRecyclingBin.Hubs
{
    /// <summary>
    /// SignalR Hub for real-time waste classification communication
    /// </summary>
    public class ClassificationHub : Hub
    {
        private readonly IClassificationService _classificationService;
        private readonly IOverrideService _overrideService;
        private readonly ILogger<ClassificationHub> _logger;

        private readonly JsonSerializerOptions _snakeCaseOptions;

        public ClassificationHub(
            IClassificationService classificationService,
            IOverrideService overrideService,
            ILogger<ClassificationHub> logger)
        {
            _classificationService = classificationService;
            _overrideService = overrideService;
            _logger = logger;
            
            _snakeCaseOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
                PropertyNameCaseInsensitive = true
            };
        }

        /// <summary>
        /// Handle classification results from Python services with image data
        /// </summary>
        public async Task SendClassificationResult(string jsonData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            _logger.LogInformation("🔄 Processing classification result from {ClientType} client {ConnectionId}", 
                clientType, connectionId);
            _logger.LogError("RAW Data received {pl}", jsonData);
                
            try
            {
                // Parse JSON string to JsonElement for ClassificationService
                using var jsonDoc = JsonDocument.Parse(jsonData);
                var jsonElement = jsonDoc.RootElement;
                
                // Process the classification through ClassificationService
                var result = await _classificationService.ProcessClassificationResultAsync(jsonElement);
                
                if (result == null)
                {
                    _logger.LogError("❌ Failed to process classification result");
                    await Clients.Caller.SendAsync("Error", "Failed to process classification result");
                    return;
                }

                var responseDto = CreateClassificationResponseDto(result);
                
                await Clients.Group("Classification").SendAsync("ClassificationResult", responseDto);
                
                // 📊 Send enhanced data to dashboard group
                var dashboardUpdate = CreateDashboardUpdate(responseDto, result);
                await Clients.Group("Dashboard").SendAsync("ClassificationUpdate", dashboardUpdate);
                
                // 🚨 Process alerts for concerning results
                await ProcessClassificationAlerts(responseDto, result);
                
                // ✅ Log successful processing
                _logger.LogInformation("✅ Classification processed and broadcasted: {Classification} " +
                                     "(ID: {Id}, Detection: {DetectionId}, Confidence: {Confidence:F2}, HasImage: {HasImage})", 
                                     result.FinalClassification, result.Id, result.DetectionId, 
                                     result.FinalConfidence, result.HasImage);
                                     
                // Send success confirmation back to Python service
                await Clients.Caller.SendAsync("ClassificationProcessed", new
                {
                    Status = "success",
                    ClassificationId = result.Id,
                    DetectionId = result.DetectionId,
                    ProcessedAt = DateTime.UtcNow
                });
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "❌ Invalid JSON format in classification result from {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Invalid JSON format in classification data");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error processing classification result from {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Error processing classification result");
            }
        }

        /// <summary>
        /// Handle manual override from connected devices/clients
        /// USES EXISTING ManualOverrideRequest - NO DUPLICATES!
        /// </summary>
        public async Task ApplyManualOverride(string overrideData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            try
            {
                _logger.LogInformation("🔄 Processing manual override from {ClientType} client {ConnectionId}", 
                    clientType, connectionId);
                
                // ✅ USE EXISTING ManualOverrideRequest from ClassificationModels
                var overrideRequest = JsonSerializer.Deserialize<ManualOverrideRequest>(overrideData, _snakeCaseOptions);
                
                if (overrideRequest == null)
                {
                    await Clients.Caller.SendAsync("Error", "Invalid override request data");
                    return;
                }

                // Process the override through the OverrideService
                var success = await _overrideService.ApplyManualOverrideAsync(overrideRequest);
                
                if (success)
                {
                    // Get updated classification
                    var updatedClassification = await _classificationService.GetClassificationAsync(overrideRequest.ClassificationId);
                    
                    // Broadcast override result to all clients
                    var overrideResponse = new
                    {
                        Type = "classification_overridden",
                        ClassificationId = overrideRequest.ClassificationId,
                        NewClassification = overrideRequest.NewClassification,
                        NewDisposalLocation = overrideRequest.NewDisposalLocation,
                        Reason = overrideRequest.Reason,
                        UserId = overrideRequest.UserId,
                        Timestamp = DateTime.UtcNow,
                        UpdatedClassification = updatedClassification != null ? CreateClassificationResponseDto(updatedClassification) : null
                    };
                    
                    await Clients.Group("Classification").SendAsync("ClassificationOverridden", overrideResponse);
                    await Clients.Group("Dashboard").SendAsync("OverrideApplied", overrideResponse);
                    
                    _logger.LogInformation("✅ Manual override applied: {NewClassification} " +
                                         "(ID: {ClassificationId}, Reason: {Reason})", 
                                         overrideRequest.NewClassification, overrideRequest.ClassificationId, 
                                         overrideRequest.Reason);
                                         
                    await Clients.Caller.SendAsync("OverrideProcessed", new
                    {
                        Status = "success",
                        Message = "Override applied successfully"
                    });
                }
                else
                {
                    _logger.LogWarning("❌ Failed to apply manual override for classification {ClassificationId}", 
                        overrideRequest.ClassificationId);
                    await Clients.Caller.SendAsync("Error", "Failed to apply override");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error processing manual override from {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Error processing manual override");
            }
        }

        /// <summary>
        /// Handle item detection notifications from Arduino service
        /// USES EXISTING ItemDetectionDto - NO DUPLICATES!
        /// </summary>
        public async Task NotifyItemDetection(string itemData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            try
            {
                _logger.LogInformation("📦 Item detected by {ClientType} client {ConnectionId}", clientType, connectionId);
                
                // Parse as generic JSON since ItemDetectionDto structure may vary
                var detectionData = JsonSerializer.Deserialize<JsonElement>(itemData, _snakeCaseOptions);
                
                // Broadcast item detection to dashboard and classification clients
                var detectionNotification = new
                {
                    Type = "item_detected",
                    DetectionData = detectionData,
                    Timestamp = DateTime.UtcNow,
                    Source = clientType
                };
                
                await Clients.Group("Dashboard").SendAsync("ItemDetected", detectionNotification);
                await Clients.Group("Classification").SendAsync("ProcessingStarted", detectionNotification);
                
                _logger.LogInformation("📡 Item detection broadcasted from {ClientType}", clientType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error processing item detection from {ConnectionId}", connectionId);
                await Clients.Caller.SendAsync("Error", "Error processing item detection");
            }
        }

        /// <summary>
        /// Handle heartbeat messages from services
        /// </summary>
        public async Task SendHeartbeat(string heartbeatData)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            try
            {
                // Parse as generic JSON since heartbeat structure may vary
                var heartbeat = JsonSerializer.Deserialize<JsonElement>(heartbeatData, _snakeCaseOptions);
                
                // Update system status based on heartbeat
                var statusUpdate = new
                {
                    Type = "service_heartbeat",
                    ServiceType = clientType,
                    ConnectionId = connectionId,
                    HeartbeatData = heartbeat,
                    Timestamp = DateTime.UtcNow
                };
                
                // Send to dashboard for system monitoring
                await Clients.Group("Dashboard").SendAsync("ServiceHeartbeat", statusUpdate);
                
                _logger.LogDebug("💗 Heartbeat received from {ClientType} client {ConnectionId}", clientType, connectionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error processing heartbeat from {ConnectionId}", connectionId);
            }
        }

        /// <summary>
        /// Allow clients to join specific groups for targeted updates
        /// </summary>
        public async Task JoinGroup(string groupName)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            if (IsValidGroupName(groupName))
            {
                await Groups.AddToGroupAsync(connectionId, groupName);
                _logger.LogInformation("✅ {ClientType} client {ConnectionId} joined group '{GroupName}'", 
                    clientType, connectionId, groupName);
                    
                await Clients.Caller.SendAsync("GroupJoined", new
                {
                    GroupName = groupName,
                    Timestamp = DateTime.UtcNow
                });
            }
            else
            {
                _logger.LogWarning("❌ Invalid group name '{GroupName}' from {ConnectionId}", groupName, connectionId);
                await Clients.Caller.SendAsync("Error", $"Invalid group name: {groupName}");
            }
        }

        /// <summary>
        /// Allow clients to leave groups
        /// </summary>
        public async Task LeaveGroup(string groupName)
        {
            var connectionId = Context.ConnectionId;
            
            await Groups.RemoveFromGroupAsync(connectionId, groupName);
            _logger.LogInformation("👋 Client {ConnectionId} left group '{GroupName}'", connectionId, groupName);
        }

        // Connection event handlers
        public override async Task OnConnectedAsync()
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            _logger.LogInformation("🔗 Client connected to ClassificationHub: {ConnectionId} (Type: {ClientType})", 
                connectionId, clientType);
                
            // Automatically join appropriate groups based on client type
            if (clientType == "web_dashboard")
            {
                await Groups.AddToGroupAsync(connectionId, "Dashboard");
                await Groups.AddToGroupAsync(connectionId, "Classification");
            }
            else if (clientType.EndsWith("_service"))
            {
                await Groups.AddToGroupAsync(connectionId, "Classification");
            }
                
            await Clients.Caller.SendAsync("Connected", new
            {
                ConnectionId = connectionId,
                ClientType = clientType,
                Message = "Connected to ClassificationHub",
                Timestamp = DateTime.UtcNow,
                HubVersion = "v2.1",
                SupportedOperations = new[] 
                { 
                    "SendClassificationResult", "ApplyManualOverride", 
                    "NotifyItemDetection", "SendHeartbeat", 
                    "JoinGroup", "LeaveGroup" 
                }
            });
            
            await base.OnConnectedAsync();
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

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var connectionId = Context.ConnectionId;
            var clientType = DetermineClientType();
            
            if (exception != null)
            {
                _logger.LogError(exception, "❌ Client disconnected from ClassificationHub with error: {ConnectionId} (Type: {ClientType})", 
                    connectionId, clientType);
            }
            else
            {
                _logger.LogInformation("👋 Client disconnected from ClassificationHub: {ConnectionId} (Type: {ClientType})", 
                    connectionId, clientType);
            }
            
            await base.OnDisconnectedAsync(exception);
        }

        // Private helper methods

        private string DetermineClientType()
        {
            var userAgent = Context.GetHttpContext()?.Request.Headers.UserAgent.ToString() ?? "";
            
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

        private ClassificationResponseDto CreateClassificationResponseDto(ClassificationResult result)
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
                
                // Enhanced fields from stored result
                ProcessingPipeline = result.ProcessingPipeline ?? string.Empty,
                ValidationResults = result.ValidationResults ?? "{}",
                
                // ✅ CNN information - USING EXISTING CnnPredictionDto
                CnnPrediction = string.IsNullOrEmpty(result.CnnPredictedClass) ? null : new CnnPredictionDto
                {
                    PredictedClass = result.CnnPredictedClass ?? "",
                    Confidence = result.CnnConfidence,
                    Stage = result.CnnStage,
                    ProcessingTimeMs = result.ProcessingTimeMs
                },
                
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

        private object CreateDashboardUpdate(ClassificationResponseDto responseDto, ClassificationResult result)
        {
            return new
            {
                Type = "classification_complete",
                Classification = responseDto,
                SystemStatus = "Processing",
                Timestamp = DateTime.UtcNow,
                ProcessingStats = new
                {
                    PipelineStages = responseDto.ProcessingPipeline.Split(" → ", StringSplitOptions.RemoveEmptyEntries),
                    ValidationsPassed = CountValidationPasses(responseDto.ValidationResults),
                    HasImage = responseDto.HasImage,
                    ProcessingTimeMs = responseDto.ProcessingTimeMs,
                    ConfidenceLevel = GetConfidenceLevel(responseDto.FinalConfidence)
                },
                Performance = new
                {
                    ProcessingSpeed = responseDto.ProcessingTimeMs,
                    ConfidenceScore = responseDto.FinalConfidence,
                    PipelineEfficiency = CalculatePipelineEfficiency(responseDto)
                }
            };
        }

        private async Task ProcessClassificationAlerts(ClassificationResponseDto responseDto, ClassificationResult result)
        {
            var alerts = new List<object>();

            // Low confidence alert
            if (responseDto.FinalConfidence < 0.7)
            {
                alerts.Add(new
                {
                    Type = "low_confidence",
                    Message = $"Low confidence classification: {responseDto.FinalClassification} ({responseDto.FinalConfidence:P1})",
                    Severity = "warning",
                    ClassificationId = responseDto.Id
                });
            }

            // Large processing time alert
            if (responseDto.ProcessingTimeMs > 5000)
            {
                alerts.Add(new
                {
                    Type = "slow_processing",
                    Message = $"Slow processing time: {responseDto.ProcessingTimeMs:F0}ms",
                    Severity = "info",
                    ClassificationId = responseDto.Id
                });
            }

            // Image quality alert
            if (!responseDto.HasImage)
            {
                alerts.Add(new
                {
                    Type = "no_image",
                    Message = "No image captured for classification",
                    Severity = "warning",
                    ClassificationId = responseDto.Id
                });
            }

            // Send alerts if any
            if (alerts.Any())
            {
                await Clients.Group("Dashboard").SendAsync("ClassificationAlerts", new
                {
                    ClassificationId = responseDto.Id,
                    DetectionId = responseDto.DetectionId,
                    Alerts = alerts,
                    Timestamp = DateTime.UtcNow
                });
            }
        }

        private bool IsValidGroupName(string groupName)
        {
            var validGroups = new[] { "Classification", "Dashboard", "Monitoring", "Alerts" };
            return validGroups.Contains(groupName);
        }

        private int CountValidationPasses(string validationResults)
        {
            if (string.IsNullOrEmpty(validationResults)) return 0;
            
            try
            {
                using var doc = JsonDocument.Parse(validationResults);
                var count = 0;
                foreach (var property in doc.RootElement.EnumerateObject())
                {
                    if (property.Value.ValueKind == JsonValueKind.String && 
                        property.Value.GetString()?.ToLower() == "pass")
                    {
                        count++;
                    }
                }
                return count;
            }
            catch
            {
                return 0;
            }
        }

        private string GetConfidenceLevel(double confidence)
        {
            return confidence switch
            {
                >= 0.9 => "High",
                >= 0.7 => "Medium",
                >= 0.5 => "Low",
                _ => "Very Low"
            };
        }

        private double CalculatePipelineEfficiency(ClassificationResponseDto responseDto)
        {
            // Calculate efficiency based on processing time and confidence
            var timeEfficiency = Math.Max(0, 1 - (responseDto.ProcessingTimeMs / 10000.0)); // Target: under 10s
            var confidenceWeight = responseDto.FinalConfidence;
            
            return (timeEfficiency + confidenceWeight) / 2.0;
        }
    }
}