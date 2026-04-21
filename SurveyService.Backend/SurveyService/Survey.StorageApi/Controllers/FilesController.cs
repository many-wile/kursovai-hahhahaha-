using Microsoft.AspNetCore.Mvc;
using Survey.Data.Repositories;

namespace Survey.StorageApi.Controllers;

[Route("api/[controller]")]
[ApiController]
public class FilesController : ControllerBase
{
    private readonly IUnitOfWork _uow;
    private readonly IWebHostEnvironment _env;

    public FilesController(IUnitOfWork uow, IWebHostEnvironment env)
    {
        _uow = uow;
        _env = env;
    }

    [HttpPost("{id}/upload")]
    public async Task<IActionResult> Upload(int id, IFormFile file)
    {
        try
        {
            var survey = await _uow.Surveys.GetByIdAsync(id);
            if (survey == null) return NotFound("Опрос не найден");
            if (file == null || file.Length == 0) return BadRequest("Файл не выбран");

            string fileName = $"survey_{id}{Path.GetExtension(file.FileName)}";

            string uploadsFolder = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            string fullPath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            survey.ImagePath = fileName;
            await _uow.Surveys.UpdateAsync(id, survey);
            await _uow.CompleteAsync();

            return Ok(new { fileName });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Ошибка при загрузке: {ex.Message}");
        }
    }

    [HttpGet("{id}/image")]
    public async Task<IActionResult> GetImage(int id)
    {
        var s = await _uow.Surveys.GetByIdAsync(id);
        if (s == null || string.IsNullOrEmpty(s.ImagePath)) return NotFound();

        string fullPath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", s.ImagePath);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        return PhysicalFile(fullPath, "image/jpeg");
    }
}