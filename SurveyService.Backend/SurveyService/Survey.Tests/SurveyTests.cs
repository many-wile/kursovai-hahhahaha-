using Microsoft.EntityFrameworkCore;
using Survey.Data;
using Survey.Models;
using Xunit;

namespace Survey.Tests;

public class SurveyTests
{
    [Fact]
    public async Task CreateSurvey_ShouldAddToDatabase()
    {
        // 1. Arrange
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: "TestDb")
            .Options;

        using var context = new AppDbContext(options);
        var survey = new SurveyItem { Title = "Тестовый опрос", Description = "Описание" };

        // 2. Act
        context.Surveys.Add(survey);
        await context.SaveChangesAsync();

        // 3. Assert
        var count = await context.Surveys.CountAsync();
        Assert.Equal(1, count);
        Assert.Equal("Тестовый опрос", survey.Title);
    }
}