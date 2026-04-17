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
    public async Task<ActionResult<IEnumerable<SurveyItem>>> GetSurveys() =>
        await _context.Surveys.Include(s => s.Questions).ToListAsync();

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<SurveyItem>> CreateSurvey(SurveyItem item)
    {
        _context.Surveys.Add(item);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSurveys), new { id = item.Id }, item);
    }

    [HttpPost("{id}/upload-image")]
    [Authorize]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var survey = await _context.Surveys.FindAsync(id);
        if (survey == null) return NotFound("Опрос не найден");

        if (file == null || file.Length == 0) return BadRequest("Файл не выбран");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
        var extension = Path.GetExtension(file.FileName).ToLower();
        if (!allowedExtensions.Contains(extension))
            return BadRequest("Недопустимый формат. Разрешены только .jpg, .jpeg, .png");

        if (file.Length > 2 * 1024 * 1024)
            return BadRequest("Файл слишком велик. Максимальный размер 2 МБ");

        string fileName = $"survey_{id}{extension}";
        string uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");

        if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

        string filePath = Path.Combine(uploadsFolder, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new { message = "Картинка успешно загружена", fileName = fileName });
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
}