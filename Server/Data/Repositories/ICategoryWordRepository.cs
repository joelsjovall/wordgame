using Server.Data.Entities;

namespace Server.Data.Repositories;

public interface ICategoryWordRepository
{
    Task<IReadOnlyList<CategoryWord>> GetByCategoryIdAsync(int categoryId, CancellationToken cancellationToken = default);
}
