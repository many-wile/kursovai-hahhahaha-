using Microsoft.EntityFrameworkCore;
using Survey.Models;
using Survey.Models.DTO;

namespace Survey.Data.Repositories;

public class SurveyRepository : ISurveyRepository
{
    private readonly AppDbContext _context;

    public SurveyRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<SurveyItem>> GetPagedAsync(int page, int pageSize, string query)
    {
        var dbQuery = _context.Surveys.Include(s => s.Questions).AsQueryable();

        // ФИЛЬТРАЦИЯ
        if (!string.IsNullOrWhiteSpace(query))
        {
            dbQuery = dbQuery.Where(s => s.Title.ToLower().Contains(query.ToLower()));
        }

        var totalCount = await dbQuery.CountAsync();

        // ПАГИНАЦИЯ
        var items = await dbQuery
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<SurveyItem>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<SurveyItem?> GetByIdAsync(int id)
    {
        return await _context.Surveys.Include(s => s.Questions).FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<SurveyItem> CreateAsync(SurveyItem item)
    {
        _context.Surveys.Add(item);
        await _context.SaveChangesAsync();
        return item;
    }

    public async Task<SurveyItem?> UpdateAsync(int id, SurveyItem item)
    {
        var existing = await _context.Surveys.FindAsync(id);
        if (existing == null) return null;

        existing.Title = item.Title;
        existing.Description = item.Description;
        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteAsync(int id)
    {
        var item = await _context.Surveys.FindAsync(id);
        if (item != null)
        {
            _context.Surveys.Remove(item);
            await _context.SaveChangesAsync();
        }
    }
}