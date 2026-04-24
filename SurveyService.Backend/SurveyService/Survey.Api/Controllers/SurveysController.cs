using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Survey.Api.Helpers;
using Survey.Data.Repositories;
using Survey.Models;
using Survey.Models.DTO;

namespace Survey.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SurveysController : ControllerBase
{
    private const string SurveyCacheVersionKey = "surveys_cache_version";

    public sealed class SurveyQuestionOptionRequest
    {
        public string Text { get; set; } = string.Empty;
    }

    public sealed class SurveyQuestionMetaRequest
    {
        public int? Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public string Type { get; set; } = SurveyQuestionSerializer.TextType;
        public List<SurveyQuestionOptionRequest> Options { get; set; } = [];
    }

    public sealed class SurveyUpsertRequest
    {
        public int? Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? ImagePath { get; set; }
        public List<string> Questions { get; set; } = [];
        public List<SurveyQuestionMetaRequest> QuestionsMeta { get; set; } = [];
    }

    private sealed class SurveyOptionResponse
    {
        public string Text { get; set; } = string.Empty;
    }

    private sealed class SurveyQuestionResponse
    {
        public int Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public string Type { get; set; } = SurveyQuestionSerializer.TextType;
        public List<SurveyOptionResponse> Options { get; set; } = [];
    }

