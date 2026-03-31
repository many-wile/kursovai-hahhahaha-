namespace Survey.Models;

public class Question
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public int SurveyItemId { get; set; }
}