using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Survey.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddImagePathToSurvey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImagePath",
                table: "Surveys",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImagePath",
                table: "Surveys");
        }
    }
}
