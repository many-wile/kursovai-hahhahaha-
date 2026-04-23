using System.Collections.Concurrent;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Survey.Api.Helpers;
using Survey.Api.Hubs;
using Survey.Data;

namespace Survey.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class VotesController : ControllerBase
{
    public sealed class VoteAnswerRequest
    {
        public int? QuestionId { get; set; }
        public string? QuestionText { get; set; }
        public string? Type { get; set; }
        public string? Answer { get; set; }
        public string? SelectedOption { get; set; }
    }

    public sealed class VoteSubmissionRequest
    {
        public int? SurveyId { get; set; }
        public string? ResponderKey { get; set; }
        public string? ResponderName { get; set; }
        public string? ResponderEmail { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public List<VoteAnswerRequest> Answers { get; set; } = [];
    }

    private sealed class VoteAnswerRecord
    {
        public int? QuestionId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public string Type { get; set; } = SurveyQuestionSerializer.TextType;
        public string Answer { get; set; } = string.Empty;
        public string SelectedOption { get; set; } = string.Empty;
    }

    private sealed class VoteSubmissionRecord
    {
        public int SurveyId { get; set; }
        public string ResponderKey { get; set; } = string.Empty;
        public string ResponderName { get; set; } = string.Empty;
        public string ResponderEmail { get; set; } = string.Empty;
        public DateTime SubmittedAt { get; set; }
        public List<VoteAnswerRecord> Answers { get; set; } = [];
    }

    private sealed class StatsOptionResponse
    {
        public string Text { get; set; } = string.Empty;
        public int Count { get; set; }
        public int Percent { get; set; }
    }

    private sealed class StatsAnswerResponse
    {
        public string Text { get; set; } = string.Empty;
        public string Responder { get; set; } = "Пользователь";
        public DateTime? SubmittedAt { get; set; }
    }

    private sealed class StatsQuestionResponse
    {
        public string Key { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public string Type { get; set; } = SurveyQuestionSerializer.TextType;
        public int TotalAnswers { get; set; }
        public List<StatsOptionResponse> OptionStats { get; set; } = [];
        public List<StatsAnswerResponse> CustomAnswers { get; set; } = [];
        public List<StatsAnswerResponse> TextAnswers { get; set; } = [];
    }

    private sealed class StatsResponse
    {
        public int TotalResponses { get; set; }
        public List<StatsQuestionResponse> Questions { get; set; } = [];
    }

    private readonly IHubContext<PollHub> _hubContext;
    private readonly AppDbContext _context;
    private static readonly ConcurrentDictionary<int, List<VoteSubmissionRecord>> VoteStore = new();

    public VotesController(IHubContext<PollHub> hubContext, AppDbContext context)
    {
        _hubContext = hubContext;
        _context = context;
    }

    [HttpPost("{surveyId}")]
    public async Task<IActionResult> SubmitVote(int surveyId, [FromBody] VoteSubmissionRequest votePayload)
    {
        votePayload ??= new VoteSubmissionRequest();

        var surveyExists = await _context.Surveys.AnyAsync(survey => survey.Id == surveyId);
        if (!surveyExists)
        {
            return NotFound("Опрос не найден.");
        }

        var incomingAnswers = votePayload.Answers ?? [];
        if (incomingAnswers.Count == 0)
        {
            return BadRequest("Не переданы ответы для голосования.");
        }

        var responderKey = ResolveResponderKey(votePayload);
        if (string.IsNullOrWhiteSpace(responderKey))
        {
            return BadRequest("Не удалось определить пользователя для ответа.");
        }

        var normalizedAnswers = incomingAnswers
            .Select(answer => new VoteAnswerRecord
            {
                QuestionId = answer.QuestionId,
                QuestionText = (answer.QuestionText ?? string.Empty).Trim(),
                Type = string.Equals(answer.Type, SurveyQuestionSerializer.ChoiceType, StringComparison.OrdinalIgnoreCase)
                    ? SurveyQuestionSerializer.ChoiceType
                    : SurveyQuestionSerializer.TextType,
                Answer = (answer.Answer ?? string.Empty).Trim(),
                SelectedOption = (answer.SelectedOption ?? string.Empty).Trim()
            })
            .Where(answer => answer.Answer.Length > 0)
            .ToList();

        if (normalizedAnswers.Count == 0)
        {
            return BadRequest("Ответы не должны быть пустыми.");
        }

        var submission = new VoteSubmissionRecord
        {
            SurveyId = surveyId,
            ResponderKey = responderKey,
            ResponderName = (votePayload.ResponderName ?? string.Empty).Trim(),
            ResponderEmail = (votePayload.ResponderEmail ?? string.Empty).Trim(),
            SubmittedAt = votePayload.SubmittedAt ?? DateTime.UtcNow,
            Answers = normalizedAnswers
        };

        var submissions = VoteStore.GetOrAdd(surveyId, _ => []);

        lock (submissions)
        {
            submissions.RemoveAll(item => string.Equals(item.ResponderKey, responderKey, StringComparison.OrdinalIgnoreCase));
            submissions.Add(submission);
        }

        await _hubContext.Clients.All.SendAsync("ReceiveStatsUpdate", surveyId);

        return Ok(new
        {
            message = "Голос принят.",
            submittedAt = submission.SubmittedAt
        });
    }

