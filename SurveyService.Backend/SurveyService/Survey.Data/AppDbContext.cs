using Microsoft.EntityFrameworkCore;
using Survey.Models;

namespace Survey.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<SurveyItem> Surveys { get; set; }
    public DbSet<Question> Questions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Question>()
            .HasOne<SurveyItem>()
            .WithMany(s => s.Questions)
            .HasForeignKey(q => q.SurveyItemId);
    }
}