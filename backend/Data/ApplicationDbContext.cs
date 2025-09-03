// backend/Data/ApplicationDbContext.cs
using Microsoft.EntityFrameworkCore;
using SmartRecyclingBin.Models;
using System.Text.Json;

namespace SmartRecyclingBin.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) 
            : base(options) { }

        public DbSet<ClassificationResult> ClassificationResults { get; set; }
        public DbSet<SystemHealthMetrics> HealthMetrics { get; set; }
        public DbSet<SystemAlert> SystemAlerts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Configure ClassificationResult with IMAGE SUPPORT
            modelBuilder.Entity<ClassificationResult>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Timestamp).HasDefaultValueSql("datetime('now')");
                
                // Indexes for performance
                entity.HasIndex(e => e.Timestamp);
                entity.HasIndex(e => e.FinalClassification);
                entity.HasIndex(e => e.IsOverridden);
                entity.HasIndex(e => e.DetectionId); // New index for detection tracking
                entity.HasIndex(e => e.HasImage);     // New index for image queries
                
                // String length constraints
                entity.Property(e => e.CnnPredictedClass).IsRequired().HasMaxLength(100);
                entity.Property(e => e.FinalClassification).IsRequired().HasMaxLength(100);
                entity.Property(e => e.DisposalLocation).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Reasoning).HasMaxLength(500);
                entity.Property(e => e.DetectionId).IsRequired().HasMaxLength(100);
                entity.Property(e => e.ProcessingPipeline).HasMaxLength(1000);
                entity.Property(e => e.ValidationResults).HasMaxLength(2000);
                
                // Override fields
                entity.Property(e => e.OverrideReason).HasMaxLength(500);
                entity.Property(e => e.OverriddenBy).HasMaxLength(100);
                entity.Property(e => e.OverrideClassification).HasMaxLength(100);
                
                // 🖼️ IMAGE STORAGE CONFIGURATION
                // Store image as TEXT (Base64) - SQLite supports large TEXT fields efficiently
                entity.Property(e => e.ImageBase64)
                      .HasColumnType("TEXT"); // SQLite TEXT can hold up to 1 billion characters
                
                entity.Property(e => e.ImageFormat).HasMaxLength(10);
                entity.Property(e => e.ImageDimensions).HasMaxLength(20);
                
                // Default values for image fields
                entity.Property(e => e.HasImage).HasDefaultValue(false);
                entity.Property(e => e.ImageFormat).HasDefaultValue("jpeg");
                
                // Add computed column for image size in MB (for monitoring)
                // This helps with database maintenance and monitoring
            });

            // Configure SystemHealthMetrics
            modelBuilder.Entity<SystemHealthMetrics>(entity =>
            {
                entity.HasKey(e => e.Timestamp);
                entity.Property(e => e.ClassificationCounts)
                      .HasConversion(
                          v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                          v => JsonSerializer.Deserialize<Dictionary<string, int>>(v, (JsonSerializerOptions?)null) ?? new()
                      );
            });

            // Configure SystemAlert
            modelBuilder.Entity<SystemAlert>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Timestamp).HasDefaultValueSql("datetime('now')");
                entity.HasIndex(e => e.Timestamp);
                entity.HasIndex(e => e.Severity);
                entity.HasIndex(e => e.IsResolved);
                
                entity.Property(e => e.Severity).IsRequired().HasMaxLength(20);
                entity.Property(e => e.Component).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Message).IsRequired().HasMaxLength(500);
                entity.Property(e => e.ResolvedBy).HasMaxLength(100);
            });

            base.OnModelCreating(modelBuilder);
        }

        /// <summary>
        /// Custom method to get classifications with image metadata only (not full image data)
        /// This is more efficient for list views where images aren't displayed
        /// </summary>
        public IQueryable<ClassificationWithImageDto> GetClassificationsWithImageMetadata()
        {
            return ClassificationResults.Select(c => new ClassificationWithImageDto
            {
                Id = c.Id,
                DetectionId = c.DetectionId,
                Timestamp = c.Timestamp,
                FinalClassification = c.FinalClassification,
                FinalConfidence = c.FinalConfidence,
                DisposalLocation = c.DisposalLocation,
                Reasoning = c.Reasoning,
                ProcessingTimeMs = c.ProcessingTimeMs,
                HasImage = c.HasImage,
                ImageCaptureTimestamp = c.ImageCaptureTimestamp,
                ImageSizeBytes = c.ImageSizeBytes,
                ImageFormat = c.ImageFormat,
                ImageDimensions = c.ImageDimensions,
                ProcessingPipeline = c.ProcessingPipeline,
                IsOverridden = c.IsOverridden,
                SensorData = new SensorData
                {
                    WeightGrams = c.WeightGrams,
                    IsMetalDetected = c.IsMetalDetected,
                    HumidityPercent = c.HumidityPercent,
                    TemperatureCelsius = c.TemperatureCelsius,
                    IsMoist = c.IsMoist,
                    IsTransparent = c.IsTransparent,
                    IsFlexible = c.IsFlexible
                }
            });
        }

        /// <summary>
        /// Get image storage statistics for monitoring
        /// </summary>
        public async Task<ImageStorageStats> GetImageStorageStatsAsync()
        {
            var stats = await ClassificationResults
                .Where(c => c.HasImage)
                .GroupBy(c => 1)
                .Select(g => new ImageStorageStats
                {
                    TotalImagesStored = g.Count(),
                    TotalStorageSizeBytes = g.Sum(c => c.ImageSizeBytes ?? 0),
                    AverageImageSizeBytes = g.Average(c => c.ImageSizeBytes ?? 0),
                    OldestImageDate = g.Min(c => c.ImageCaptureTimestamp),
                    NewestImageDate = g.Max(c => c.ImageCaptureTimestamp)
                })
                .FirstOrDefaultAsync();

            return stats ?? new ImageStorageStats();
        }
    }
}