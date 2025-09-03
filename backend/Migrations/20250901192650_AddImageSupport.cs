using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartRecyclingBin.Migrations
{
    /// <inheritdoc />
    public partial class AddImageSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClassificationResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')"),
                    DetectionId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    CnnPredictedClass = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    CnnConfidence = table.Column<double>(type: "REAL", nullable: false),
                    CnnStage = table.Column<int>(type: "INTEGER", nullable: false),
                    ProcessingTimeMs = table.Column<double>(type: "REAL", nullable: false),
                    WeightGrams = table.Column<double>(type: "REAL", nullable: false),
                    IsMetalDetected = table.Column<bool>(type: "INTEGER", nullable: false),
                    HumidityPercent = table.Column<double>(type: "REAL", nullable: false),
                    TemperatureCelsius = table.Column<double>(type: "REAL", nullable: false),
                    IsMoist = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsTransparent = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsFlexible = table.Column<bool>(type: "INTEGER", nullable: false),
                    FinalClassification = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    FinalConfidence = table.Column<double>(type: "REAL", nullable: false),
                    DisposalLocation = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Reasoning = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    CandidatesCount = table.Column<int>(type: "INTEGER", nullable: false),
                    ImageBase64 = table.Column<string>(type: "TEXT", nullable: true),
                    ImageCaptureTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ImageSizeBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    ImageFormat = table.Column<string>(type: "TEXT", maxLength: 10, nullable: true, defaultValue: "jpeg"),
                    ImageDimensions = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    HasImage = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    ProcessingPipeline = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    ValidationResults = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    IsOverridden = table.Column<bool>(type: "INTEGER", nullable: false),
                    OverrideReason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    OverriddenBy = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    OverrideClassification = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    OverrideTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassificationResults", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HealthMetrics",
                columns: table => new
                {
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CameraConnected = table.Column<bool>(type: "INTEGER", nullable: false),
                    ArduinoConnected = table.Column<bool>(type: "INTEGER", nullable: false),
                    CnnServiceHealthy = table.Column<bool>(type: "INTEGER", nullable: false),
                    ExpertSystemHealthy = table.Column<bool>(type: "INTEGER", nullable: false),
                    AvgProcessingTimeMs = table.Column<double>(type: "REAL", nullable: false),
                    TotalItemsProcessed = table.Column<int>(type: "INTEGER", nullable: false),
                    AccuracyRate = table.Column<double>(type: "REAL", nullable: false),
                    ClassificationCounts = table.Column<string>(type: "TEXT", nullable: false),
                    SystemUptime = table.Column<double>(type: "REAL", nullable: false),
                    MemoryUsageMB = table.Column<double>(type: "REAL", nullable: false),
                    CpuUsagePercent = table.Column<double>(type: "REAL", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HealthMetrics", x => x.Timestamp);
                });

            migrationBuilder.CreateTable(
                name: "SystemAlerts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')"),
                    Severity = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Component = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Message = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    IsResolved = table.Column<bool>(type: "INTEGER", nullable: false),
                    ResolvedTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ResolvedBy = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemAlerts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClassificationResults_DetectionId",
                table: "ClassificationResults",
                column: "DetectionId");

            migrationBuilder.CreateIndex(
                name: "IX_ClassificationResults_FinalClassification",
                table: "ClassificationResults",
                column: "FinalClassification");

            migrationBuilder.CreateIndex(
                name: "IX_ClassificationResults_HasImage",
                table: "ClassificationResults",
                column: "HasImage");

            migrationBuilder.CreateIndex(
                name: "IX_ClassificationResults_IsOverridden",
                table: "ClassificationResults",
                column: "IsOverridden");

            migrationBuilder.CreateIndex(
                name: "IX_ClassificationResults_Timestamp",
                table: "ClassificationResults",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAlerts_IsResolved",
                table: "SystemAlerts",
                column: "IsResolved");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAlerts_Severity",
                table: "SystemAlerts",
                column: "Severity");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAlerts_Timestamp",
                table: "SystemAlerts",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClassificationResults");

            migrationBuilder.DropTable(
                name: "HealthMetrics");

            migrationBuilder.DropTable(
                name: "SystemAlerts");
        }
    }
}
