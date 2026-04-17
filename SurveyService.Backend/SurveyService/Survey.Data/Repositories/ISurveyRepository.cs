using Survey.Models;
using Survey.Models.DTO;

namespace Survey.Data.Repositories;

public interface ISurveyRepository
{
    Task<PagedResult<SurveyItem>> GetPagedAsync(int page, int pageSize, string query);
    Task<SurveyItem?> GetByIdAsync(int id);
    Task<SurveyItem> CreateAsync(SurveyItem item);
    Task<SurveyItem?> UpdateAsync(int id, SurveyItem item);
    Task DeleteAsync(int id);
}