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
    [Authorize]
    public async Task<ActionResult<SurveyItem>> CreateSurvey(SurveyItem item)
    {
        _context.Surveys.Add(item);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetSurveys), new { id = item.Id }, item);
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> DeleteSurvey(int id)
    {
        var survey = await _context.Surveys.FindAsync(id);
        if (survey == null)
        {
            return NotFound("Опрос не найден");
        }

        _context.Surveys.Remove(survey);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateSurvey(int id, SurveyItem updatedItem)
    {
        if (id != updatedItem.Id) return BadRequest();

        _context.Entry(updatedItem).State = EntityState.Modified;

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
}