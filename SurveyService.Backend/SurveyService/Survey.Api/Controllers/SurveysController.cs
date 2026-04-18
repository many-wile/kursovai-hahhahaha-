using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Survey.Data.Repositories;
using Survey.Models;
using Survey.Models.DTO;

namespace Survey.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SurveysController : ControllerBase
{
    private readonly ISurveyRepository _repository;
    private readonly IMemoryCache _cache;
    private readonly IWebHostEnvironment _env;

    public SurveysController(ISurveyRepository repository, IMemoryCache cache, IWebHostEnvironment env)
    {
        _repository = repository;
        _cache = cache;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<SurveyItem>>> GetSurveys(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string query = "")
    {
        var cacheKey = $"surveys_p{page}_s{pageSize}_q{query}";

        if (!_cache.TryGetValue(cacheKey, out PagedResult<SurveyItem> result))
        {
            result = await _repository.GetPagedAsync(page, pageSize, query);
            var cacheOptions = new MemoryCacheEntryOptions().SetAbsoluteExpiration(TimeSpan.FromSeconds(30));
            _cache.Set(cacheKey, result, cacheOptions);
        }

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SurveyItem>> GetSurvey(int id)
    {
        var survey = await _repository.GetByIdAsync(id);
        if (survey == null) return NotFound();
        return survey;
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<SurveyItem>> CreateSurvey(SurveyItem item)
    {
        var created = await _repository.CreateAsync(item);
        return CreatedAtAction(nameof(GetSurvey), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateSurvey(int id, SurveyItem item)
    {
        if (id != item.Id) return BadRequest();
        var updated = await _repository.UpdateAsync(id, item);
        if (updated == null) return NotFound();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteSurvey(int id)
    {
        await _repository.DeleteAsync(id);
        return NoContent();
    }

    [HttpPost("{id}/upload-image")]
    [Authorize]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var survey = await _repository.GetByIdAsync(id);
        if (survey == null) return NotFound();

        if (file == null || file.Length == 0) return BadRequest("Файл не выбран.");
        if (file.Length > 2 * 1024 * 1024) return BadRequest("Файл слишком большой (макс 2MB).");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension)) return BadRequest("Неверный формат файла (разрешены .jpg, .png).");

        string fileName = $"survey_{id}{extension}";
        string path = Path.Combine(_env.WebRootPath!, "uploads", fileName);

        using (var stream = new FileStream(path, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        survey.ImagePath = fileName;
        await _repository.UpdateAsync(id, survey);

        return Ok(new { fileName });
    }

    [HttpGet("{id}/image")]
    public async Task<IActionResult> GetImage(int id)
    {
        var survey = await _repository.GetByIdAsync(id);
        if (survey == null || string.IsNullOrWhiteSpace(survey.ImagePath)) return NotFound();

        var path = Path.Combine(_env.WebRootPath!, "uploads", survey.ImagePath);
        if (!System.IO.File.Exists(path)) return NotFound();

        var fileBytes = await System.IO.File.ReadAllBytesAsync(path);
        var mimeType = survey.ImagePath.EndsWith(".png") ? "image/png" : "image/jpeg";

        return File(fileBytes, mimeType, survey.ImagePath);
    }
}