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
    public async Task<ActionResult<PagedResult<SurveyItem>>> GetSurveys(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string query = "")
    {
        var cacheKey = $"surveys_p{page}_s{pageSize}_q{query}";

        if (!_cache.TryGetValue(cacheKey, out PagedResult<SurveyItem> result))
        {
            result = await _unitOfWork.Surveys.GetPagedAsync(page, pageSize, query);
            var cacheOptions = new MemoryCacheEntryOptions().SetAbsoluteExpiration(TimeSpan.FromSeconds(30));
            _cache.Set(cacheKey, result, cacheOptions);
        }

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SurveyItem>> GetSurvey(int id)
    {
        var survey = await _unitOfWork.Surveys.GetByIdAsync(id);
        if (survey == null) return NotFound();
        return survey;
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<SurveyItem>> CreateSurvey(SurveyItem item)
    {
        var created = await _unitOfWork.Surveys.CreateAsync(item);
        await _unitOfWork.CompleteAsync();
        return CreatedAtAction(nameof(GetSurvey), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateSurvey(int id, SurveyItem item)
    {
        if (id != item.Id) return BadRequest();
        var updated = await _unitOfWork.Surveys.UpdateAsync(id, item);
        if (updated == null) return NotFound();
        await _unitOfWork.CompleteAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteSurvey(int id)
    {
        await _unitOfWork.Surveys.DeleteAsync(id);
        await _unitOfWork.CompleteAsync();
        return NoContent();
    }
}