    private sealed class SurveyResponse
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? ImagePath { get; set; }
        public List<SurveyQuestionResponse> Questions { get; set; } = [];
    }

    private readonly IUnitOfWork _unitOfWork;
    private readonly IMemoryCache _cache;
    private readonly IWebHostEnvironment _env;

    public SurveysController(IUnitOfWork unitOfWork, IMemoryCache cache, IWebHostEnvironment env)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> GetSurveys(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string query = "")
    {
        var cacheKey = BuildSurveyCacheKey(page, pageSize, query);

        if (!_cache.TryGetValue(cacheKey, out PagedResult<SurveyItem>? result))
        {
            result = await _unitOfWork.Surveys.GetPagedAsync(page, pageSize, query);
            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromSeconds(30));

            _cache.Set(cacheKey, result, cacheOptions);
        }

        var payload = new PagedResult<SurveyResponse>
        {
            Items = result!.Items.Select(ToSurveyResponse).ToList(),
            TotalCount = result.TotalCount,
            Page = result.Page,
            PageSize = result.PageSize
        };

        return Ok(payload);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSurvey(int id)
    {
        var survey = await _unitOfWork.Surveys.GetByIdAsync(id);
        if (survey == null)
        {
            return NotFound();
        }

        return Ok(ToSurveyResponse(survey));
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateSurvey([FromBody] SurveyUpsertRequest request)
    {
        var validationError = ValidateSurveyRequest(request);
        if (!string.IsNullOrWhiteSpace(validationError))
        {
            return BadRequest(validationError);
        }

        var entity = new SurveyItem
        {
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            ImagePath = request.ImagePath,
            Questions = BuildQuestionEntities(request)
        };

        var created = await _unitOfWork.Surveys.CreateAsync(entity);
        await _unitOfWork.CompleteAsync();
        InvalidateSurveyListCache();

        return CreatedAtAction(nameof(GetSurvey), new { id = created.Id }, ToSurveyResponse(created));
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateSurvey(int id, [FromBody] SurveyUpsertRequest request)
    {
        if (request.Id.HasValue && request.Id.Value != id)
        {
            return BadRequest("Идентификатор в URL и теле запроса не совпадают.");
        }

        var validationError = ValidateSurveyRequest(request);
        if (!string.IsNullOrWhiteSpace(validationError))
        {
            return BadRequest(validationError);
        }

        var item = new SurveyItem
        {
            Id = id,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            ImagePath = request.ImagePath,
            Questions = BuildQuestionEntities(request)
        };

        var updated = await _unitOfWork.Surveys.UpdateAsync(id, item);
        if (updated == null)
        {
            return NotFound();
        }

        await _unitOfWork.CompleteAsync();
        InvalidateSurveyListCache();

        return Ok(ToSurveyResponse(updated));
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteSurvey(int id)
    {
        await _unitOfWork.Surveys.DeleteAsync(id);
        await _unitOfWork.CompleteAsync();
        InvalidateSurveyListCache();

        return NoContent();
    }

    [HttpPost("{id}/upload-image")]
    [Authorize]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var survey = await _unitOfWork.Surveys.GetByIdAsync(id);
        if (survey == null)
        {
            return NotFound();
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest("Файл не выбран.");
        }

        if (file.Length > 2 * 1024 * 1024)
        {
            return BadRequest("Файл слишком большой.");
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest("Неверный формат.");
        }

        var fileName = $"survey_{id}{extension}";
        var path = Path.Combine(
            _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"),
            "uploads",
            fileName);

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        await using (var stream = new FileStream(path, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        survey.ImagePath = fileName;
        await _unitOfWork.CompleteAsync();
        InvalidateSurveyListCache();

        return Ok(new { fileName });
    }

    [HttpGet("{id}/image")]
    public async Task<IActionResult> GetImage(int id)
    {
        var survey = await _unitOfWork.Surveys.GetByIdAsync(id);
        if (survey == null || string.IsNullOrWhiteSpace(survey.ImagePath))
        {
            return NotFound();
        }

        var path = Path.Combine(
            _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"),
            "uploads",
            survey.ImagePath);

        if (!System.IO.File.Exists(path))
        {
            return NotFound();
        }

        var fileBytes = await System.IO.File.ReadAllBytesAsync(path);
        var mimeType = survey.ImagePath.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
            ? "image/png"
            : "image/jpeg";

        return File(fileBytes, mimeType, survey.ImagePath);
    }

    private static string? ValidateSurveyRequest(SurveyUpsertRequest request)
    {
        if (request == null)
        {
            return "Тело запроса не может быть пустым.";
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return "Название опроса обязательно.";
        }

        if (request.Title.Trim().Length < 3)
        {
            return "Название опроса должно быть не короче 3 символов.";
        }

        return null;
    }

    private static List<Question> BuildQuestionEntities(SurveyUpsertRequest request)
    {
        var result = new List<Question>();

        if ((request.QuestionsMeta ?? []).Count > 0)
        {
            foreach (var meta in request.QuestionsMeta ?? [])
            {
                var text = (meta.Text ?? string.Empty).Trim();
                if (text.Length == 0)
                {
                    continue;
                }

                var type = string.Equals(meta.Type, SurveyQuestionSerializer.ChoiceType, StringComparison.OrdinalIgnoreCase)
                    ? SurveyQuestionSerializer.ChoiceType
                    : SurveyQuestionSerializer.TextType;

                var options = type == SurveyQuestionSerializer.ChoiceType
                    ? (meta.Options ?? [])
                        .Select(option => (option.Text ?? string.Empty).Trim())
                        .Where(option => option.Length > 0)
                        .ToList()
                    : [];

                result.Add(new Question
                {
                    Text = SurveyQuestionSerializer.Serialize(text, type, options)
                });
            }

            return result;
        }

        foreach (var question in request.Questions ?? [])
        {
            var text = (question ?? string.Empty).Trim();
            if (text.Length == 0)
            {
                continue;
            }

            result.Add(new Question
            {
                Text = SurveyQuestionSerializer.Serialize(text, SurveyQuestionSerializer.TextType, [])
            });
        }

        return result;
    }

    private static SurveyResponse ToSurveyResponse(SurveyItem survey)
    {
        return new SurveyResponse
        {
            Id = survey.Id,
            Title = survey.Title,
            Description = survey.Description,
            CreatedAt = survey.CreatedAt,
            ImagePath = survey.ImagePath,
            Questions = survey.Questions
                .Select(question =>
                {
                    var decoded = SurveyQuestionSerializer.Decode(question);
                    return new SurveyQuestionResponse
                    {
                        Id = decoded.Id,
                        Text = decoded.Text,
                        Type = decoded.Type,
                        Options = decoded.Options
                            .Select(option => new SurveyOptionResponse { Text = option })
                            .ToList()
                    };
                })
                .ToList()
        };
    }

    private string BuildSurveyCacheKey(int page, int pageSize, string query)
    {
        var version = _cache.GetOrCreate(SurveyCacheVersionKey, entry =>
        {
            entry.Priority = CacheItemPriority.NeverRemove;
            return 1;
        });

        return $"surveys_v{version}_p{page}_s{pageSize}_q{query}";
    }

    private void InvalidateSurveyListCache()
    {
        var currentVersion = _cache.GetOrCreate(SurveyCacheVersionKey, entry =>
        {
            entry.Priority = CacheItemPriority.NeverRemove;
            return 1;
        });

        _cache.Set(SurveyCacheVersionKey, currentVersion + 1);
    }
}
