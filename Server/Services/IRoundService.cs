using Server.Data.Entities;

namespace Server.Services;

public interface IRoundService
{
    Task<RoundBidResult> PlaceBidAsync(int roundId, int playerId, int bidCount, CancellationToken cancellationToken = default);
    RoundBidResult PlaceBid(Round round, int playerId, int bidCount);
}