    [HttpGet("{surveyId}/stats")]
    public async Task<IActionResult> GetStats(int surveyId)
    {
        var survey = await _context.Surveys
            .Include(item => item.Questions)
            .FirstOrDefaultAsync(item => item.Id == surveyId);

        if (survey == null)
        {
            return NotFound();
        }

        var questions = survey.Questions
            .Select(SurveyQuestionSerializer.Decode)
            .Where(question => question.Text.Length > 0)
            .ToList();

        List<VoteSubmissionRecord> submissions;
        if (VoteStore.TryGetValue(surveyId, out var stored))
        {
            lock (stored)
            {
                submissions = stored.Select(CloneSubmission).ToList();
            }
        }
        else
        {
            submissions = [];
        }

        var response = new StatsResponse
        {
            TotalResponses = submissions.Count,
            Questions = questions
                .Select((question, index) => BuildQuestionStats(question, index, submissions))
                .ToList()
        };

        return Ok(response);
    }

    private static VoteSubmissionRecord CloneSubmission(VoteSubmissionRecord source)
    {
        return new VoteSubmissionRecord
        {
            SurveyId = source.SurveyId,
            ResponderKey = source.ResponderKey,
            ResponderName = source.ResponderName,
            ResponderEmail = source.ResponderEmail,
            SubmittedAt = source.SubmittedAt,
            Answers = source.Answers
                .Select(answer => new VoteAnswerRecord
                {
                    QuestionId = answer.QuestionId,
                    QuestionText = answer.QuestionText,
                    Type = answer.Type,
                    Answer = answer.Answer,
                    SelectedOption = answer.SelectedOption
                })
                .ToList()
        };
    }

    private static StatsQuestionResponse BuildQuestionStats(
        SurveyQuestionSerializer.DecodedQuestion question,
        int index,
        List<VoteSubmissionRecord> submissions)
    {
        var matches = submissions
            .Select(submission =>
            {
                var answer = submission.Answers.FirstOrDefault(item => MatchesQuestion(item, question));
                if (answer == null)
                {
                    return null;
                }

                return new
                {
                    Answer = answer,
                    Submission = submission
                };
            })
            .Where(item => item != null)
            .Select(item => item!)
            .ToList();

        if (question.Type == SurveyQuestionSerializer.ChoiceType)
        {
            var optionStats = question.Options
                .Select(option =>
                {
                    var count = matches.Count(item =>
                        string.Equals(item.Answer.Answer, option, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(item.Answer.SelectedOption, option, StringComparison.OrdinalIgnoreCase));

                    return new StatsOptionResponse
                    {
                        Text = option,
                        Count = count,
                        Percent = matches.Count == 0 ? 0 : (int)Math.Round(count * 100d / matches.Count)
                    };
                })
                .ToList();

            var customAnswers = matches
                .Where(item =>
                {
                    var answerValue = item.Answer.Answer;
                    if (string.IsNullOrWhiteSpace(answerValue))
                    {
                        return false;
                    }

                    return !question.Options.Any(option => string.Equals(option, answerValue, StringComparison.OrdinalIgnoreCase));
                })
                .Select(item => new StatsAnswerResponse
                {
                    Text = item.Answer.Answer,
                    Responder = ResolveResponderName(item.Submission),
                    SubmittedAt = item.Submission.SubmittedAt
                })
                .ToList();

            return new StatsQuestionResponse
            {
                Key = question.Id > 0 ? question.Id.ToString() : $"question_{index + 1}",
                Text = question.Text,
                Type = SurveyQuestionSerializer.ChoiceType,
                TotalAnswers = matches.Count,
                OptionStats = optionStats,
                CustomAnswers = customAnswers
            };
        }

        var textAnswers = matches
            .Where(item => item.Answer.Answer.Length > 0)
            .Select(item => new StatsAnswerResponse
            {
                Text = item.Answer.Answer,
                Responder = ResolveResponderName(item.Submission),
                SubmittedAt = item.Submission.SubmittedAt
            })
            .ToList();

        return new StatsQuestionResponse
        {
            Key = question.Id > 0 ? question.Id.ToString() : $"question_{index + 1}",
            Text = question.Text,
            Type = SurveyQuestionSerializer.TextType,
            TotalAnswers = matches.Count,
            TextAnswers = textAnswers
        };
    }

    private static bool MatchesQuestion(VoteAnswerRecord answer, SurveyQuestionSerializer.DecodedQuestion question)
    {
        if (answer.QuestionId.HasValue && question.Id > 0 && answer.QuestionId.Value == question.Id)
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(answer.QuestionText) &&
            string.Equals(answer.QuestionText.Trim(), question.Text, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }

    private string ResolveResponderKey(VoteSubmissionRequest payload)
    {
        if (!string.IsNullOrWhiteSpace(payload.ResponderKey))
        {
            return payload.ResponderKey.Trim();
        }

        var userIdClaim = User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value;
        if (!string.IsNullOrWhiteSpace(userIdClaim))
        {
            return $"user:{userIdClaim.Trim()}";
        }

        var emailClaim = User.Identity?.Name;
        if (!string.IsNullOrWhiteSpace(emailClaim))
        {
            return $"email:{emailClaim.Trim().ToLowerInvariant()}";
        }

        var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userAgent = Request.Headers.UserAgent.ToString();
        var fingerprint = $"{remoteIp}:{userAgent}";
        return $"guest:{fingerprint.GetHashCode(StringComparison.Ordinal)}";
    }

    private static string ResolveResponderName(VoteSubmissionRecord submission)
    {
        if (!string.IsNullOrWhiteSpace(submission.ResponderName))
        {
            return submission.ResponderName;
        }

        if (!string.IsNullOrWhiteSpace(submission.ResponderEmail))
        {
            return submission.ResponderEmail;
        }

        return "Пользователь";
    }
}
