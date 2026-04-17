using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Survey.Data;
using Survey.Models;

namespace Survey.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SurveysController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public SurveysController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetSurveys()
    {
        var surveys = await _context.Surveys.Include(s => s.Questions).ToListAsync();
        return Ok(new
        {
            items = surveys,
            totalCount = surveys.Count,
            page = 1,
            pageSize = 10
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SurveyItem>> GetSurvey(int id)
    {
        var survey = await _context.Surveys.Include(s => s.Questions)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (survey == null) return NotFound();
        return survey;
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<SurveyItem>> CreateSurvey(SurveyItem item)
    {
        _context.Surveys.Add(item);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSurveys), new { id = item.Id }, item);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateSurvey(int id, SurveyItem item)
    {
        if (id != item.Id) return BadRequest();

        _context.Entry(item).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Surveys.Any(e => e.Id == id)) return NotFound();
            throw;
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteSurvey(int id)
    {
        var survey = await _context.Surveys.FindAsync(id);
        if (survey == null) return NotFound();

        _context.Surveys.Remove(survey);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/upload-image")]
    [Authorize]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var survey = await _context.Surveys.FindAsync(id);
        if (survey == null) return NotFound();

        if (file == null || file.Length == 0) return BadRequest();

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
        var extension = Path.GetExtension(file.FileName).ToLower();
        if (!allowedExtensions.Contains(extension)) return BadRequest();

        if (file.Length > 2 * 1024 * 1024) return BadRequest();

        string fileName = $"survey_{id}{extension}";
        string path = Path.Combine(_env.WebRootPath, "uploads", fileName);

        using (var stream = new FileStream(path, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        survey.ImagePath = fileName;
        await _context.SaveChangesAsync();

        return Ok(new { fileName });
    }

    [HttpGet("{id}/image")]
    public IActionResult GetImage(int id)
    {
        var extensions = new[] { ".jpg", ".jpeg", ".png" };
        string filePath = "";
        string fileName = "";

        foreach (var ext in extensions)
        {
            var path = Path.Combine(_env.WebRootPath, "uploads", $"survey_{id}{ext}");
            if (System.IO.File.Exists(path))
            {
                filePath = path;
                fileName = $"survey_{id}{ext}";
                break;
            }
        }

        if (string.IsNullOrEmpty(filePath)) return NotFound();

        var fileBytes = System.IO.File.ReadAllBytes(filePath);
        return File(fileBytes, "image/jpeg", fileName);
    }
}