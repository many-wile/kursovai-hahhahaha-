using Survey.Data.Repositories;
namespace Survey.Data.Repositories;

public interface IUnitOfWork : IDisposable
{
    ISurveyRepository Surveys { get; }
    Task<int> CompleteAsync();
}