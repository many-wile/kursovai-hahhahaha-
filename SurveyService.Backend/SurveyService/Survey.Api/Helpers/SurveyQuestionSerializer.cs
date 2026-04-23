using System.Text.Json;
using Survey.Models;

namespace Survey.Api.Helpers;

public static class SurveyQuestionSerializer
{
    public const string ChoiceType = "choice";
    public const string TextType = "text";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public sealed class DecodedQuestion
    {
        public int Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public string Type { get; set; } = TextType;
        public List<string> Options { get; set; } = [];
    }

    private sealed class StoredQuestion
    {
        public string Text { get; set; } = string.Empty;
        public string Type { get; set; } = TextType;
        public List<StoredOption> Options { get; set; } = [];
    }

    private sealed class StoredOption
    {
        public string Text { get; set; } = string.Empty;
    }

    public static string Serialize(string text, string? type, IEnumerable<string>? options)
    {
        var normalizedText = (text ?? string.Empty).Trim();
        var normalizedType = string.Equals(type, ChoiceType, StringComparison.OrdinalIgnoreCase)
            ? ChoiceType
            : TextType;

        var normalizedOptions = normalizedType == ChoiceType
            ? (options ?? [])
                .Select(option => (option ?? string.Empty).Trim())
                .Where(option => option.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(option => new StoredOption { Text = option })
                .ToList()
            : [];

        var stored = new StoredQuestion
        {
            Text = normalizedText,
            Type = normalizedType,
            Options = normalizedOptions
        };

        return JsonSerializer.Serialize(stored);
    }

    public static DecodedQuestion Decode(Question question)
    {
        var decoded = Decode(question.Text);
        decoded.Id = question.Id;
        return decoded;
    }

    public static DecodedQuestion Decode(string rawText)
    {
        var normalized = (rawText ?? string.Empty).Trim();
        if (normalized.Length == 0)
        {
            return new DecodedQuestion();
        }

        if (normalized.StartsWith("{"))
        {
            try
            {
                var stored = JsonSerializer.Deserialize<StoredQuestion>(normalized, JsonOptions);
                if (stored is not null)
                {
                    var storedText = (stored.Text ?? string.Empty).Trim();
                    var storedType = string.Equals(stored.Type, ChoiceType, StringComparison.OrdinalIgnoreCase)
                        ? ChoiceType
                        : TextType;

                    var storedOptions = storedType == ChoiceType
                        ? (stored.Options ?? [])
                            .Select(option => (option.Text ?? string.Empty).Trim())
                            .Where(option => option.Length > 0)
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .ToList()
                        : [];

                    return new DecodedQuestion
                    {
                        Text = storedText,
                        Type = storedType,
                        Options = storedOptions
                    };
                }
            }
            catch
            {
                // Treat non-JSON legacy values as plain text.
            }
        }

        return new DecodedQuestion
        {
            Text = normalized,
            Type = TextType,
            Options = []
        };
    }
}
