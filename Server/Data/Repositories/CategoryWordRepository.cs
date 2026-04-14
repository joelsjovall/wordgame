using Microsoft.EntityFrameworkCore;
using Server.Data.Entities;

namespace Server.Data.Repositories;

public class CategoryWordRepository(AppDbContext dbContext) : ICategoryWordRepository
{
    public async Task<IReadOnlyList<CategoryWord>> GetByCategoryIdAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        return await dbContext.CategoryWords
            .AsNoTracking()
            .Where(categoryWord => categoryWord.CategoryId == categoryId && categoryWord.IsActive)
            .ToListAsync(cancellationToken);
    }
}
