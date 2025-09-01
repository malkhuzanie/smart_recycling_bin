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
            // Configure ClassificationResult
            modelBuilder.Entity<ClassificationResult>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Timestamp).HasDefaultValueSql("datetime('now')");
                entity.HasIndex(e => e.Timestamp);
                entity.HasIndex(e => e.FinalClassification);
                entity.HasIndex(e => e.IsOverridden);
                
                // Add constraints
                entity.Property(e => e.CnnPredictedClass).IsRequired().HasMaxLength(100);
                entity.Property(e => e.FinalClassification).IsRequired().HasMaxLength(100);
                entity.Property(e => e.DisposalLocation).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Reasoning).HasMaxLength(500);
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
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}
