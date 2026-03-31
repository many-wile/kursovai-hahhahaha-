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

    public SurveysController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SurveyItem>>> GetSurveys()
    {
        return await _context.Surveys.Include(s => s.Questions).ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<SurveyItem>> CreateSurvey(SurveyItem item)
    {
        _context.Surveys.Add(item);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSurveys), new { id = item.Id }, item);
    }
}