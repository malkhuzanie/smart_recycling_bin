using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartRecyclingBin.Migrations
{
    /// <inheritdoc />
    public partial class v1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "IrTransparency",
                table: "ClassificationResults",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OverrideUserId",
                table: "ClassificationResults",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IrTransparency",
                table: "ClassificationResults");

            migrationBuilder.DropColumn(
                name: "OverrideUserId",
                table: "ClassificationResults");
        }
    }
}
