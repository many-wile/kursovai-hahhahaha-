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
        var survey = await _uow.Surveys.GetByIdAsync(id);
        if (survey == null || file == null) return NotFound();
        string fileName = $"survey_{id}{Path.GetExtension(file.FileName)}";
        string path = Path.Combine(_env.ContentRootPath, "wwwroot/uploads", fileName);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using (var s = new FileStream(path, FileMode.Create)) await file.CopyToAsync(s);
        survey.ImagePath = fileName;
        await _uow.Surveys.UpdateAsync(id, survey);
        await _uow.CompleteAsync();
        return Ok(new { fileName });
    }

    [HttpGet("{id}/image")]
    public async Task<IActionResult> GetImage(int id)
    {
        var s = await _uow.Surveys.GetByIdAsync(id);
        if (s == null || string.IsNullOrEmpty(s.ImagePath)) return NotFound();
        var path = Path.Combine(_env.ContentRootPath, "wwwroot/uploads", s.ImagePath);
        return PhysicalFile(path, "image/jpeg");
    }
}