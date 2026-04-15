using Microsoft.EntityFrameworkCore;
using Server.Data.Entities;

namespace Server.Data.Repositories;

public class RoundRepository(AppDbContext dbContext) : IRoundRepository
{
    public async Task<Round?> GetByIdAsync(int roundId, CancellationToken cancellationToken = default)
    {
        return await dbContext.Rounds
            .Include(round => round.Bids)
            .FirstOrDefaultAsync(round => round.Id == roundId, cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}
