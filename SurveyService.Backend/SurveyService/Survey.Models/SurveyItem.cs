namespace Survey.Models;

public class SurveyItem
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? ImagePath { get; set; }

    public List<Question> Questions { get; set; } = new();
}