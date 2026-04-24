using Server.Data.Entities;

namespace Server.Data.Repositories;

public interface IRoundRepository
{
    Task<Round?> GetByIdAsync(int roundId, CancellationToken cancellationToken = default);
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
